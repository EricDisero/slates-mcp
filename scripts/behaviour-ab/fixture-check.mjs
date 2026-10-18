// Runs every read-only op of one arm's built package against the fixture and
// prints the first line of each result, so a fixture route that returns the
// wrong shape shows up before a model run wastes a turn on it.
//
//   node scripts/behaviour-ab/fixture-check.mjs [--shared <path to packages/shared>] [--desktop <slate dir>]

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startFixture, FIXTURE_IDS } from './fixture.mjs'
import { armHome, realCloudToken } from './home.mjs'
import { arg } from './lib.mjs'

const repo = resolve(import.meta.dirname, '..', '..')
const sharedDir = resolve(arg('shared', join(repo, 'packages', 'shared')))
const desktopDir = resolve(arg('desktop', process.env.SLATES_DESKTOP_DIR ?? join(repo, '..', 'slate')))

const fixture = await startFixture({ desktopDir, cloudToken: realCloudToken() })
Object.assign(process.env, armHome(mkdtempSync(join(tmpdir(), 'slates-ab-check-')), fixture.port))
const shared = await import(pathToFileURL(join(sharedDir, 'dist', 'index.js')).href)

const { P1, SB1, SC1, shots, assets } = FIXTURE_IDS
const SAMPLE = {
  slates_get_project: { id: P1 },
  slates_get_project_directory: { id: P1 },
  slates_list_folders: { projectId: P1 },
  slates_list_pins: { projectId: P1 },
  slates_list_environments: { projectId: P1 },
  slates_list_timelines: { projectId: P1 },
  slates_list_styles: { projectId: P1 },
  slates_get_export_batch: { projectId: P1 },
  slates_get_variant_grid: { projectId: P1 },
  slates_get_board_progress: { projectId: P1 },
  slates_get_script_sections: { storyboardId: SB1 },
  slates_get_script_suggestions: { storyboardId: SB1 },
  slates_get_asset_image: { id: assets[0].id, projectId: P1 },
  slates_get_asset_video_frames: { id: assets[3].id, projectId: P1 },
  slates_get_assets_batch: { ids: [assets[0].id, assets[1].id], projectId: P1 },
  slates_get_timeline: { projectId: P1 },
  slates_get_workspace_state: { projectId: P1 },
  slates_list_assets: { projectId: P1 },
  slates_list_storyboards: { projectId: P1 },
  slates_get_storyboard_with_frames: { storyboardId: SB1 },
  slates_list_shots: { projectId: P1, storyboardId: SB1 },
  slates_get_shot: { shotId: shots[0].id },
  slates_get_shot_inputs: { projectId: P1, shotId: shots[0].id },
  slates_get_script: { sceneId: SC1 },
  slates_get_script_document: { storyboardId: SB1 },
  slates_list_library: { projectId: P1 },
  slates_list_characters: { projectId: P1 },
  slates_get_board_quote: { projectId: P1, storyboardId: SB1 },
  slates_get_prompting_guide: { topic: 'app-manual', query: 'aspect ratio' },
  slates_estimate_generation_cost: { model: 'kling-v3.0-std', duration: 5 },
  slates_get_asset: { assetId: 'IMG-A1', projectId: P1 },
}

// The Blender ops reach a real Blender on this machine, so the A/B removes them and this check skips them.
const ops = shared.ALL_OPERATIONS.filter((op) => !op.id.startsWith('slates_blender_') && shared.toolDefinitions([op], { surface: 'mcp' })[0]?.annotations?.readOnlyHint)
let failed = 0
for (const op of ops) {
  const input = SAMPLE[op.id] ?? {}
  // An input the sample does not fill is the sample's gap, not the fixture's: it never reaches a route.
  const parsed = op.input.safeParse(input)
  if (!parsed.success) {
    console.log(`  ..  ${op.id}: no sample input (${parsed.error.issues.map((i) => i.path.join('.')).join(', ')})`)
    continue
  }
  try {
    const result = await op.run(parsed.data, shared.defaultContext())
    const text = (result?.text ?? JSON.stringify(result?.data ?? result) ?? '').replace(/\s+/g, ' ')
    console.log(`  ok  ${op.id}: ${text.slice(0, 140)}`)
  } catch (error) {
    // Only the fixture's own refusal of a route it does not model is expected from a run.
    const message = String(error?.message ?? error).replace(/\s+/g, ' ')
    const expected = /not in the a\/b fixture/i.test(message)
    if (!expected) failed++
    console.log(`  ${expected ? '..' : '!!'}  ${op.id}: ${message.slice(0, 160)}`)
  }
}
const missing = [...new Set(fixture.requests.filter((r) => r.status === 404).map((r) => r.path))]
console.log(`\n${ops.length} read-only ops, ${failed} unexpected errors; price list ${fixture.priceListSize} rows; routes the fixture lacks: ${missing.join(', ') || 'none'}`)
await fixture.close()
process.exit(failed ? 1 : 0)
