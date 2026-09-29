// The official MCP Registry entry, `packages/mcp/server.json`, must match the
// npm package it lists. The registry verifies `name` against the published
// package's `mcpName`, and the two `version` fields are what it records, so a
// release that bumps package.json and forgets this file publishes a stale entry
// or fails `mcp-publisher publish`. Schema limits: description at most 100
// characters (server.schema.json 2025-12-11).
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../packages/mcp/package.json', import.meta.url), 'utf8'))
const server = JSON.parse(readFileSync(new URL('../packages/mcp/server.json', import.meta.url), 'utf8'))
const npm = (server.packages ?? []).find((p) => p.registryType === 'npm')

const failures = []
const expect = (ok, message) => { if (!ok) failures.push(message) }

expect(server.name === pkg.mcpName, `server.json name "${server.name}" ≠ package.json mcpName "${pkg.mcpName}"`)
expect(server.version === pkg.version, `server.json version ${server.version} ≠ package.json ${pkg.version}`)
expect(npm?.identifier === pkg.name, `server.json npm identifier "${npm?.identifier}" ≠ package name "${pkg.name}"`)
expect(npm?.version === pkg.version, `server.json npm package version ${npm?.version} ≠ package.json ${pkg.version}`)
expect(typeof server.description === 'string' && server.description.length >= 1 && server.description.length <= 100,
  `server.json description is ${server.description?.length ?? 0} characters; the registry allows 1-100`)

if (failures.length) {
  console.error('server-json-check FAILED:\n' + failures.map((f) => '  ✗ ' + f).join('\n'))
  process.exit(1)
}
console.log(`server-json-check: ${server.name} ${server.version} matches @slatesvideo/mcp-server`)
