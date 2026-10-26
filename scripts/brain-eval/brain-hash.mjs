#!/usr/bin/env node
// Which brain a result tested. Every eval result carries this hash and the gate refuses one whose hash is
// not the working tree's, so a score can never be carried over to a brain it did not test. It reads the
// built package (packages/shared/dist), because that is what an agent receives: the skills, the doctrine
// on both surfaces, the MCP instructions and the router notice. A build that is served its brain
// (shared/src/skills/served.ts) is handed the brain folder first, every tier open, so it hashes exactly as a
// build that embedded the same files did: the approved hash still names the same brain after the move.
//
//   node scripts/brain-eval/brain-hash.mjs [<slates-mcp checkout>] [--brain <dir>]   prints the hash and any skill the build is older than
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brainDir, readAllSkills, readSkillDir } from '../brain-source.mjs'

/** The build at `root`, holding `brain` when it is served one; `skills` is every file it hands an agent. */
async function shared(root, brain) {
  const mod = await import(pathToFileURL(join(resolve(root), 'packages', 'shared', 'dist', 'index.js')).href)
  if (!mod.useBrainSource) return { ...mod, skills: mod.SKILLS, served: false }
  if (!brain) throw new Error(`${root} is served its brain; name the brain folder (--brain or SLATES_BRAIN_DIR)`)
  mod.useBrainSource(brain)
  return { ...mod, skills: mod.brainFiles(), served: true }
}

/** sha256 of what the build at `root` hands an agent, first 16 hex characters. */
export async function brainHash(root, { brain = brainDir() } = {}) {
  const { skills, buildAgentDoctrine, buildMcpInstructions, ROUTER_NOTICE } = await shared(root, brain)
  const h = createHash('sha256')
  // Each part is named and NUL-separated, so moving text from one part to the next changes the hash.
  const part = (name, text) => h.update(`${name}\0${text}\0`)
  for (const name of Object.keys(skills).sort()) part(`skill:${name}`, skills[name])
  part('doctrine:desktop', buildAgentDoctrine({ surface: 'desktop' }))
  part('doctrine:mcp', buildAgentDoctrine({ surface: 'mcp' }))
  part('mcp-instructions', buildMcpInstructions())
  part('router-notice', ROUTER_NOTICE)
  return h.digest('hex').slice(0, 16)
}

/**
 * The skills whose markdown differs from the build at `root` (added, removed or edited since the last
 * `npm run build`). While any does, the hash names the build, not the skills on disk. A served build reads the
 * brain folder live, so only the card and router can be older than it.
 */
export async function unbuiltSkills(root, { brain = brainDir() } = {}) {
  const { skills, served } = await shared(root, brain)
  const publicDir = join(resolve(root), 'packages', 'shared', 'skills')
  const onDisk = served ? readAllSkills({ dir: brain, publicDir }) : readSkillDir(publicDir)
  return [...new Set([...Object.keys(onDisk), ...Object.keys(skills)])].filter((n) => onDisk[n] !== skills[n]).sort()
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--brain')
  const brain = at >= 0 ? resolve(args.splice(at, 2)[1]) : brainDir()
  const root = resolve(args[0] ?? join(import.meta.dirname, '..', '..'))
  console.log(await brainHash(root, { brain }))
  const stale = await unbuiltSkills(root, { brain })
  if (stale.length) console.error(`the build is older than ${stale.length} skills: ${stale.join(', ')}`)
}
