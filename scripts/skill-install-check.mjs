import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SKILLS, parseSkillMetadata, ALL_OPERATIONS } from '../packages/shared/dist/index.js'
import { runInstallSkills, inspectSkillInstallation, skillInstallTargets } from '../packages/cli/dist/commands/install-skills.js'
import { loadTypeScriptModule } from './load-typescript.mjs'

const markdown = (name, description) => `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n# Fixture\n`
const quoted = markdown('slates-fixture', 'An image: "quoted" and literal # signs.')
assert.deepEqual(parseSkillMetadata(quoted.replace(/\n/g, '\r\n'), 'slates-fixture'), {
  name: 'slates-fixture', description: 'An image: "quoted" and literal # signs.',
})
assert.equal(parseSkillMetadata('---\nname: slates-fixture\ndescription: >-\n  First line\n  second line\n---\n').description, 'First line second line')
assert.equal(parseSkillMetadata(markdown('slates-fixture', 'x'.repeat(1024))).description.length, 1024)
for (const [content, expected] of [
  ['# No metadata', /missing YAML/],
  ['---\nname: slates-fixture\n---\n', /description/],
  ['---\nname: slates-fixture\ndescription: true\n---\n', /description/],
  [markdown('../escape', 'unsafe'), /name must/],
  [markdown('slates-fixture', 'x'.repeat(1025)), /1024/],
  ['---\nname: slates-fixture\ndescription: one\ndescription: two\n---\n', /invalid YAML/],
  ['---\nname: slates-fixture\ndescription: invalid: mapping\n---\n', /invalid YAML/],
]) assert.throws(() => parseSkillMetadata(content), expected)
assert.throws(() => parseSkillMetadata(quoted, 'slates-other'), /must match/)
for (const [key, content] of Object.entries(SKILLS)) parseSkillMetadata(content, key)
const sourceParser = loadTypeScriptModule(new URL('../packages/shared/src/skills/metadata.ts', import.meta.url)).parseSkillMetadata
assert.deepEqual(sourceParser(quoted, 'slates-fixture'), parseSkillMetadata(quoted, 'slates-fixture'))

// Explicit fixture paths prevent any access to the caller's project or personal configuration.
const fixture = mkdtempSync(join(tmpdir(), 'slates-skill-install-'))
const cwd = join(fixture, 'project')
const home = join(fixture, 'home')
const skills = { 'slates-fixture': quoted, 'slates-second': markdown('slates-second', 'Another task') }
const environment = { cwd, home, skills, log: () => {} }
const claude = skillInstallTargets('claude', cwd)[0].path
const codex = skillInstallTargets('codex', cwd)[0].path
mkdirSync(claude, { recursive: true })
const legacy = join(claude, 'slates-fixture.md')
const unrelated = join(claude, 'my-notes.md')
writeFileSync(legacy, 'old copy')
writeFileSync(unrelated, 'personal notes')
runInstallSkills({}, environment)
for (const target of [claude, codex]) {
  for (const [name, content] of Object.entries(skills)) {
    assert.equal(readFileSync(join(target, name, 'SKILL.md'), 'utf8'), content)
  }
  assert.deepEqual(inspectSkillInstallation([target], skills), { installed: 2, missing: [], stale: [], duplicates: [] })
}
assert.equal(readFileSync(legacy, 'utf8'), 'old copy')
assert.equal(readFileSync(unrelated, 'utf8'), 'personal notes')
writeFileSync(join(codex, 'slates-fixture', 'SKILL.md'), 'outdated')
assert.deepEqual(inspectSkillInstallation([codex], skills).stale, ['slates-fixture'])
runInstallSkills({ client: 'codex' }, environment)
assert.deepEqual(inspectSkillInstallation([codex], skills).stale, [])
runInstallSkills({ client: 'codex', global: true }, environment)
const globalCodex = skillInstallTargets('codex', home)[0].path
assert.deepEqual(inspectSkillInstallation([join(fixture, 'empty'), globalCodex], skills), { installed: 2, missing: [], stale: [], duplicates: [] })
assert.equal(existsSync(skillInstallTargets('claude', home)[0].path), false)
assert.deepEqual(inspectSkillInstallation([codex, globalCodex], skills).duplicates, ['slates-fixture', 'slates-second'])
writeFileSync(join(globalCodex, 'slates-fixture', 'SKILL.md'), 'stale global copy')
assert.deepEqual(inspectSkillInstallation([codex, globalCodex], skills).stale, ['slates-fixture'])
const invalidProject = join(fixture, 'invalid-project')
assert.throws(() => runInstallSkills({}, { ...environment, cwd: invalidProject, skills: { 'slates-fixture': markdown('../escape', 'bad') } }), /name must/)
assert.equal(existsSync(invalidProject), false)
for (const client of ['unknown', 'constructor', 'toString']) {
  assert.throws(() => skillInstallTargets(client, invalidProject), /Unknown skill client/)
}
console.log(`skill-install: ${Object.keys(SKILLS).length} portable frontmatters, strict metadata failures, both client layouts, scoped updates, global fallback and preserved user files passed; fixtures: ${fixture}`)

