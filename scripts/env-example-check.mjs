#!/usr/bin/env node
// env-example-check: every environment variable the code reads is documented in
// .env.example, and every documented key is read somewhere (or marked planned).
//
// CANONICAL COPY: second-brain/tools/repo-checks/env-example-check.mjs.
// Installed into each repo's scripts/ by second-brain/tools/install_repo_checks.py;
// the vault lint fails when an installed copy differs from this one, so edit
// the canonical file and re-run the installer, never a repo's copy.
//
// Run from a repo root:  node scripts/env-example-check.mjs
// Exit 1 on any drift. Doctrine: second-brain/context/single-source-of-truth.md
// § Enforcement (a documented-but-unread key is a fossil; a read-but-undocumented
// key is a deploy that breaks on a fresh box).
//
// .env.example annotations, on the line above a key or at its end:
//   # planned: 2026-09-05   the key is not read yet; documented on purpose, dated
//   # dynamic              read through a computed name (process.env[`X_${i}`])
//   # platform             set by the host (Vercel, Fly), never by us
//
// Source scanned: .ts .tsx .js .mjs .mts .cjs .py .sh .ps1 under the repo,
// skipping node_modules, dist, build, .next, out, .git, .venv, coverage.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const root = process.cwd()
const listOnly = process.argv.includes('--list')
const exampleName = ['.env.example', '.env.sample'].find((n) => existsSync(join(root, n)))
if (!exampleName && !listOnly) {
  console.error('env-example-check: no .env.example in ' + root + ' (run with --list to see what the code reads, then write one)')
  process.exit(1)
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'out', '.out', '.git', '.venv', 'venv', 'coverage', 'dist-mcpb', '.turbo', 'exports'])
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.mts', '.cjs', '.py', '.sh', '.ps1'])
const PLATFORM = new Set(['NODE_ENV', 'PORT', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'FLY_APP_NAME', 'FLY_REGION', 'FLY_ALLOC_ID', 'CI', 'HOME', 'PATH', 'TZ', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS', 'npm_config_user_agent', 'npm_lifecycle_event', 'CLAUDE_PROJECT_DIR', 'CUDA_VISIBLE_DEVICES', 'GITHUB_ACTIONS', 'GITHUB_TOKEN', 'RUNNER_OS'])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) yield* walk(p)
    else if (EXTS.has(extname(name)) && name !== 'env-example-check.mjs') yield p
  }
}

// Literal reads. `process.env.X`, `process.env['X']`, `import.meta.env.X`,
// `os.environ['X']`, `os.environ.get('X')`, `os.getenv('X')`, bash `$X` / `${X}`
// only inside .sh files.
const READ_RES = [
  /process\.env\.([A-Z][A-Z0-9_]+)/g,
  /process\.env\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]+)/g,
  /os\.environ(?:\.get)?\(?\[?\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  /\$env:([A-Z][A-Z0-9_]+)/g,
  // helpers that take the key name as a string: intEnv('X', 30), requireEnv('X')
  /\b(?:intEnv|numEnv|boolEnv|strEnv|getEnv|requireEnv|optionalEnv|envOr|readEnv|env)\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
]
// Template reads: process.env[`PREFIX_${i}`] — the prefix marks every documented
// key that starts with it as read.
const TEMPLATE_RE = /process\.env\[\s*`([A-Z][A-Z0-9_]*?)\$\{/g
const SHELL_RE = /\$\{?([A-Z][A-Z0-9_]{2,})\}?/g

const read = new Map() // key -> first file
const prefixes = new Set()
for (const file of walk(root)) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  const rel = relative(root, file)
  for (const re of READ_RES) for (const m of text.matchAll(re)) if (!read.has(m[1])) read.set(m[1], rel)
  for (const m of text.matchAll(TEMPLATE_RE)) prefixes.add(m[1])
  if (file.endsWith('.sh') || file === 'health-check' || file === 'verify-sync') {
    for (const m of text.matchAll(SHELL_RE)) if (!read.has(m[1])) read.set(m[1], rel)
  }
}

if (listOnly) {
  for (const [k, f] of [...read.entries()].sort()) if (!PLATFORM.has(k)) console.log(`${k}\t${f}`)
  process.exit(0)
}

// Documented keys, with annotations.
const documented = new Map() // key -> { planned, dynamic, platform }
{
  const lines = readFileSync(join(root, exampleName), 'utf8').split(/\r?\n/)
  let pending = { planned: false, dynamic: false, platform: false }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { pending = { planned: false, dynamic: false, platform: false }; continue }
    if (line.startsWith('#') && !/^#\s*[A-Z][A-Z0-9_]+\s*=/.test(line)) {
      if (/#\s*planned:/i.test(line)) pending.planned = true
      if (/#\s*dynamic\b/i.test(line)) pending.dynamic = true
      if (/#\s*platform\b/i.test(line)) pending.platform = true
      continue
    }
    // `KEY=` documents a key; `# KEY=default` documents an OPTIONAL knob with
    // its code default (the convention the API's kill-switch section uses).
    const m = /^(?:#\s*)?(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=(.*)$/.exec(line)
    if (!m) continue
    const tail = m[2]
    const ann = {
      planned: pending.planned || /#\s*planned:/i.test(tail),
      dynamic: pending.dynamic || /#\s*dynamic\b/i.test(tail),
      platform: pending.platform || /#\s*platform\b/i.test(tail),
    }
    documented.set(m[1], ann)
    pending = { planned: false, dynamic: false, platform: false }
  }
}

const undocumented = [...read.keys()].filter((k) => !documented.has(k) && !PLATFORM.has(k)).sort()
const unread = [...documented.entries()]
  .filter(([k, a]) => !read.has(k) && !a.planned && !a.dynamic && !a.platform && ![...prefixes].some((p) => k.startsWith(p)))
  .map(([k]) => k).sort()

let bad = false
if (undocumented.length) {
  bad = true
  console.error(`env-example-check: ${undocumented.length} key(s) read by code but missing from ${exampleName}:`)
  for (const k of undocumented) console.error(`  ${k}   (${read.get(k)})`)
}
if (unread.length) {
  bad = true
  console.error(`env-example-check: ${unread.length} key(s) in ${exampleName} that nothing reads (mark "# planned: <date>", "# dynamic" or "# platform", or delete):`)
  for (const k of unread) console.error(`  ${k}`)
}
if (bad) process.exit(1)
console.log(`env-example-check: ${documented.size} documented, ${read.size} read, in lockstep (${exampleName}).`)
