import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import { join } from 'node:path'
import { AGENT_DIR } from '../auth.js'

// Thin client for the Slates Blender add-on's localhost execution bridge.
//
// Wire protocol (matches the add-on's `bridge_auth.py`, in front of `bridge/server.py`,
// which is Blender Lab's `blender_mcp` protocol). Requests and responses are
// NUL-delimited JSON over plain TCP, one request per connection:
//
//   -> {"type":"hello","nonce":"<client nonce>"}\0
//   <- {"status":"ok","nonce":"<server nonce>","proof":"<mac>"}\0
//   -> {"type":"execute_sealed","nonce":"<server nonce>","payload":"<json>","mac":"<mac>"}\0
//   <- {"status":"ok","result":{"sealed":"<json>","mac":"<mac>"}}\0
//
// `payload` is the upstream request `{"type":"execute","code":"...","strict_json":false}`
// and `sealed` the upstream reply `{"status":"ok","result":{...},"stdout":"...","stderr":"..."}`
// or `{"status":"error","message":"<traceback>"}`, each as a string so both sides MAC the
// same bytes. A mac is HMAC-SHA256 of `<label>\0<nonce>\0<body>` under the token the add-on
// writes to ~/.slates/blender-bridge-<port>.token each time it binds:
//
//   hello    label "hello", the client nonce, body the server nonce
//   request  label "request", the server nonce, body the payload
//   reply    label "reply", the server nonce, body the sealed string
//
// 🚨 THE TOKEN NEVER CROSSES THE SOCKET, AND NO CODE IS SENT BEFORE THE PROOF. Anything
// local can bind a port in this range, and on Windows it can share a port the add-on holds
// (`__init__.py` `_port_is_free`). A listener without the token cannot answer the hello, so
// it is sent no code, and it cannot seal a reply, so a forged `filePath` cannot reach the
// desktop's upload route. A process sharing the add-on's port is the one exception: the hello
// can land on the add-on and the signed request on that process, which can then read the
// code. It still cannot change it, forge it or seal a reply. Each nonce is good for one
// request, so a captured one replays nothing. A later incompatible change takes a new request
// type: the older side answers "Unknown request type", which is how an old add-on is told
// apart here.
//
// The add-on executes on Blender's main thread via a timer, so a request is
// serviced within a tick rather than immediately: the socket stays open until
// the reply lands, and long jobs (renders) hold it open for as long as they
// take. That is why the timeout here is generous and configurable per call
// rather than a single global value.

const HOST = '127.0.0.1'
// The add-on binds the first free port in this range, so a second Blender (or
// a stale process holding 9876) shifts it forward instead of failing. We probe
// the same range in the same order.
const BASE_PORT = 9876
const PORT_FALLBACKS = 3

const DEFAULT_TIMEOUT_MS = 60_000
// Renders are the one call that legitimately runs for minutes.
export const RENDER_TIMEOUT_MS = 15 * 60_000

const CONNECT_TIMEOUT_MS = 1_500
// Bounds a listener that accepts and never answers, on each port walked. Blender answers a
// hello on its next timer tick unless its main thread is busy.
const HELLO_TIMEOUT_MS = 15_000

/**
 * Where the add-on comes from, and how to switch it on. ONE string.
 *
 * 🚨 IT WAS TWO, AND THAT IS ALWAYS A DRIFT. The op layer had its own
 * differently-worded copy naming the same URL, so a moved download page or a
 * renamed panel button would have had to be found in two files by someone who
 * remembered both existed. Same fact, same sentence, one home.
 *
 * `slates.video/blender` is a real page as of 2026-08-28 (`slates-web`
 * `src/app/blender/page.tsx`), and it is the ONLY thing that tells a stuck user
 * where the add-on comes from. It is a hard dependency of this string, not a
 * nice-to-have: keep the path or 301 it.
 */
export const BLENDER_SETUP_HINT =
  'Install the Slates add-on from https://slates.video/blender, then in the 3D ' +
  'viewport sidebar (press N) open the Slates tab and click Start Bridge.'

const NOT_RUNNING_MESSAGE =
  'No Blender with the Slates add-on is listening on ' +
  `${HOST}:${BASE_PORT}-${BASE_PORT + PORT_FALLBACKS}. ` +
  BLENDER_SETUP_HINT

export class BlenderNotRunningError extends Error {
  constructor() {
    super(NOT_RUNNING_MESSAGE)
    this.name = 'BlenderNotRunningError'
  }
}

/** Something answered on the bridge ports, and it is not a Blender this client may drive. */
export class BlenderPeerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlenderPeerError'
  }
}

const ADDON_OUTDATED_MESSAGE =
  'The Slates add-on in this Blender is too old for this version of Slates, which only ' +
  'drives an add-on that proves itself. Update it: in Blender open Edit > Preferences > ' +
  'Get Extensions, choose Refresh Remote, then Update on Slates, or reinstall from ' +
  'https://slates.video/blender. Then restart Blender.'

