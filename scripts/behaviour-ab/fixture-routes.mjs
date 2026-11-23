// The fixture's desktop reads beyond the board and its media (fixture.mjs holds those): transcripts, the motion block
// library, spend limits, the analysis reads (beats, whip pans, subject masks), the cut's reads, review, ads and
// diagnostics. Each answers as slate's own route does for the fixture project, which has no timeline, no export, no
// analysis run and no ad account: an empty answer where the route gives one, else the route's own error, with the
// status slate's agent server picks for it. Every handler names its source in slate/src/main/agent/.

import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join } from 'node:path'

/**
 * The fixture's errors, with the status slate's agent server sends for each (src/main/agent/server.ts): 400 when the
 * caller is at fault, else 500, decided by slate's own classifier in src/shared/telemetryScrub.ts, read from the
 * desktop checkout so the two cannot drift. `reason` is the tag slate's id checks put on their errors
 * (src/main/agent/require-ids.ts: `missing_id`, `unknown_id`), which wins over the text as it does in slate. A desktop
 * from before the tags answered 400 only for text `errorClass` reads as `invalid_input`, and so does this.
 */
export async function agentErrors(desktopDir) {
  const scrub = await importTs(join(desktopDir, 'src', 'shared', 'telemetryScrub.ts'))
  const status = scrub.agentFailureReason
    ? (error) => (scrub.isCallerFault(scrub.agentFailureReason(error)) ? 400 : 500)
    : (error) => (scrub.errorClass(error.message) === 'invalid_input' ? 400 : 500)
  return (message, reason) => {
    const error = Object.assign(new Error(message), reason ? { reason } : {})
    return Object.assign(error, { status: status(error) })
  }
}

/** slate's delivery sizes (src/shared/deliveryFormats.ts), read from the desktop checkout like its error statuses. */
export async function desktopDelivery(desktopDir) {
  return (await importTs(join(desktopDir, 'src', 'shared', 'deliveryFormats.ts'))).deliveryFormat
}

