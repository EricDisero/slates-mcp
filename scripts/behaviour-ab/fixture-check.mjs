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
import { brainDir, servedTiers } from '../brain-source.mjs'

const repo = resolve(import.meta.dirname, '..', '..')
const sharedDir = resolve(arg('shared', join(repo, 'packages', 'shared')))
const desktopDir = resolve(arg('desktop', process.env.SLATES_DESKTOP_DIR ?? join(repo, '..', 'slate')))

const fixture = await startFixture({ desktopDir, cloudToken: realCloudToken() })
Object.assign(process.env, armHome(mkdtempSync(join(tmpdir(), 'slates-ab-check-')), fixture.port))
const shared = await import(pathToFileURL(join(sharedDir, 'dist', 'index.js')).href)

const { P1, SB1, SC1, shots, assets } = FIXTURE_IDS
const NO_TIMELINE = '7e1e0000-0000-4000-8000-0000000000ff'
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
  slates_get_spend_limits: { projectId: P1 },
  slates_get_asset_transcript: { projectId: P1, assetId: 'VID-V1' },
  slates_get_subject_mask: { projectId: P1, assetId: 'VID-V1' },
  slates_get_beat_grid: { projectId: P1, assetId: 'AUD-S1' },
  slates_get_whip_pans: { projectId: P1, assetId: 'VID-V1' },
  slates_get_variants: { projectId: P1, timelineId: NO_TIMELINE },
  slates_get_recipe: { recipe: 'ritual-15s-hook__r-ab12cd34ef' },
  slates_get_reframe_report: { projectId: P1, timelineId: NO_TIMELINE, aspect: '9x16' },
  slates_get_review_packet: { projectId: P1 },
  slates_get_client_ad_report: { platform: 'google' },
  slates_list_v2v_passes: { projectId: P1, timelineId: NO_TIMELINE },
  slates_get_timeline_loudness: { projectId: P1 },
  slates_get_script_uses: { sectionId: '5ec70000-0000-4000-8000-000000000001' },
  slates_quote_draft_finish: { projectId: P1, assetId: 'VID-V1', resolution: '1080p' },
  slates_get_cut_draft_status: { projectId: P1, timelineId: NO_TIMELINE, quoteId: 'fixture-quote' },
  slates_get_generation_status: { generationId: '6e0e0000-0000-4000-8000-000000000001' },
  // Not modelled (a real analysis run, a live web fetch): see UNMODELLED.
  slates_get_reference_breakdown: { projectId: P1, assetId: 'VID-V1' },
  slates_get_product_page: { url: 'https://ritual.coffee/products/cold-brew' },
  slates_get_template: { path: 'C:\\Users\\user\\Slates Templates\\cold-brew.slatestemplate' },
}

