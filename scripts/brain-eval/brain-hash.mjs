#!/usr/bin/env node
// Which brain a result tested. Every eval result carries this hash and the gate refuses one whose hash is
// not the working tree's, so a score can never be carried over to a brain it did not test. It reads the
// built package (packages/shared/dist), because that is what an agent receives: the skills, the doctrine
// on both surfaces, the MCP instructions and the router notice.
//
//   node scripts/brain-eval/brain-hash.mjs [<slates-mcp checkout>]     prints the hash and any skill the build is older than
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const shared = (root) => import(pathToFileURL(join(resolve(root), 'packages', 'shared', 'dist', 'index.js')).href)

/** sha256 of what the build at `root` hands an agent, first 16 hex characters. */
export async function brainHash(root) {
  const { SKILLS, buildAgentDoctrine, buildMcpInstructions, ROUTER_NOTICE } = await shared(root)
  const h = createHash('sha256')
  // Each part is named and NUL-separated, so moving text from one part to the next changes the hash.
  const part = (name, text) => h.update(`${name}\0${text}\0`)
  for (const name of Object.keys(SKILLS).sort()) part(`skill:${name}`, SKILLS[name])
  part('doctrine:desktop', buildAgentDoctrine({ surface: 'desktop' }))
  part('doctrine:mcp', buildAgentDoctrine({ surface: 'mcp' }))
  part('mcp-instructions', buildMcpInstructions())
  part('router-notice', ROUTER_NOTICE)
  return h.digest('hex').slice(0, 16)
}

/**
 * The skills whose markdown differs from the build at `root` (added, removed or edited since the last
 * `npm run build`). While any does, the hash names the build, not the skills on disk.
 */
export async function unbuiltSkills(root) {
  const { SKILLS } = await shared(root)
  const dir = join(resolve(root), 'packages', 'shared', 'skills')
  const onDisk = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f.slice(0, -3), readFileSync(join(dir, f), 'utf8')]))
  return [...new Set([...Object.keys(onDisk), ...Object.keys(SKILLS)])].filter((n) => onDisk[n] !== SKILLS[n]).sort()
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..'))
  console.log(await brainHash(root))
  const stale = await unbuiltSkills(root)
  if (stale.length) console.error(`the build is older than ${stale.length} skills: ${stale.join(', ')}`)
}
