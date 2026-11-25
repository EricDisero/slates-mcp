// The MCP server and the CLI call operations only through `prepareOperation` /
// `runOperation` (packages/shared/src/operations/parse-input.ts), the one parse
// every host shares. The desktop runs its own copy of this check
// (slate/scripts/op-entry-check.mjs) over its Director.
//
// Why: each host once wrote its own path from raw arguments to `op.run`, and the
// one that skipped the parse told a customer a legal 5-second clip was illegal
// (2026-11-24). `--self-test` proves it goes red.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOSTS = ['packages/mcp/src', 'packages/cli/src']
const DIRECT_RUN = /\b(?:op|operation)\??\.run\(|\b(?:getOperation|opsById\.get)\([^)]*\)\??\.run\(/

const violations = (text) =>
  text.split('\n').flatMap((line, i) => (DIRECT_RUN.test(line) && !line.trim().startsWith('//') ? [i + 1] : []))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.ts$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full)
  }
  return out
}

if (process.argv.includes('--self-test')) {
  for (const line of ["result = await op.run(parsed as never, defaultContext())", "const r = await opsById.get(name).run(a, c)"]) {
    if (violations(line).length !== 1) throw new Error(`self-test: missed ${line}`)
  }
  if (violations('result = await prepared.call.run(defaultContext())').length) throw new Error('self-test: flagged call.run')
}

// Vic's call, through the shared parse: a stringified duration is repaired at its path, then the
// capability check agrees with the price check. An illegal value still fails with the op's own words.
const shared = await import(new URL('../packages/shared/dist/index.js', import.meta.url))
const video = shared.ALL_OPERATIONS.find((o) => o.id === 'slates_generate_video')
for (const [model, duration] of [['wan-3.0', '5'], ['wan-3.0', '6'], ['seedance-2.5', '5']]) {
  const p = shared.prepareOperation(video, { projectId: '8652884a-16ac-4531-b1f0-3d5ec5ea2b52', model, prompt: 'lava', duration, videoResolution: '720p' })
  if (!p.ok || p.call.input.duration !== Number(duration)) throw new Error(`${model} ${duration}s did not parse to a number: ${p.message ?? p.call.input.duration}`)
  const err = shared.checkDuration(model, p.call.input.duration, { videoResolution: '720p' })
  if (err) throw new Error(`${model} ${duration}s refused after the parse: ${err}`)
}
const bad = shared.prepareOperation(video, { projectId: '8652884a-16ac-4531-b1f0-3d5ec5ea2b52', model: 'wan-3.0', prompt: 'x', duration: 'five' })
if (bad.ok || !/duration/.test(bad.message)) throw new Error('a non-numeric duration must still fail, naming duration')

const found = HOSTS.flatMap((dir) =>
  walk(join(root, dir)).flatMap((file) => violations(readFileSync(file, 'utf8')).map((n) => `${relative(root, file)}:${n}`))
)
if (found.length) {
  console.error(`A direct .run( on an operation skips its schema:\n  ${found.join('\n  ')}\nUse prepareOperation / runOperation from the shared package.`)
  process.exit(1)
}
console.log('op-entry: the MCP server and the CLI call operations only through the shared parse')