const UNVERIFIED_MESSAGE =
  `Something is listening on ${HOST}:${BASE_PORT}-${BASE_PORT + PORT_FALLBACKS} but could not ` +
  'prove it is the Slates add-on, so nothing was sent to it. In Blender, stop and start the ' +
  'bridge from the Slates tab, which writes a new token to ~/.slates. If that does not clear ' +
  'it, Blender is running as another user or another program holds the port.'

const UNSIGNED_REPLY_MESSAGE =
  'Blender did not return a signed reply, so the result was thrown away. Check the Blender ' +
  'window and retry. If it repeats, stop and start the bridge from the Slates tab.'

/** A listener took the connection and said nothing in time. */
class BlenderSilentError extends Error {}

/** Raised when Blender executed the code and Python threw. Carries the traceback. */
export class BlenderExecError extends Error {
  readonly stdout: string
  readonly stderr: string
  constructor(message: string, stdout = '', stderr = '') {
    super(message)
    this.name = 'BlenderExecError'
    this.stdout = stdout
    this.stderr = stderr
  }
}

interface BridgeResponse {
  status: 'ok' | 'error'
  result?: unknown
  message?: string
  stdout?: string
  stderr?: string
  /** The hello's server nonce. */
  nonce?: unknown
  /** The hello's proof that the listener holds this port's token. */
  proof?: unknown
}

/** A port whose listener proved itself, and the nonce that buys one request. */
interface BridgeSession {
  port: number
  token: string
  nonce: string
}

function bridgeMac(token: string, label: string, nonce: string, body: string): string {
  return createHmac('sha256', token).update(`${label}\0${nonce}\0${body}`, 'utf8').digest('hex')
}

function macMatches(expected: string, received: unknown): boolean {
  if (typeof received !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** The add-on rewrites this file on every bind, so it is read fresh for each handshake. */
function readBridgeToken(port: number): string | null {
  try {
    const token = readFileSync(join(AGENT_DIR, `blender-bridge-${port}.token`), 'utf8').trim()
    return /^[0-9a-f]{64}$/.test(token) ? token : null
  } catch {
    return null
  }
}

/**
 * Resolve the installed add-on package regardless of what Blender named it.
 *
 * Extensions are imported as `bl_ext.<repo>.slates_blender`, and the repo
 * segment depends on where the user installed from — so the name cannot be
 * hardcoded. Scanning `sys.modules` for the root package is the only stable
 * handle. Submodules (`...slates_blender.bridge`) do not match the suffix, so
 * the generator yields exactly the root.
 */
const PRELUDE = `
import sys as _sys
from importlib import import_module as _import_module
_slates = next(
    (m for n, m in list(_sys.modules.items())
     if n.endswith('slates_blender') and m is not None),
    None,
)
if _slates is None:
    raise RuntimeError(
        'The Slates Blender add-on is not loaded in this Blender. '
        'Enable it in Edit > Preferences > Add-ons.'
    )

def _mod(_name):
    """Import a submodule of the add-on by short name.

    The root package only imports \`bridge\` at load time — everything else is
    lazy so enabling the add-on stays cheap — so \`_slates.previs\` is not
    reliably an attribute. Go through importlib rather than assuming it is.
    """
    return _import_module(_slates.__name__ + '.' + _name)
`.trim()

function connect(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const onError = (err: Error) => {
      socket.destroy()
      reject(err)
    }
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => onError(new Error('connect timeout')))
    socket.once('error', onError)
    socket.connect(port, HOST, () => {
      socket.setTimeout(0)
      socket.removeListener('error', onError)
      resolve(socket)
    })
  })
}

function request(socket: net.Socket, payload: string, timeoutMs: number): Promise<BridgeResponse | null> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    let settled = false

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      fn()
    }

    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new BlenderSilentError(
              `Blender did not respond within ${Math.round(timeoutMs / 1000)}s. ` +
                'It may be busy with a modal operator — check the Blender window.'
            )
          )
        ),
      timeoutMs
    )

    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const end = buffer.indexOf('\0')
      if (end === -1) return
      const raw = buffer.slice(0, end)
      finish(() => {
        try {
          resolve(JSON.parse(raw) as BridgeResponse)
        } catch (err) {
          reject(new Error(`Malformed reply from Blender: ${(err as Error).message}`))
        }
      })
    })
    socket.on('error', (err) => finish(() => reject(err)))
    socket.on('close', () =>
      finish(() => reject(new Error('Blender closed the connection before replying.')))
    )

    socket.write(payload + '\0')
  })
}

