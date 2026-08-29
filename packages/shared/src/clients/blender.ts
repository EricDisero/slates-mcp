import net from 'node:net'

// Thin client for the Slates Blender add-on's localhost execution bridge.
//
// Wire protocol (matches the add-on's `bridge/server.py`, which is Blender
// Lab's `blender_mcp` protocol):
//
//   -> {"type":"execute","code":"...","strict_json":false}\0
//   <- {"status":"ok","result":{...},"stdout":"...","stderr":"..."}\0
//   <- {"status":"error","message":"<traceback>"}\0
//
// Requests and responses are NUL-delimited JSON over a plain TCP socket. The
// add-on executes on Blender's main thread via a timer, so a request is
// serviced within a tick rather than immediately — the socket stays open until
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

const NOT_RUNNING_MESSAGE =
  'No Blender with the Slates add-on is listening on ' +
  `${HOST}:${BASE_PORT}-${BASE_PORT + PORT_FALLBACKS}. ` +
  'Open Blender, then in the 3D viewport sidebar (press N) open the Slates tab ' +
  'and click Start Bridge. Add-on: https://slates.video/blender'

export class BlenderNotRunningError extends Error {
  constructor() {
    super(NOT_RUNNING_MESSAGE)
    this.name = 'BlenderNotRunningError'
  }
}

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

async function connectAny(): Promise<net.Socket> {
  for (let port = BASE_PORT; port <= BASE_PORT + PORT_FALLBACKS; port++) {
    try {
      return await connect(port)
    } catch {
      // Try the next port in the range.
    }
  }
  throw new BlenderNotRunningError()
}

function request(socket: net.Socket, payload: string, timeoutMs: number): Promise<BridgeResponse> {
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
            new Error(
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
    const socket = await connectAny()
    const payload = JSON.stringify({ type: 'execute', code, strict_json: false })
    const res = await request(socket, payload, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)

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

  /** True when a Blender with the add-on is reachable. Never throws. */
  async isReachable(): Promise<boolean> {
    try {
      const socket = await connectAny()
      socket.destroy()
      return true
    } catch {
      return false
    }
  }
}
