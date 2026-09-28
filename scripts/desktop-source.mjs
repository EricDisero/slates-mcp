import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A worktree must name its paired desktop: guessing `../slate` there can
// validate an older branch and print a misleading green.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function desktopSource(relative = '') {
  const explicit = process.env.SLATES_DESKTOP_DIR
  if (!explicit && basename(root) !== 'slates-mcp' && !process.env.CI) {
    throw new Error('Set SLATES_DESKTOP_DIR to the paired desktop checkout for this worktree.')
  }
  const desktop = resolve(root, explicit || '../slate')
  const file = resolve(desktop, relative)
  const required = relative ? [file] : ['src/main/studio-agent/context.ts', 'src/main/studio-agent/ops.ts'].map(path => resolve(desktop, path))
  const missing = required.find(path => !existsSync(path))
  if (missing && (!process.env.CI || explicit)) {
    throw new Error(`Missing desktop source: ${missing}. A local check cannot skip.`)
  }
  console.error(`[sources] desktop: ${desktop}`)
  return file
}