// The fixture project has no other timeline, no export, Draft take or template, and none of its files is on this
// machine, so these ops get slate's own refusal (fixture-routes.mjs) with the status slate's agent server sends for it.
// That refusal is the route working: each op here must throw it, and an answer or any other error fails.
const REFUSALS = {
  slates_get_variants: [500, /Timeline is outside this project/],
  slates_get_reframe_report: [500, /Timeline is outside this project/],
  slates_list_v2v_passes: [400, /Timeline not found/],
  slates_get_timeline_loudness: [500, /The timeline is empty/],
  slates_quote_draft_finish: [500, /Choose a take generated in Draft mode/],
  slates_get_cut_draft_status: [500, /This finish is outside this cut or app session/],
  slates_get_template: [400, /Template not found/],
  slates_get_subject_mask: [500, /The clip's media file is missing/],
}
// The two reads the fixture leaves out on purpose (README.md): only these ops may meet its "Not in the A/B fixture"
// 404, and only on their own route. Any other op meeting it lost a route the fixture models.
const UNMODELLED = {
  slates_get_reference_breakdown: '/agent/reference/breakdown',
  slates_get_product_page: '/agent/library/intake',
}
/** The status and text of a desktop route's refusal, read off the desktop client's error (clients/desktop.ts). */
const refusal = (error) => {
  const message = String(error?.message ?? error).replace(/\s+/g, ' ')
  const [, status, detail] = /failed \((\d{3})\): (.*)$/.exec(message) ?? []
  return { message, status: status ? Number(status) : null, detail: detail ?? message }
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
  let result
  try {
    result = await op.run(parsed.data, shared.defaultContext())
  } catch (error) {
    const { message, status, detail } = refusal(error)
    const want = REFUSALS[op.id]
    if (want) {
      const ok = status === want[0] && want[1].test(detail)
      if (!ok) failed++
      console.log(`  ${ok ? 'ok' : '!!'}  ${op.id}: ${ok ? 'refused as slate does' : `should be refused ${want[0]} ${want[1]}, got`}: ${message.slice(0, 140)}`)
      continue
    }
    const gap = status === 404 && detail === `Not in the A/B fixture: ${UNMODELLED[op.id]}`
    if (!gap) failed++
    console.log(`  ${gap ? '..' : '!!'}  ${op.id}: ${message.slice(0, 160)}`)
    continue
  }
  const text = (result?.text ?? JSON.stringify(result?.data ?? result) ?? '').replace(/\s+/g, ' ')
  if (REFUSALS[op.id]) {
    failed++
    console.log(`  !!  ${op.id}: should be refused ${REFUSALS[op.id][0]} ${REFUSALS[op.id][1]}, answered: ${text.slice(0, 120)}`)
    continue
  }
  console.log(`  ok  ${op.id}: ${text.slice(0, 140)}`)
}
const run = (id, input) => {
  const op = shared.ALL_OPERATIONS.find((o) => o.id === id)
  return op.run(op.input.parse(input), shared.defaultContext())
}
const report = (area, checks) => {
  for (const [what, ok] of checks) {
    if (!ok) failed++
    console.log(`  ${ok ? 'ok' : '!!'}  ${area}: ${what}`)
  }
}
/** A route's answer straight off the fixture: its status and body. */
const get = async (path, query = {}) => {
  const res = await fetch(`http://127.0.0.1:${fixture.port}${path}?${new URLSearchParams(query)}`)
  return { status: res.status, body: await res.json() }
}
/** The op's refusal, or null when it answered. */
const refused = async (id, input) => {
  try {
    await run(id, input)
    return null
  } catch (error) {
    return refusal(error)
  }
}
// Ids: one missing or naming nothing is the caller's to fix, 400, as slate's agent server answers (require-ids.ts).
{
  const spend = await get('/agent/spend-limits', { projectId: 'bogus' })
  const project = await get('/agent/projects/get', { id: 'bogus' })
  const noProject = await get('/agent/projects/get')
  const storyboard = await get('/agent/storyboards/get', { id: 'bogus' })
  const asset = await get('/agent/assets/get', { id: 'bogus' })
  const review = await get('/agent/review/packet', { projectId: 'bogus' })
  report('ids', [
    ['an unknown project on spend limits is 400', spend.status === 400 && /^No project bogus\./.test(spend.body.error)],
    ['an unknown project is 400', project.status === 400 && /^No project bogus\./.test(project.body.error)],
    ['a missing project id is 400', noProject.status === 400 && /^projectId is required/.test(noProject.body.error)],
    ['an unknown storyboard is 400', storyboard.status === 400 && /^No storyboard bogus\./.test(storyboard.body.error)],
    ['an unknown asset is 400', asset.status === 400 && asset.body.error === 'Asset not found: bogus'],
    ['an unknown project on the review packet is 400', review.status === 400 && /^No project bogus\./.test(review.body.error)],
  ])
}
// Visual QA: the timeline id an answer gives is the project's own cut, and naming it reads the same runs.
{
  const first = await get('/agent/timeline/visual-qa/runs', { projectId: P1 })
  const again = await get('/agent/timeline/visual-qa/runs', { projectId: P1, timelineId: first.body.timelineId ?? '' })
  const other = await get('/agent/timeline/visual-qa/runs', { projectId: P1, timelineId: NO_TIMELINE })
  report('visual QA', [
    ["without a timeline, the project's cut", first.status === 200 && typeof first.body.timelineId === 'string' && Array.isArray(first.body.runs)],
    ['naming that cut reads it again', again.status === 200 && again.body.timelineId === first.body.timelineId],
    ['another timeline is outside the project', other.status === 500 && other.body.error === 'Timeline is outside this project'],
  ])
  // That cut is empty: its variant set has no slots and its reframe report no clips, at slate's delivery size.
  const cut = { projectId: P1, timelineId: first.body.timelineId ?? '' }
  const variants = await get('/agent/timeline/variants', cut)
  const grid = await get('/agent/timeline/variants', { ...cut, grid: 'true' })
  const reframe = await get('/agent/timeline/reframe-report', { ...cut, aspect: '9x16' })
  const badAspect = await get('/agent/timeline/reframe-report', { ...cut, aspect: '9:16' })
  report('the empty cut', [
    ['its variant set is empty', variants.status === 200 && variants.body.slots?.length === 0 && variants.body.variants?.length === 0],
    ['its grid asks for a slot first', grid.status >= 400 && /no slots yet/.test(grid.body.error)],
    ['its reframe report is 1080x1920 with no clips', reframe.status === 200 && reframe.body.size?.width === 1080 && reframe.body.size?.height === 1920 && reframe.body.clips?.length === 0],
    ['an unknown aspect is refused', badAspect.status >= 400 && /Unknown delivery aspect/.test(badAspect.body.error)],
  ])
}
// Subject masks: a mask id alone is looked up across the project, and a video's file must be here before its masks.
{
  const byMask = await refused('slates_get_subject_mask', { projectId: P1, maskId: 'mask-1' })
  const still = await refused('slates_get_subject_mask', { projectId: P1, assetId: 'IMG-A1' })
  const video = await refused('slates_get_subject_mask', { projectId: P1, assetId: 'VID-V1' })
  const none = await get('/agent/timeline/masks', { projectId: P1 })
  report('subject masks', [
    ['a mask id alone is looked up in the project', byMask?.status === 400 && byMask.detail === 'No subject mask mask-1 in this project'],
    ['a picture has no masks', still?.status === 500 && still.detail === 'The subject mask works on video clips'],
    ['a video whose file is missing is refused', video?.status === 500 && video.detail === "The clip's media file is missing"],
    ['naming nothing asks for a mask, a file or a clip', none.status === 500 && /^Name the mask \(maskId\)/.test(none.body.error)],
  ])
}
// The captions case's reads: Mara's line and the voiceover come back as timed words, a picture as not transcribed,
// and the motion block library lists the caption styles when asked for components.
{
  // Words that spell the line, each starting before it ends and no earlier than the one before it ended.
  const timed = (transcript, line) => {
    const list = transcript?.words ?? []
    return transcript?.text === line && list.length > 0 && list.map((w) => w.text).join(' ') === line &&
      list.every((w, i) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.start < w.end && (i === 0 || list[i - 1].end <= w.start))
  }
  const words = async (assetId) => (await run('slates_get_asset_transcript', { projectId: P1, assetId })).data
  const mara = await words('VID-V1')
  const vo = await words('AUD-S1')
  const still = await words('IMG-A1')
  const captions = (await run('slates_list_motion_blocks', { type: 'component', query: 'caption' })).text
  const blocks = (await run('slates_list_motion_blocks', { query: 'lower third' })).text
  const checks = [
    ["Mara's take VID-V1 holds her hook line, word by word in order", timed(mara?.transcript, "Your morning coffee shouldn't taste like a punishment.")],
    ['the voiceover AUD-S1 holds its line, word by word in order', timed(vo?.transcript, 'Your morning, minus the bitterness.')],
    ['a picture is not transcribed yet', still?.transcript === null && /Not transcribed yet/.test(still.hint)],
    ['caption styles list as components', /^4 registry items/.test(captions) && captions.includes('caption-pill-karaoke (component)')],
    ['a lower third search reaches the details', /^2 registry items/.test(blocks) && blocks.includes('yt-lower-third (block)')],
  ]
  report('captions case', checks)
}
// White label (slate/.claude/rules/white-label.md): no served registry text, raw or as the op prints it, names a
// vendor or a library the blocks are built with.
{
  const VENDOR = /hyper\s*-?\s*frames?|heygen|three[\s.-]?js|webgl|gsap|greensock|lottie|remotion|pixi|babylon|anime\.?js|\bd3\b|p5\.?js|tailwind|react/i
  const served = []
  for (const type of ['block', 'component', 'example']) {
    served.push(JSON.stringify((await get('/agent/compositions/registry', { type })).body.items))
    served.push((await run('slates_list_motion_blocks', { type })).text)
  }
  const hit = served.join('\n').match(VENDOR)
  report('white label', [[`the motion block library names no vendor or library${hit ? ` (found "${hit[0]}")` : ''}`, !hit]])
}
// A build that is served its brain (shared/src/skills/served.ts) fetches it from the fixture, as a member's does.
if (shared.servedBrain) {
  const guide = shared.ALL_OPERATIONS.find((op) => op.id === 'slates_get_prompting_guide')
  const result = await guide.run(guide.input.parse({ topic: 'slates-cuts', depth: 'full' }), shared.defaultContext())
  const brain = shared.servedBrain()
  const served = brain.source === 'server' && Object.hasOwn(brain.files, 'slates-cuts') && result.text.length > 1000
  if (!served) failed++
  console.log(`  ${served ? 'ok' : '!!'}  brain: ${Object.keys(brain.files).length} files over /brain/bundle (${brain.source}${brain.problem ? `: ${brain.problem}` : ''})`)
}
// --brain-tiers license: the bump playbooks come back locked, each with the server's own notice.
{
  const licenseOnly = await startFixture({ desktopDir, priceList: { models: [] }, brainTiers: ['license'] })
  const bundle = await (await fetch(`http://127.0.0.1:${licenseOnly.port}/brain/bundle`)).json()
  await licenseOnly.close()
  const tiers = servedTiers(brainDir())
  const ok = bundle.tiers.join() === 'license' && bundle.locked.map((x) => x.name).sort().join() === [...tiers.bump].sort().join() &&
    bundle.locked.every((x) => !Object.hasOwn(bundle.files, x.name) && x.notice.includes(tiers.TIER_NAMES.bump))
  if (!ok) failed++
  console.log(`  ${ok ? 'ok' : '!!'}  license-only: ${bundle.locked.length} bump playbooks locked with the server's notice`)
}
const missing = [...new Set(fixture.requests.filter((r) => r.status === 404).map((r) => r.path))]
// A 404 off any other route is a modelled route gone, even where an op swallowed the error into its answer.
const lost = missing.filter((path) => !Object.values(UNMODELLED).includes(path))
if (lost.length) {
  failed++
  console.log(`  !!  routes the fixture models answered 404: ${lost.join(', ')}`)
}
console.log(`\n${ops.length} read-only ops, ${failed} unexpected errors; price list ${fixture.priceListSize} rows; routes the fixture lacks: ${missing.join(', ') || 'none'}`)
await fixture.close()
process.exit(failed ? 1 : 0)
