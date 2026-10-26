// The served brain's cache and its clearing (packages/shared/src/skills/served.ts), against the TS sources with HOME
// in a temp folder: no login keeps nothing once the cache is gone, the cache names the credential that fetched it, a
// 401 deletes only the cache its own login wrote and keeps serving the desktop's, the minute's wait holds after it,
// and each sign-out deletes only its own login's cache. Needs tsx (slates-mcp has none of its own; slate's works):
//   ../slate/node_modules/.bin/tsx scripts/served-brain-check.mjs
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'slates-served-'))
process.env.HOME = home
process.env.USERPROFILE = home
delete process.env.SLATES_BRAIN_DIR
const agentDir = join(home, '.slates')
const cacheFile = join(agentDir, 'brain-cache.json')
mkdirSync(agentDir, { recursive: true })

const { MissingCloudTokenError, tokenHash } = await import('../packages/shared/src/auth.ts')
const { SlatesCloudClient } = await import('../packages/shared/src/clients/cloud.ts')
const { clearServedBrain, refreshServedBrain, servedBrain, useBrainSource } = await import('../packages/shared/src/skills/served.ts')

const CLI = 'slates_sk_cli'
const cliKey = tokenHash(CLI)
const connect = ({ cli = null, desktop = false }) =>
  writeFileSync(join(agentDir, 'agent-connection.json'), JSON.stringify({ cloud: { token: cli }, desktop: { enabled: desktop, port: desktop ? 1 : null, token: desktop ? 'd' : null } }))
const brain = (account) => ({ version: 'v1', tiers: ['license'], account, files: { 'slates-guide': `${account}'s guide` }, locked: [] })
const writeCache = (account, token) => writeFileSync(cacheFile, JSON.stringify({ ...brain(account), token }))
const cacheTag = () => JSON.parse(readFileSync(cacheFile, 'utf8')).token
let calls = 0
const serving = (account, credentialKey) => () => ({ credentialKey, get: async (path) => { calls++; return path === '/brain' ? { version: 'v1', tiers: ['license'], account } : brain(account) } })
const refusing = (credentialKey) => () => ({ credentialKey, get: async () => { calls++; throw Object.assign(new Error('Unauthorized'), { status: 401 }) } })
const noLogin = () => { throw new MissingCloudTokenError() }

// F1. No login, the desktop's cache served; then the cache goes (`slates logout`, a desktop sign-out): nothing stays.
connect({})
writeCache('u1', 'desktop-key')
assert.equal(useBrainSource().account, 'u1', 'setup: no login here serves the desktop cache')
rmSync(cacheFile)
assert.equal((await refreshServedBrain(noLogin, { force: true })).source, 'none', 'no login and no cache: the brain this process held goes')
assert.deepEqual(servedBrain().files, {})
writeCache('u2', 'desktop-key')
assert.equal((await refreshServedBrain(noLogin, { force: true })).account, 'u2', 'no login: a cache the desktop wrote since is served')

// F3. The cache is tagged with the credential that fetched it, not the CLI token in the connection file.
connect({ cli: CLI, desktop: true })
useBrainSource()
assert.equal(new SlatesCloudClient('desk-token').credentialKey, tokenHash('desk-token'), 'the cloud client names its own credential')
rmSync(cacheFile)
await refreshServedBrain(serving('u3', tokenHash('desk-token')), { force: true })
assert.equal(cacheTag(), tokenHash('desk-token'), 'the desktop tags its cache with its own credential')

// F3. A revoked CLI key: the desktop's cache stays on disk and is served; the minute's wait holds.
useBrainSource()
calls = 0
const after401 = await refreshServedBrain(refusing(cliKey), { force: true })
assert.ok(existsSync(cacheFile), "a 401 on the CLI key leaves the desktop's cache")
assert.equal(after401.account, 'u3', "with the desktop connected, its cache is served after the CLI key's 401")
await refreshServedBrain(refusing(cliKey))
assert.equal(calls, 1, 'after a 401 the next refresh waits a minute')

// The same 401 with the desktop gone: nothing served, the desktop's file still kept.
connect({ cli: CLI, desktop: false })
assert.equal((await refreshServedBrain(refusing(cliKey), { force: true })).source, 'none', 'no desktop connected: nothing served after a 401')
assert.ok(existsSync(cacheFile), "and the desktop's cache is still not this login's to delete")

// A 401 on the credential that wrote the cache deletes it.
connect({ cli: CLI, desktop: true })
writeCache('u4', cliKey)
useBrainSource()
assert.equal((await refreshServedBrain(refusing(cliKey), { force: true })).source, 'none', "a 401 drops its own login's brain")
assert.ok(!existsSync(cacheFile), 'a 401 deletes the cache its own login wrote')

// A cache deleted under a process whose brain is current is written back.
await refreshServedBrain(serving('u5', cliKey), { force: true })
rmSync(cacheFile)
await refreshServedBrain(serving('u5', cliKey), { force: true })
assert.ok(existsSync(cacheFile), 'a missing cache is written back on a current refresh')

// Sign-outs delete only their own login's cache.
writeCache('u6', 'desktop-key')
useBrainSource()
clearServedBrain('cli')
assert.ok(existsSync(cacheFile) && servedBrain().source === 'none', "`slates logout` keeps the desktop's cache and drops this process's brain")
writeCache('u6', cliKey)
clearServedBrain('cli')
assert.ok(!existsSync(cacheFile), '`slates logout` deletes the cache its login received')
writeCache('u7', cliKey)
clearServedBrain()
assert.ok(existsSync(cacheFile), "a desktop sign-out keeps the CLI login's cache")
for (const tag of ['desktop-key', null]) {
  writeCache('u7', tag)
  clearServedBrain()
  assert.ok(!existsSync(cacheFile), `a desktop sign-out deletes a cache tagged ${tag}`)
}

// F9. Owner-only on every write, a .tmp a crash left included (POSIX; Windows relies on the user-profile ACL).
if (process.platform !== 'win32') {
  writeFileSync(`${cacheFile}.tmp`, '{}', { mode: 0o644 })
  rmSync(cacheFile, { force: true })
  await refreshServedBrain(serving('u8', cliKey), { force: true })
  assert.equal(statSync(cacheFile).mode & 0o777, 0o600, 'the cache is owner-only after every write')
} else {
  console.log('served-brain: the owner-only mode check runs on POSIX only')
}

rmSync(home, { recursive: true, force: true })
console.log('served-brain: no login keeps nothing without a cache; the cache names its fetching credential; a 401 or a sign-out deletes only its own login\'s cache, and the desktop\'s is served after a CLI 401.')
