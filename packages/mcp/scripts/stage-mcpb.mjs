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
import { fileURLToPath } from 'node:url'

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
writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`[stage-mcpb] staged at ${staging} (shared from ${tgzName})`)