// Search regressions are pure: no operation run function or transport is called.
const { searchTerms } = loadTypeScriptModule(new URL('../packages/shared/src/prompts/search-terms.ts', import.meta.url))
const { searchTools } = loadTypeScriptModule(new URL('../packages/shared/src/operations/surface.ts', import.meta.url))
assert.deepEqual(searchTerms('Animate THESE photos, please'), ['animate', 'photo'])
assert.equal(searchTools([{ id: 'slates_read', description: 'Read notes' }], 'ad').length, 0)
assert.equal(searchTools(ALL_OPERATIONS, 'the a to please').length, 0)
for (const [query, expected] of [['animate these photos', 'slates_generate_video'], ['make a film', 'slates_generate_from_shots']]) {
  const matches = searchTools(ALL_OPERATIONS, query)
  assert.ok(matches.slice(0, 3).some(({ op }) => op.id === expected), `${query} should discover ${expected}`)
  assert.ok(matches.length <= 10)
  for (const { op } of matches) assert.equal(op, ALL_OPERATIONS.find(candidate => candidate.id === op.id))
}
const { guideCatalog, discoverGuides } = loadTypeScriptModule(new URL('../packages/shared/src/prompts/guide-discovery.ts', import.meta.url))
const skillsDirectory = new URL('../packages/shared/skills/', import.meta.url)
const sourceSkills = Object.fromEntries(readdirSync(skillsDirectory).filter(name => name.endsWith('.md')).map(name => [name.slice(0, -3), readFileSync(new URL(name, skillsDirectory), 'utf8')]))
for (const [query, expected] of [['animate these photos', 'slates-model-selection'], ['Make a 30 second movie with two friends at a rainy diner', 'slates-one-prompt-film'], ['older male voiceover', 'slates-prompting-inworld-tts'], ['skincare product ad with a human presenter', 'slates-direct-response-ad']]) {
  assert.ok(discoverGuides(guideCatalog(sourceSkills), sourceSkills, query).guides.slice(0, 3).some(guide => guide.name === expected), `${query} should discover ${expected}`)
}
const sourceOps = readFileSync(new URL('../packages/shared/src/operations/index.ts', import.meta.url), 'utf8')
assert.match(sourceOps, /current Final Cut Pro requires FCPXML/)
console.log('task-search: word boundaries, filler removal, bounded results, unchanged operation identity, photo animation, voice direction and product ad guide discovery passed')

const sourceRegistry = loadTypeScriptModule(new URL('../packages/shared/src/operations/index.ts', import.meta.url))
const noTransport = { desktop: () => { throw new Error('discovery must not reach desktop') }, cloud: () => { throw new Error('discovery must not reach cloud') } }
const discovered = (await sourceRegistry.loadTools.run({ query: 'animate these photos' }, noTransport)).data.matches
assert.ok(discovered.slice(0, 3).some(match => match.name === 'slates_generate_video'))
for (const match of discovered) {
  const op = sourceRegistry.ALL_OPERATIONS.find(candidate => candidate.id === match.name)
  assert.deepEqual(match.annotations, op.annotations)
  assert.equal(match.billable, !!op.billable)
}
const loaded = (await sourceRegistry.loadTools.run({ names: ['slates_generate_video'] }, noTransport)).data.tools
assert.equal(loaded.length, 1)
assert.equal(loaded[0].name, 'slates_generate_video')
assert.deepEqual(loaded[0].annotations, sourceRegistry.ALL_OPERATIONS.find(op => op.id === loaded[0].name).annotations)
await assert.rejects(sourceRegistry.loadTools.run({ names: ['slates_missing_fixture'] }, noTransport), /Unknown operation/)
console.log('tool-discovery: mocked registry queries and exact-schema loads preserve billable/permission annotations and never reach transports')

const { inspectCodexMcpConfig, CODEX_MCP_SETUP } = loadTypeScriptModule(new URL('../packages/cli/src/commands/mcp-config.ts', import.meta.url))
assert.equal(CODEX_MCP_SETUP, 'codex mcp add slates -- npx -y @slatesvideo/mcp-server')
const codexHome = join(fixture, 'custom-codex')
mkdirSync(codexHome, { recursive: true })
const config = join(codexHome, 'config.toml')
writeFileSync(config, '# comment mentions slates\n[mcp_servers."slates"]\ncommand = "npx"\nargs = ["-y", "@slatesvideo/mcp-server"]\n')
const configBefore = readFileSync(config, 'utf8')
assert.equal(inspectCodexMcpConfig({ cwd, home, codexHome }).configured, true)
assert.equal(readFileSync(config, 'utf8'), configBefore, 'Codex config inspection is read-only')
writeFileSync(config, '# slates is mentioned, but no server is configured\nmodel = "example"\n')
assert.equal(inspectCodexMcpConfig({ cwd, home, codexHome }).configured, false)
writeFileSync(config, '[mcp_servers.slates]\ncommand = "npx"\nenabled = false\n')
assert.equal(inspectCodexMcpConfig({ cwd, home, codexHome }).disabled, true)
writeFileSync(config, '[invalid\n')
assert.deepEqual(inspectCodexMcpConfig({ cwd, home, codexHome }).invalid, [config])
const projectCodex = join(cwd, '.codex')
mkdirSync(projectCodex, { recursive: true })
writeFileSync(config, '[mcp_servers.slates]\ncommand = "npx"\n')
writeFileSync(join(projectCodex, 'config.toml'), '[mcp_servers.slates]\nenabled = false\n')
assert.equal(inspectCodexMcpConfig({ cwd, home, codexHome }).configured, false, 'project disabled state overrides the global entry')
console.log('Codex MCP config: quoted tables, comments, disabled overrides, custom CODEX_HOME, invalid TOML and read-only status passed')