/**
 * The session on `port`, null with no listener there, or why the listener cannot be used. Throws
 * when the listener is silent and this port has a token: that is the add-on with its main thread
 * busy, and walking on would run the work in whichever other .blend is open.
 */
async function helloOn(port: number): Promise<BridgeSession | Error | null> {
  let socket: net.Socket
  try {
    socket = await connect(port)
  } catch {
    return null
  }
  const clientNonce = randomBytes(16).toString('hex')
  let reply: BridgeResponse | null
  try {
    reply = await request(socket, JSON.stringify({ type: 'hello', nonce: clientNonce }), HELLO_TIMEOUT_MS)
  } catch (err) {
    if (err instanceof BlenderSilentError && readBridgeToken(port)) throw err
    return err as Error
  }
  if (typeof reply !== 'object' || reply === null) return new BlenderPeerError(UNVERIFIED_MESSAGE)
  if (reply.status === 'error' && typeof reply.message === 'string' && reply.message.startsWith('Unknown request type')) {
    return new BlenderPeerError(ADDON_OUTDATED_MESSAGE)
  }
  const token = readBridgeToken(port)
  if (!token || typeof reply.nonce !== 'string' || !macMatches(bridgeMac(token, 'hello', clientNonce, reply.nonce), reply.proof)) {
    return new BlenderPeerError(UNVERIFIED_MESSAGE)
  }
  return { port, token, nonce: reply.nonce }
}

/**
 * The first port whose listener proves it is the add-on. A listener that cannot does not stop
 * the walk, because the add-on steps past a held port. When none proves itself, the failure
 * that tells the user the most wins: an old add-on, then a silent listener, then a stranger.
 */
async function authenticate(): Promise<BridgeSession> {
  const failures: Error[] = []
  for (let port = BASE_PORT; port <= BASE_PORT + PORT_FALLBACKS; port++) {
    const outcome = await helloOn(port)
    if (outcome === null) continue
    if (!(outcome instanceof Error)) return outcome
    failures.push(outcome)
  }
  const outdated = failures.find((f) => f.message === ADDON_OUTDATED_MESSAGE)
  const silent = failures.find((f) => !(f instanceof BlenderPeerError))
  throw outdated ?? silent ?? failures[0] ?? new BlenderNotRunningError()
}

/** Open what the add-on sealed. An unsealed reply, error or not, is untrusted text and is dropped. */
function unseal(res: BridgeResponse | null, session: BridgeSession): BridgeResponse {
  const seal = res?.result as { sealed?: unknown; mac?: unknown } | undefined
  if (res?.status !== 'ok' || typeof seal?.sealed !== 'string') throw new BlenderPeerError(UNSIGNED_REPLY_MESSAGE)
  if (!macMatches(bridgeMac(session.token, 'reply', session.nonce, seal.sealed), seal.mac)) {
    throw new BlenderPeerError(UNSIGNED_REPLY_MESSAGE)
  }
  return JSON.parse(seal.sealed) as BridgeResponse
}

export class BlenderBridgeClient {
  /**
   * Execute Python in Blender and return whatever the code assigned to
   * `result`. `strict_json` is false so a stray Blender object comes back as
   * its repr instead of failing the whole call — the agent can then correct
   * itself, which it cannot do if the error is about serialization.
   */
  async execute(code: string, opts?: { timeoutMs?: number }): Promise<{
    result: unknown
    stdout: string
    stderr: string
  }> {
    const session = await authenticate()
    const socket = await connect(session.port)
    const payload = JSON.stringify({ type: 'execute', code, strict_json: false })
    const sealed = JSON.stringify({
      type: 'execute_sealed',
      nonce: session.nonce,
      payload,
      mac: bridgeMac(session.token, 'request', session.nonce, payload),
    })
    const res = unseal(await request(socket, sealed, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS), session)

    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''
    if (res.status !== 'ok') {
      throw new BlenderExecError(res.message ?? 'Blender reported an error', stdout, stderr)
    }
    return { result: res.result, stdout, stderr }
  }

  /**
   * Execute code with the add-on package bound to `_slates`, so ops can call
   * the shipped helpers (`_slates.previs`, `_slates.scene`, `_slates.docs`)
   * instead of re-implementing them as inline Python string blobs.
   */
  async call(body: string, opts?: { timeoutMs?: number }): Promise<unknown> {
    const { result } = await this.execute(`${PRELUDE}\n${body}`, opts)
    return result
  }

  /**
   * True when a Blender this client may drive answers, false when nothing listens. Throws
   * when a listener cannot be used: the reason is what the user needs (update the add-on,
   * restart the bridge), and "no Blender found" would send them the wrong way.
   */
  async isReachable(): Promise<boolean> {
    try {
      await authenticate()
      return true
    } catch (err) {
      if (err instanceof BlenderNotRunningError) return false
      throw err
    }
  }
}
