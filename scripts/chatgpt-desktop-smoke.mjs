// Explicit live verification of a COMPLETED ChatGPT result. Never starts a new generation.
// Usage: node scripts/chatgpt-desktop-smoke.mjs <project UUID> <completed asset UUID>
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SlatesDesktopClient } from '../packages/shared/dist/clients/desktop.js'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const [projectId, assetId] = process.argv.slice(2)
assert.ok(projectId && assetId, 'Pass an existing project and completed ChatGPT asset UUID')
const desktop = new SlatesDesktopClient()
const before = (await desktop.get('/agent/assets', { projectId })).assets
const asset = before.find(a => a.id === assetId)
const requestId = asset?.settings?.externalGeneration?.receipt?.requestId
assert.ok(requestId, 'Asset must have a saved ChatGPT request receipt')
const row = await desktop.get('/agent/generation/status', { id: requestId })
assert.equal(row.generation?.status ?? row.status, 'completed', 'Only replay a completed request')
const client = new Client({ name: 'slates-chatgpt-desktop-smoke', version: '1.0.0' })
const transport = new StdioClientTransport({ command: process.execPath,
  args: [fileURLToPath(new URL('../packages/mcp/dist/server.js', import.meta.url)), '--tools=flat'], stderr: 'pipe' })
try {
  await client.connect(transport)
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args })
    assert.ok(!result.isError, JSON.stringify(result.content))
    return result.structuredContent
  }
  const status = await call('slates_get_chatgpt_status', {})
  assert.equal(status.connected, true)
  const replay = await call('slates_generate_chatgpt_image', { projectId, requestId,
    prompt: asset.prompt, referenceAssetIds: asset.settings.sourceAssetIds })
  assert.equal(replay.success, true)
  assert.equal(replay.assets[0].id, asset.id)
  assert.equal((await desktop.get('/agent/assets', { projectId })).assets.length, before.length)
  // External ingestion round trip: repair an earlier external result in place, never duplicate it.
  const external = before.find(a => a.settings?.externalGeneration && !a.settings.externalGeneration.receipt)
  if (external) {
    const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
    const originalHash = hash(external.filePath)
    const repaired = await call('slates_save_external_image', { projectId, assetId: external.id,
      prompt: external.prompt, generator: external.settings.externalGeneration.generator,
      referenceAssetIds: external.settings.sourceAssetIds,
      requestedSettings: external.settings.externalGeneration.requestedSettings })
    assert.equal(repaired.asset.id, external.id)
    assert.equal(repaired.asset.prompt, external.prompt)
    assert.deepEqual(repaired.asset.sourceAssetIds, external.sourceAssetIds)
    assert.equal(hash(repaired.asset.filePath), originalHash)
  }
  const prompt = await client.getPrompt({ name: 'slates-chatgpt-images' })
  assert.ok(JSON.stringify(prompt).includes('slates_generate_chatgpt_image'))
  console.log(JSON.stringify({ verified: true, code: asset.code, dimensions: [asset.width, asset.height], references: asset.sourceAssetIds.length,
    exactPrompt: asset.prompt, requestId, duplicateAssets: 0, externalRepair: !!external, skillPrompt: true }, null, 2))
} finally { await client.close() }