/** A TypeScript module with no imports of its own, types stripped (Node 22.13+), without the experimental notice. */
async function importTs(file) {
  const emit = process.emitWarning
  process.emitWarning = (warning, ...rest) => {
    if ((rest[0]?.type ?? rest[0]) !== 'ExperimentalWarning') emit.call(process, warning, ...rest)
  }
  try {
    return await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(readFileSync(file, 'utf8')))}`)
  } finally {
    process.emitWarning = emit
  }
}

/**
 * The stored transcripts, as GET /agent/assets/transcript answers them (the Transcript shape in
 * src/shared/types/transcript.ts, built by src/main/transcription/pipeline.ts): Mara's hook line on her take VID-V1
 * (SHOT-A1's line) and the voiceover AUD-S1. No other asset is transcribed yet.
 */
const transcript = (durationSec, segments, words) => ({
  version: 1,
  model: 'parakeet-unified-en-0.6b-int8',
  aligner: 'wav2vec2-base-960h-ctc',
  timing: 'aligned',
  language: 'en',
  durationSec,
  segments,
  words: words.map(([text, start, end]) => ({ text, start, end })),
  text: words.map(([text]) => text).join(' '),
})
const TRANSCRIPTS = {
  'VID-V1': transcript(5, [{ start: 0.38, end: 2.94 }], [
    ['Your', 0.42, 0.58], ['morning', 0.58, 0.94], ['coffee', 0.94, 1.3], ["shouldn't", 1.3, 1.68],
    ['taste', 1.68, 1.98], ['like', 1.98, 2.14], ['a', 2.14, 2.22], ['punishment.', 2.22, 2.86],
  ]),
  'AUD-S1': transcript(3.2, [{ start: 0.14, end: 0.86 }, { start: 1.06, end: 2.38 }], [
    ['Your', 0.18, 0.36], ['morning,', 0.36, 0.82], ['minus', 1.1, 1.42], ['the', 1.42, 1.54], ['bitterness.', 1.54, 2.3],
  ]),
}

/**
 * Part of the motion block library at the HyperFrames tag slate vendors (HYPERFRAMES_VERSION 0.8.202 in
 * src/shared/htmlClips.ts), each entry as listRegistry() maps a registry-item.json (src/main/layers/registry.ts):
 * real names and details, copied 2026-11-23 from github.com/heygen-com/hyperframes/tree/v0.8.202/registry. Captions,
 * lower thirds, titles and end cards, what the finished-ad cases reach for; the whole registry holds 456 items. Preview
 * links and the tags naming a library (extruded-logo's three-js and webgl) are left out: no vendor or library reaches
 * the agent (slate/.claude/rules/white-label.md), and fixture-check.mjs asserts it.
 */
const MOTION_REGISTRY = [
  { name: 'logo-outro', type: 'block', title: 'Logo Outro', description: 'Cinematic logo reveal with piece-by-piece assembly, glow bloom, tagline fade-in, and URL pill', tags: ['branding', 'outro', 'logo'], duration: 6, width: 1920, height: 1080 },
  { name: 'lower-third-bild', type: 'block', title: 'Lower Third — BILD Style', description: 'News-style lower third with tight-fit text boxes: white headline bar with red drop-shadow, red sub-line with white drop-shadow.', tags: ['broadcast', 'lower-third', 'news', 'overlay'], duration: 8, width: 1920, height: 1080 },
  { name: 'yt-lower-third', type: 'block', title: 'YouTube Lower Third', description: 'Animated YouTube subscribe lower third with avatar and channel info', tags: ['social', 'overlay', 'youtube'], duration: 4.5, width: 1920, height: 1080 },
  { name: 'canopy-part-title', type: 'block', title: 'Canopy Part Title', description: 'Leaves sweep through the frame and part to reveal the headline.', tags: ['3d-motion', 'title-card', 'leaves', 'organic', 'depth-of-field', 'two-headlines', 'sweep'], duration: 12, width: 1920, height: 1080 },
  { name: 'glass-shard-title', type: 'block', title: 'Glass Shard Title', description: 'Glass shards fly in through fog and tile themselves into the headline.', tags: ['3d-motion', 'title-card', 'glass', 'voronoi', 'shards', 'fog', 'hdr'], duration: 12.16, width: 1920, height: 1080 },
  { name: 'extruded-logo', type: 'block', title: 'Extruded Logo', description: 'Beveled 3D letters flip up one by one, the word swings so light runs across the bevels, then settles for a readable hold. Chrome, gold or matte.', tags: ['3d-object', 'logo', 'text', 'extruded', 'title-card'], duration: 5, width: 1920, height: 1080 },
  { name: 'app-showcase', type: 'block', title: 'App Showcase', description: 'Fitness app product showcase with three floating smartphone screens', tags: ['showcase', 'app', '3d'], duration: 5.5, width: 1920, height: 1080 },
  { name: 'caption-highlight', type: 'component', title: 'Highlight', description: 'Red background sweep behind each active word, TikTok-style', tags: ['captions', 'caption-style', 'highlight', 'social', 'tiktok'] },
  { name: 'caption-kinetic-slam', type: 'component', title: 'Kinetic Slam', description: 'Full-screen single-word display with alternating entrance directions', tags: ['captions', 'caption-style', 'kinetic', 'typography', 'slam'] },
  { name: 'caption-pill-karaoke', type: 'component', title: 'Pill Karaoke', description: 'Pill-shaped container with per-word karaoke color highlight', tags: ['captions', 'caption-style', 'karaoke', 'pill'] },
  { name: 'caption-emoji-pop', type: 'component', title: 'Emoji Pop', description: 'Emoji integration with stroked text and horizontal squeeze entrance', tags: ['captions', 'caption-style', 'emoji', 'social'] },
  { name: 'per-word-rise', type: 'component', title: 'Per Word Rise', description: 'Words or characters rise into place in a controlled blur-to-sharp cascade, settle softly on landing, and hold still until the cut (optional fade or up exit).', tags: ['motion-primitive', 'text-effects', 'typography', 'stagger', 'reveal'] },
  { name: 'per-word-crossfade', type: 'component', title: 'Per-Word Crossfade', description: 'Words gently fade into place with a short vertical drift for calm keynote rhythm.', tags: ['motion-primitive', 'typography'] },
  { name: 'cta-close', type: 'component', title: 'CTA Close', description: 'A display-scale action line lands per word and fills the frame with air, one generous CTA capsule pops beneath it with a single overshoot, and the finished close holds completely still.', tags: ['motion-primitive', 'ui-props', 'cta', 'end-card', 'close', 'ask'] },
  { name: 'cta-lockup', type: 'component', title: 'CTA Lockup', description: 'A canonical closing lockup that reveals an action line, pops in an accent CTA capsule, settles supporting microcopy, and holds with confidence.', tags: ['motion-primitive', 'ui-props', 'cta', 'end-card', 'lockup', 'ask'] },
  { name: 'logo-sting', type: 'component', title: 'Logo Sting', description: 'A wordmark slams into its final scale, fires one accent ring and one white impact frame, then holds completely still.', tags: ['motion-primitive', 'brand', 'logo', 'sting', 'impact', 'reveal'] },
  { name: 'titlecard-lockup', type: 'component', title: 'Titlecard Lockup', description: 'The calm breather titlecard: an optional mono kicker fades up, the wordmark settles dead-center with one restrained move, a hairline rule draws left to right, a mono label fades beneath, and the lockup holds truly still.', tags: ['motion-primitive', 'typography', 'title-card', 'lockup', 'breather', 'orient'] },
  { name: 'kinetic-type', type: 'example', title: 'Kinetic Type', description: 'Bold kinetic typography promo', duration: 15, width: 1920, height: 1080 },
  { name: 'product-promo', type: 'example', title: 'Product Promo', description: 'Multi-scene product showcase with SVG assets', duration: 20, width: 1920, height: 1080 },
]

// The recipe ID patterns of src/shared/adNaming.ts.
const RECIPE_ID = /^[a-z0-9]{6,16}$/
const RECIPE_IN_NAME = /__r-([a-z0-9]{6,16})(?=__|\.|$)/
export const OPEN_PROJECT_HINT = "Call slates_get_workspace_state for the open project's id."

/**
 * The routes, for the fixture's project and assets. `openProject` is the project the desktop has open, which a route
 * that falls back to it uses; `defaultTimelines` maps each project to the empty cut the desktop makes when a route
 * reads a project's cut and it has none (getOrCreateProjectTimeline). `refuse` makes an error as agentErrors() does.
 * None of the assets' files is on this machine (GET /agent/assets/path says so).
 */
export function moreRoutes({ projects, assets, openProject, defaultTimelines, fetchedAt, refuse, deliveryFormat }) {
  // The project's cut as getOrCreateProjectTimeline makes it (src/main/storage/editor.ts createTimeline defaults).
  const CUT = { frameRate: 24, width: 1920, height: 1080 }
  // src/main/agent/require-ids.ts requireProject, with its tags.
  const requireProject = (raw, { fallbackToOpen = false } = {}) => {
    const projectId = raw?.trim() || (fallbackToOpen ? openProject : null)
    if (!projectId) throw refuse(`projectId is required. ${OPEN_PROJECT_HINT}`, 'missing_id')
    if (!projects.some((p) => p.id === projectId)) throw refuse(`No project ${projectId}. ${OPEN_PROJECT_HINT}`, 'unknown_id')
    return projectId
  }
  const assetById = (ref) => assets.find((a) => a.id === ref)
  // The asset-or-clip target of routes-beats.ts and routes-whips.ts: the fixture has no clips.
  const mediaTarget = (q) => {
    const projectId = q.get('projectId')
    if (!projectId) throw refuse('projectId is required')
    if (q.get('clipId') !== null) {
      if (!q.get('clipId')) throw refuse('clipId is required')
      throw refuse(`Clip not found in this project: ${q.get('clipId')}`)
    }
    const assetId = q.get('assetId')
    if (!assetId) throw refuse('assetId or clipId is required')
    const asset = assetById(assetId)
    if (!asset || asset.projectId !== projectId) throw refuse(`Asset not found in this project: ${assetId}`)
    return asset
  }
  const required = (q, field) => {
    const value = q.get(field)
    if (!value?.trim()) throw refuse(`${field} is required`)
    return value
  }
  // A project's only timeline is the empty cut the desktop makes for it, so any other named one is outside it.
  const ownTimeline = (projectId, timelineId) => !timelineId || timelineId === defaultTimelines[projectId]
  const namedTimeline = (projectId, timelineId) => {
    if (!ownTimeline(projectId, timelineId)) throw refuse('Timeline is outside this project')
  }

  return {
    // routes-transcripts.ts
    'GET /agent/assets/transcript': (q) => {
      const assetId = q.get('assetId')
      if (!assetId) throw refuse('assetId is required')
      const asset = assetById(assetId)
      if (!asset) throw refuse(`Asset ${assetId} not found`)
      const stored = TRANSCRIPTS[asset.code]
      if (!stored) return { assetId, transcript: null, hint: 'Not transcribed yet: POST /agent/assets/transcribe (free, runs on this machine).' }
      return { assetId, noSpeech: false, edited: false, updatedAt: fetchedAt, transcript: stored }
    },
    // routes-compositions.ts, over listRegistry() in src/main/layers/registry.ts: every query word in the name, else in the details.
    'GET /agent/compositions/registry': (q) => {
      const type = q.get('type')
      if (type && type !== 'block' && type !== 'component' && type !== 'example') throw refuse('type is block, component or example')
      const words = (q.get('query') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
      const ofType = MOTION_REGISTRY.filter((i) => i.type === (type ?? 'block'))
      const byName = ofType.filter((i) => words.every((w) => i.name.includes(w)))
      const items = byName.length || !words.length
        ? byName
        : ofType.filter((i) => words.every((w) => [i.name, i.title, i.description, ...(i.tags ?? [])].join(' ').toLowerCase().includes(w)))
      return { items, total: items.length, fetchedAt, source: 'cache', offline: false }
    },
    // routes-spend.ts over getSpendLimits (src/main/storage/spendLimits.ts): no limit set, nothing spent, no default budget.
    'GET /agent/spend-limits': (q) => ({
      project: { projectId: requireProject(q.get('projectId'), { fallbackToOpen: true }), limitCredits: null, spentCredits: 0, leftCredits: null },
      session: { session: 'fixture-agent-session', limitCredits: null, spentCredits: 0, leftCredits: null },
      defaultSessionBudgetCredits: null,
    }),
    // routes-beats.ts: no grid found yet.
    'GET /agent/timeline/beats': (q) => ({
      assetId: mediaTarget(q).id, beats: null,
      hint: 'No beat grid yet: slates_find_beats finds it on this machine (free), or slates_edit_beat_grid lays one by hand with a tempo edit.',
    }),
    // routes-whips.ts: not searched yet.
    'GET /agent/timeline/whip-pans': (q) => ({
      assetId: mediaTarget(q).id, whips: null,
      hint: 'Not searched yet: slates_find_whip_pans finds them on this machine (free), or slates_edit_whip_pans marks one by hand.',
    }),
    // routes-subjectMask.ts target(), then listMasks or getMask over videoAsset() in src/main/subjectMask/service.ts:
    // no mask was made, and a video's file has to be on this machine before its masks are read.
    'GET /agent/timeline/masks': (q) => {
      const projectId = required(q, 'projectId')
      const clipId = q.get('clipId')
      if (clipId !== null) {
        if (!clipId) throw refuse('clipId is required')
        throw refuse(`Clip not found in this project: ${clipId}`)
      }
      const assetId = q.get('assetId')
      const maskId = q.get('maskId')
      if (!assetId && maskId) throw refuse(`No subject mask ${maskId} in this project`)
      if (!assetId) throw refuse('Name the mask (maskId), its file (assetId) or a clip of it (clipId)')
      const asset = assetById(assetId)
      if (!asset || asset.projectId !== projectId) throw refuse(`Asset not found in this project: ${assetId}`)
      if (asset.type !== 'video') throw refuse('The subject mask works on video clips')
      throw refuse("The clip's media file is missing")
    },
    // routes-editor.ts over getExportCutsStatus (src/main/editor/exportCuts.ts): the project has no exports.
    'GET /agent/timeline/export-cuts/status': (q) => {
      required(q, 'projectId')
      required(q, 'batchId')
      throw refuse('No export with this batch ID in this project')
    },
    // routes-editor.ts over lookupRecipe (src/main/editor/recipeLookup.ts): nothing was exported and no cut carries a recipe.
    'GET /agent/timeline/recipe': (q) => {
      const reference = required(q, 'recipe')
      const projectId = q.get('projectId') ? requireProject(q.get('projectId')) : null
      const text = reference.trim()
      const recipeId = RECIPE_ID.test(text) ? text : RECIPE_IN_NAME.exec(text)?.[1]
      if (!recipeId) throw refuse(`"${reference.slice(0, 120)}" holds no recipe ID. Pass the characters after __r- in an ad name, or the whole ad name or file name. An ad name without __r- was exported before ad names carried a recipe ID.`)
      return {
        recipeId, exports: [], liveTimelines: [], clips: [], clipsFrom: null,
        notFound: `Nothing in ${projectId ? 'this project' : 'any project'} has recipe ID ${recipeId}. Either the ad was exported before ad names carried a recipe ID, or its timeline has changed since export and no export manifest that recorded it is reachable. An export made on another computer is recorded only there.`,
      }
    },
    // routes-editor.ts over getEditorReframeReport (src/main/ipc/editor.ts); the op's schema checks the aspect.
    'GET /agent/timeline/reframe-report': (q) => {
      const aspect = q.get('aspect')
      let size
      try { size = deliveryFormat(aspect, CUT) } catch (error) { throw refuse(error.message) }
      const projectId = required(q, 'projectId'), timelineId = required(q, 'timelineId')
      if (timelineId !== defaultTimelines[projectId]) throw refuse('Timeline is outside this project')
      if (q.get('clipId') !== null) throw refuse('Clip is not on this video timeline')   // the cut is empty
      return { timelineId, aspect, size, clips: [] }
    },
    // routes-editor.ts over measureTimelineLoudness (src/main/editor/loudness.ts): the project's cut is empty.
    'GET /agent/timeline/loudness': (q) => {
      namedTimeline(required(q, 'projectId'), q.get('timelineId'))
      throw refuse('The timeline is empty: there is no sound to measure')
    },
    // routes-editor.ts over draftFinishStatus (src/main/editor/cutDrafts.ts): no finish ran in this session.
    'GET /agent/timeline/draft-finish': (q) => {
      for (const field of ['projectId', 'timelineId', 'quoteId']) required(q, field)
      throw refuse('This finish is outside this cut or app session. Quote the cut again to reuse any saved finals.')
    },
    // routes-variants.ts
    'GET /agent/timeline/variants': (q) => {
      const projectId = required(q, 'projectId'), timelineId = required(q, 'timelineId')
      if (timelineId !== defaultTimelines[projectId]) throw refuse('Timeline is outside this project')
      const set = { timelineId, frameRate: CUT.frameRate, slots: [], variants: [], bed: { clips: 0, anchorSlotId: null, anchorFrame: 0 } }
      const picks = q.get('picks')
      if (q.get('grid') !== 'true' && picks === null && q.get('aspects') === null) return set
      try { if (picks !== null) JSON.parse(picks) } catch { throw refuse('picks must be JSON: {"<slotId>": ["<alternativeId>", ...]}') }
      throw refuse('This cut has no slots yet: add a slot and its alternatives first')   // variantGrid.ts
    },
    // routes-visual-qa.ts timelineIn(): the project's cut, named or not, has had no Visual QA run.
    'GET /agent/timeline/visual-qa/runs': (q) => {
      const runId = q.get('runId')
      if (runId) throw refuse(`No Visual QA run ${runId}`)
      const projectId = requireProject(q.get('projectId'), { fallbackToOpen: true })
      namedTimeline(projectId, q.get('timelineId'))
      return { timelineId: defaultTimelines[projectId], runs: [] }
    },
    // routes-v2v.ts over v2vTimeline (src/main/editor/v2vEdits.ts).
    'GET /agent/timeline/v2v': (q) => {
      const projectId = q.get('projectId')?.trim()
      if (!projectId) throw refuse('Project ID is required.')
      const timelineId = q.get('timelineId')?.trim()
      if (!timelineId) throw refuse('Timeline ID is required.')
      // The project's own cut has no pass; another project's would be outside it, and the fixture holds no other cut.
      if (timelineId === defaultTimelines[projectId]) return { passes: [] }
      if (Object.values(defaultTimelines).includes(timelineId)) throw refuse('Timeline is outside this project.')
      throw refuse('Timeline not found.')
    },
    // routes-finishing.ts: the person has sent no review packet.
    'GET /agent/review/packet': (q) => {
      requireProject(q.get('projectId'))
      const include = q.get('include') ?? undefined
      if (include !== undefined && include !== 'sent' && include !== 'open' && include !== 'all') throw refuse("include is 'sent', 'open' or 'all'")
      return { packet: null, reason: include === 'open' ? 'No unsent notes or changed ratings' : 'No review packet is waiting: the person has not pressed Send since the last one was read' }
    },
    // routes-meta-winners.ts over listRecipePerformance (src/main/editor/metaWinners.ts): signed in, no results pulled.
    'GET /agent/meta/winners': (q) => {
      if (q.get('projectId')) requireProject(q.get('projectId'))
      return {
        recipes: [], verdicts: [], syncedAt: null, attribution: 'as Meta reports it', winners: [], losers: [], splitTests: [],
        rule: "Never remake a recipe listed in losers. Every figure is the ad account's own report over the pulled range, not a forecast.",
      }
    },
    // routes-client-ads.ts: no Google or TikTok account connected (the connection shape of src/shared/clientAds.ts).
    'GET /agent/client-ads': (q) => {
      const platform = q.get('platform')
      if (platform !== 'google' && platform !== 'tiktok') throw refuse('Choose an ads platform.')
      return { connection: { configured: true, connected: false }, accounts: [] }
    },
    // routes-diagnostics.ts over diagnosticsStatus (src/main/diagnosticsHealth.ts): sharing off.
    'GET /agent/diagnostics/status': () => ({
      shareDiagnostics: false, verifyMode: false, delivery: 'captured locally / queued; delivery is not confirmed', counts: {}, events: [],
    }),
    // routes-winning-ads.ts over searchWinningAds (src/main/reference/winningAds.ts): an empty catalog answer.
    'GET /agent/reference/winning-ads': () => ({ items: [], total: 0, source: 'cloud-catalog', syncedAt: null, niches: [] }),
    'GET /agent/reference/winning-ads/niches': () => ({ niches: [] }),
    // routes-templates.ts over inspectTemplate (src/main/templates/importTemplate.ts): this machine holds no template.
    'GET /agent/templates/inspect': (q) => {
      const path = q.get('path')
      if (!path) throw refuse('path query param required')
      throw refuse(`Template not found: ${path}`)
    },
    // routes.ts over getDraftFinishInfo: none of the fixture's takes was made in Draft mode.
    'GET /agent/assets/quote-draft-finish': (q) => {
      requireProject(q.get('projectId'))
      throw refuse('Choose a take generated in Draft mode.')
    },
    // routes.ts: the fixture's files are not on this machine.
    'GET /agent/assets/path': (q) => {
      const id = q.get('id')
      if (!id) throw refuse('id query param required')
      const asset = assetById(id)
      if (!asset) throw refuse(`Asset not found: ${id}`)
      return { asset_id: id, code: asset.code, label: asset.label, type: asset.type, file_path: undefined, exists: false, bytes: 0 }
    },
  }
}
