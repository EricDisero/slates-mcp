// Stage a self-contained directory for `mcpb pack` (Claude Desktop one-click
// .mcpb bundle). The bundle must run `node dist/server.js` with zero ambient
// setup, so we assemble:
//
//   dist-mcpb/staging/
//     manifest.json          ← copied from package root (version synced)
//     dist/                  ← this package's build output
//     node_modules/          ← prod deps, with @slatesvideo/shared installed
//                              from a freshly-packed workspace tarball (the
//                              registry copy may lag the workspace)
//
// Invoked by `npm run build:mcpb`, which then runs:
//   mcpb pack dist-mcpb/staging dist-mcpb/slates.mcpb

import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const sharedRoot = join(pkgRoot, '..', 'shared')
const outRoot = join(pkgRoot, 'dist-mcpb')
const staging = join(outRoot, 'staging')

const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))

if (!existsSync(join(pkgRoot, 'dist', 'server.js'))) {
  console.error('[stage-mcpb] packages/mcp/dist/server.js missing — run the build first.')
  process.exit(1)
}
if (!existsSync(join(sharedRoot, 'dist', 'index.js'))) {
  console.error('[stage-mcpb] packages/shared/dist missing — run `npm run build` at the repo root first.')
  process.exit(1)
}

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })

// 1. Pack the workspace @slatesvideo/shared into a tarball so the staged
//    install gets THIS tree's shared code, not whatever npm has published.
const packOut = execSync(`npm pack "${sharedRoot}" --pack-destination "${outRoot}"`, {
  cwd: pkgRoot,
  encoding: 'utf8',
})
const tgzName = packOut.trim().split('\n').pop().trim()
if (!tgzName.endsWith('.tgz')) {
  console.error(`[stage-mcpb] unexpected npm pack output: ${packOut}`)
  process.exit(1)
}

// 2. Minimal package.json for the staged install — same prod deps as the
//    real package, with shared swapped for the local tarball.
const stagedDeps = { ...pkg.dependencies, '@slatesvideo/shared': `file:../${tgzName}` }
writeFileSync(
  join(staging, 'package.json'),
  JSON.stringify(
    {
      name: 'slates-mcpb-staging',
      private: true,
      version: pkg.version,
      type: 'module',
      main: 'dist/server.js',
      dependencies: stagedDeps,
    },
    null,
    2
  ) + '\n'
)

console.log('[stage-mcpb] installing prod dependencies into staging...')
execSync('npm install --omit=dev --no-audit --no-fund --no-package-lock --install-links', {
  cwd: staging,
  stdio: 'inherit',
})

// 3. Server build + manifest (version synced from package.json so the
//    bundle can never drift from the npm version).
cpSync(join(pkgRoot, 'dist'), join(staging, 'dist'), { recursive: true })
const manifest = JSON.parse(readFileSync(join(pkgRoot, 'manifest.json'), 'utf8'))
manifest.version = pkg.version

// 🚨 KEYWORDS AND THE ROSTER SENTENCE ARE GENERATED FROM MODEL_FACTS. The
// hand-typed list omitted ltx, gpt-image, minimax-h3-max and seedream, and the
// description named a 2026-07 roster — this file is what a Claude Desktop user
// SEARCHES, so a missing keyword is a model nobody finds. Same rule as the
// READMEs: never hand-type a fact the build already knows.
{
  const shared = await import(
    pathToFileURL(join(pkgRoot, '..', 'shared', 'dist', 'index.js')).href
  )
  const { MODEL_FACTS, ALL_OPERATIONS, VIDEO_MODELS, IMAGE_MODELS } = shared
  // One keyword per model FAMILY: the searchable half of the id, deduped and in
  // registry order so the manifest is byte-stable across builds.
  const family = (id) => id.replace(/[-.]\d.*$/, '').replace(/-(pro|std|lite|max|fast|standard)$/, '')
  const modelKeywords = [...new Set([...VIDEO_MODELS, ...IMAGE_MODELS].map(family))]
  const BASE = ['slates', 'ai-video', 'video-generation', 'image-generation', 'storyboard']
  manifest.keywords = [...BASE, ...modelKeywords.filter((k) => !BASE.includes(k))]
  const label = (id) => MODEL_FACTS.find((f) => f.id === id)?.label ?? id
  manifest.description =
    `Drive the Slates AI Video Creation Studio from your AI client: projects, characters, storyboards, ` +
    `image and video generation, timeline assembly and MP4 export — files land on disk via the Slates ` +
    `desktop app. ${ALL_OPERATIONS.length} tools. Video: ${VIDEO_MODELS.map(label).join(', ')}. ` +
    `Images: ${IMAGE_MODELS.map(label).join(', ')}.`
}

writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`[stage-mcpb] staged at ${staging} (shared from ${tgzName})`)
