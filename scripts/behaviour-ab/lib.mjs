// Helpers the behaviour A/B scripts share.

import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

// Read once at load: score.mjs and fixture-check.mjs point HOME at a throwaway folder for a while, and a judge
// session or the home scrub must still see the real one.
const START_ENV = { ...process.env }
const HOME = homedir()

/** `--name value` from argv, or `fallback` (also when the flag is last, with no value). */
export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}

/** A positive whole number from `--name`, or an error naming the flag. */
export function countArg(name, fallback) {
  const n = Number(arg(name, fallback))
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a whole number of 1 or more`)
  return n
}

/**
 * The environment a headless Claude Code session runs with: the signed-in plan, never an API key or
 * another provider, and no CLAUDE.md memory, so the user's own instructions cannot steer either arm.
 */
export function claudeEnv() {
  const env = { ...START_ENV }
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|CLAUDE_CODE_USE_)/i.test(key)) delete env[key]
  }
  env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1'
  env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1'
  return env
}

/**
 * Spawn the Claude Code executable (`CLAUDE_BIN`, else `claude` on PATH; an npm `claude.cmd` shim
 * needs `CLAUDE_BIN` set to the real executable, because there is no shell). The prompt goes on
 * stdin. On timeout the session is killed, with its whole process tree on Windows.
 * Resolves { code, stdout, stderr, error, timedOut }; it never rejects.
 */
export function runClaude(args, { prompt, cwd, timeoutMs }) {
  return new Promise((done) => {
    const out = []
    const err = []
    let settled = false
    let timedOut = false
    let timer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done({ stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), timedOut, ...result })
    }
    let child
    try {
      child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd, env: claudeEnv(), windowsHide: true })
    } catch (error) {
      return finish({ code: null, error: error.message })
    }
    timer = setTimeout(() => {
      timedOut = true
      // Windows kills the tree; elsewhere only the session, whose MCP server then exits when its stdin closes.
      if (process.platform === 'win32') spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true }).on('error', () => child.kill())
      else child.kill('SIGKILL')
    }, timeoutMs)
    child.on('error', (error) => finish({ code: null, error: error.message }))
    child.stdin.on('error', () => {})
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => err.push(d))
    child.on('close', (code) => finish({ code, ...(timedOut ? { error: `timed out after ${Math.round(timeoutMs / 1000)}s` } : {}) }))
    child.stdin.end(prompt)
  })
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Text with this machine's home folder replaced by `~`, so committed results carry no user path: the folder as
 * written, with forward slashes, JSON-escaped, and in Claude Code's dash-encoded project-folder name
 * (`C--Users-Name-...`), each matched case-insensitively.
 */
export function scrubHome(text) {
  const forms = [HOME, HOME.replaceAll('\\', '/'), HOME.replaceAll('\\', '\\\\'), HOME.replace(/[\\/:]/g, '-')]
  return forms.filter(Boolean).reduce((s, f) => s.replace(new RegExp(escape(f), 'gi'), '~'), String(text))
}
