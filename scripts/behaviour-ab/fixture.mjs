// A stand-in for the Slates desktop app and the cloud API, for the behaviour
// A/B (README.md). One HTTP server on 127.0.0.1 answers the desktop's /agent/*
// routes and the cloud's /api/* and /members/* routes from the small project
// below, and records every request so the scorer can see what each run asked.
//
// Nothing here writes: every POST is refused and recorded, so no run can change
// a real project, and no route reaches the real desktop. The one live call is
// the cloud price list (GET /api/agent/models), fetched once at start with the
// caller's cloud token and held in memory, so estimates quote real prices.
// /members/* answers 402 (no skills entitlement), as for a user without the pack.
// /brain and /brain/bundle serve the brain from slates-api's brain/ (scripts/brain-source.mjs) with both tiers
// open, as slates-api answers a member: a candidate build fetches its playbooks the way a signed-in user's does.

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import { brainDir, readSkillDir } from '../brain-source.mjs'

// The framing buckets, word count and speech-rate budget the desktop also imports (this checkout's shared build).
const grammar = await import(pathToFileURL(join(import.meta.dirname, '..', '..', 'packages', 'shared', 'dist', 'prompts', 'shot-grammar.js')).href)

export const FIXTURE_DESKTOP_TOKEN = 'fixture-desktop-token'
export const FIXTURE_CLOUD_TOKEN = 'slates_sk_fixture_not_a_real_key' // secret-scan: allow (a fake key the fixture cloud accepts)

const T0 = '2026-10-17T21:40:00.000Z'
const P1 = '7a1c2e40-0000-4000-8000-000000000001'
const P2 = '7a1c2e40-0000-4000-8000-000000000002'
const SB1 = '5b0a0000-0000-4000-8000-000000000001'
const SC1 = '5c0a0000-0000-4000-8000-000000000001'
const SC2 = '5c0a0000-0000-4000-8000-000000000002'
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

const ASSETS = [
  { id: id('a55e0000', 1), code: 'IMG-A1', type: 'image', label: 'Mara, kitchen window, morning', prompt: 'A woman in her thirties at a sunlit kitchen window holding a matte black cold brew can, soft morning light from camera left', model: 'nano-banana-2', width: 1024, height: 1820, aspectRatio: '9:16', favorite: true },
  { id: id('a55e0000', 2), code: 'IMG-A2', type: 'image', label: 'Can on wet slate, hero', prompt: 'Matte black cold brew can on wet slate, condensation beads, low angle, rim light', model: 'nano-banana-2', width: 1024, height: 1820, aspectRatio: '9:16', favorite: false },
  { id: id('a55e0000', 3), code: 'IMG-A3', type: 'image', label: 'Pour over ice, macro', prompt: 'Macro shot of cold brew pouring over clear ice in a tall glass', model: 'nano-banana-2', width: 1024, height: 1820, aspectRatio: '9:16', favorite: false },
  { id: id('a55e0000', 4), code: 'VID-V1', type: 'video', label: 'Mara first sip', prompt: 'She lifts the can, takes a slow first sip, small smile', model: 'kling-v3.0-std', duration: 5, width: 1080, height: 1920, aspectRatio: '9:16' },
  { id: id('a55e0000', 5), code: 'AUD-S1', type: 'audio', label: 'VO take 1', prompt: 'Your morning, minus the bitterness.', model: 'inworld-tts-2', duration: 3.2 },
].map((a) => ({ ...a, projectId: P1, createdAt: T0, updatedAt: T0, folderId: null, note: null }))

const LIBRARY = {
  categories: [
    { id: id('ca7e0000', 1), name: 'Characters', kind: 'character', position: 0 },
    { id: id('ca7e0000', 2), name: 'Products', kind: 'prop', position: 1 },
    { id: id('ca7e0000', 3), name: 'Locations', kind: 'location', position: 2 },
  ],
  items: [
    { id: id('11b00000', 1), name: 'Mara', categoryId: id('ca7e0000', 1), kind: 'character', mention: '@Mara', description: 'Thirties, dark curly hair, linen shirt, warm and unhurried', imageAssetId: ASSETS[0].id, voiceAssetId: null },
    { id: id('11b00000', 2), name: 'Ritual can', categoryId: id('ca7e0000', 2), kind: 'prop', mention: '@Ritual-can', description: 'Matte black 330 ml can, gold sunrise mark, condensation', imageAssetId: ASSETS[1].id, voiceAssetId: null },
    { id: id('11b00000', 3), name: 'Kitchen', categoryId: id('ca7e0000', 3), kind: 'location', mention: '#Kitchen', description: 'Small bright kitchen, white tile, window over the sink', imageAssetId: null, voiceAssetId: null },
  ].map((i) => ({ ...i, projectId: P1, createdAt: T0 })),
}

const SCRIPT_TEXT = [
  'MARA: Your morning coffee shouldn’t taste like a punishment.',
  'She cracks the can. Ice. A slow pour.',
  'MARA: Eighteen hours, cold. Nothing bitter left.',
  'Ritual. Cold brew, done right.',
].join('\n')

const SHOTS = [
  { n: 1, code: 'SHOT-A1', name: 'Hook: Mara to camera', model: 'kling-v3.0-std', shotSize: 'close-up', camera: 'static', speaker: 'Mara', line: 'Your morning coffee shouldn’t taste like a punishment.', prompt: '@Mara at the kitchen window looks straight into the lens, deadpan, then a small smile', sceneId: SC1, start: 0, end: 57, image: ASSETS[0].id, take: ASSETS[3].id },
  { n: 2, code: 'SHOT-A2', name: 'Crack and pour', model: 'kling-v3.0-std', shotSize: 'extreme close-up', camera: 'static', speaker: null, line: null, prompt: '', sceneId: SC1, start: 58, end: 95, image: null, take: null },
  { n: 3, code: 'SHOT-A3', name: 'Proof line', model: 'kling-v3.0-std', shotSize: 'medium', camera: 'slow push in', speaker: 'Mara', line: 'Eighteen hours, cold. Nothing bitter left.', prompt: '@Mara leaning on the counter with @Ritual-can, talking to a friend off camera', sceneId: SC2, start: 0, end: 47, image: null, take: null },
  { n: 4, code: 'SHOT-A4', name: 'Hero end card', model: 'kling-v3.0-std', shotSize: 'close-up', camera: 'static', speaker: null, line: null, prompt: '@Ritual-can on wet slate, rim light, logo legible', sceneId: SC2, start: 48, end: 80, image: ASSETS[1].id, take: null },
].map((s) => ({
  id: id('5a070000', s.n),
  code: s.code,
  name: s.name,
  model: s.model,
  authoredFor: s.model,
  rawPrompt: s.prompt,
  referenceCount: s.image ? 1 : 0,
  params: { aspectRatio: '9:16', duration: 5 },
  speaker: s.speaker,
  line: s.line,
  delivery: null,
  action: null,
  prop: null,
  shotSize: s.shotSize,
  camera: s.camera,
  continues: false,
  cuts: 1,
  runtimeSeconds: 5,
  place: `${s.sceneId === SC1 ? 1 : 2}${s.n % 2 === 1 ? 'A' : 'B'}`,
  sceneName: s.sceneId === SC1 ? 'Hook' : 'Proof and close',
  position: (s.n - 1) % 2,
  projectId: P1,
  storyboardId: SB1,
  sceneId: s.sceneId,
  scriptSceneId: s.sceneId,
  scriptStart: s.start,
  scriptEnd: s.end,
  startFrameAssetId: s.image,
  takes: s.take ? [{ assetId: s.take, code: 'VID-V1', current: true }] : [],
  status: s.take ? 'generated' : s.prompt ? 'ready' : 'empty',
}))

/**
 * The board's variety report and summary, as the desktop's `varietyFor` and `describeVariety` (slate
 * src/shared/shotVariety.ts) build them for these four one-cut Shots: buckets, word counts and the budget come
 * from the shared shot grammar both sides import; a run counts at three in a row; the summary parts join with " · ".
 * The Shots bind no Library ids, so there are no cast or location counts.
 */
const VARIETY = (() => {
  const tally = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket))
  const runsIn = (buckets, dimension) => {
    const out = []
    for (let start = 0, i = 1; i <= buckets.length; i++) {
      if (i < buckets.length && buckets[i] === buckets[start]) continue
      if (i - start >= 3 && buckets[start] !== 'other') out.push({ dimension, bucket: buckets[start], length: i - start, from: start })
      start = i
    }
    return out
  }
  const sizes = SHOTS.map((s) => grammar.bucketShotSize(s.shotSize))
  const moves = SHOTS.map((s) => grammar.bucketCameraMove(s.camera))
  const seconds = SHOTS.reduce((t, s) => t + s.params.duration, 0)
  const report = {
    cuts: SHOTS.length,
    generations: SHOTS.length,
    runtimeSeconds: seconds,
    cutsWithoutDuration: 0,
    shotSizes: tally(sizes),
    cameraMoves: tally(moves),
    castCutCounts: {},
    locationCutCounts: {},
    modelCutCounts: SHOTS.reduce((m, s) => ({ ...m, [s.model]: (m[s.model] ?? 0) + 1 }), {}),
    durationCutCounts: SHOTS.reduce((m, s) => ({ ...m, [s.params.duration]: (m[s.params.duration] ?? 0) + 1 }), {}),
    runs: [...runsIn(sizes, 'shotSize'), ...runsIn(moves, 'camera')],
    overLongLines: [],
    words: SHOTS.reduce((t, s) => t + (s.line ? grammar.countWords(s.line) : 0), 0),
    wordBudget: grammar.wordsForDuration(seconds, grammar.DEFAULT_SPEECH_REGISTER),
  }
  const parts = []
  const topSize = report.shotSizes.find((b) => b.bucket !== 'other')
  if (topSize?.count >= 2) parts.push(`${topSize.count}/${report.cuts} ${grammar.bucketLabel(topSize.bucket)}`)
  const topMove = report.cameraMoves.find((b) => b.bucket !== 'other')
  if (topMove?.count >= 2) parts.push(`${topMove.count} ${grammar.bucketLabel(topMove.bucket)}`)
  const durations = Object.entries(report.durationCutCounts)
  if (durations.length === 1 && durations[0][1] === report.cuts && report.cuts > 1) parts.push(`every cut ${durations[0][0]}s`)
  for (const run of report.runs) parts.push(`${run.length} ${grammar.bucketLabel(run.bucket)} in a row`)
  return { report, summary: parts.join(' · ') }
})()

const SCENES = [
  { id: SC1, storyboardId: SB1, name: 'Hook', position: 0, frames: SHOTS.filter((s) => s.sceneId === SC1).map((s, i) => ({ id: id('f4a30000', s.code.slice(-1)), position: i, assetId: s.startFrameAssetId, shotId: s.id, label: s.name })) },
  { id: SC2, storyboardId: SB1, name: 'Proof and close', position: 1, frames: SHOTS.filter((s) => s.sceneId === SC2).map((s, i) => ({ id: id('f4a30000', s.code.slice(-1)), position: i, assetId: s.startFrameAssetId, shotId: s.id, label: s.name })) },
]

const PROJECTS = [
  { id: P1, name: 'Morning Ritual Coffee', description: 'Ritual cold brew: 15 s vertical ads for Meta and TikTok', assetCount: ASSETS.length, updatedAt: T0, createdAt: '2026-10-10T18:00:00.000Z' },
  { id: P2, name: 'Bakery launch', description: '', assetCount: 0, updatedAt: '2026-10-12T16:00:00.000Z', createdAt: '2026-10-12T16:00:00.000Z' },
]
const STORYBOARDS = [{ id: SB1, projectId: P1, name: 'Cold brew 15s v1', description: 'Hook, proof, end card', sceneCount: 2, shotCount: SHOTS.length, updatedAt: T0, createdAt: T0 }]

const VIEW = {
  projectId: P1,
  lens: 'board',
  cut: { open: false, full: false, side: 'bottom', height: 280, width: 0 },
  leftDock: { open: true, width: 260, folded: [] },
  studioAgent: { enabled: true, open: false, width: 380 },
  script: { details: false, textScale: 1, panelShotId: null },
  board: { id: SB1, level: 'shots', cardWidth: 220, filter: 'all', linkedClips: true, scriptFollowsDrag: true, collapsedSceneIds: [] },
  viewer: { assetId: null, mode: 'source', sourceAssetId: null },
  updatedAt: T0,
}

const VOICES = {
  available: true,
  line: 'Inworld TTS 2 preset voices',
  voices: [
    { voiceId: 'Ashley', displayName: 'Ashley', description: 'Warm, even, conversational', tags: ['warm', 'narration'], gender: 'female', ageGroup: 'adult', languageCode: 'en-US' },
    { voiceId: 'Dennis', displayName: 'Dennis', description: 'Low, relaxed, friendly', tags: ['calm'], gender: 'male', ageGroup: 'adult', languageCode: 'en-US' },
    { voiceId: 'Olivia', displayName: 'Olivia', description: 'Bright, quick, upbeat', tags: ['energetic', 'ads'], gender: 'female', ageGroup: 'young adult', languageCode: 'en-GB' },
  ],
}

/** The cost key the desktop prices a 5 s Kling 3.0 standard take at (sound on). */
export const SHOT_COST_KEY = 'kling-v3-standard-5s-audio'

function detail(s) {
  return {
    ...s,
    composedPrompt: s.rawPrompt || s.line || '',
    references: s.startFrameAssetId ? [{ kind: 'startFrame', number: 1, durationSeconds: null }] : [],
    missing: null,
    unresolvedTokens: [],
    generationIds: [],
    firesWith: { videoResolution: '720p', imageResolution: null, duration: 5, audioDurationSeconds: null },
    blocked: s.rawPrompt || s.line ? null : 'No prompt or script line yet: write one before it can be priced or fired.',
  }
}

function shotById(ref) {
  return SHOTS.find((s) => s.id === ref || s.code === ref || s.code.toLowerCase() === String(ref).toLowerCase())
}

/** The desktop's healthz capability list, read from the desktop source so the fixture advertises what the app does. */
function desktopCapabilities(desktopDir) {
  try {
    const src = readFileSync(join(desktopDir, 'src', 'main', 'agent', 'server.ts'), 'utf8')
    const block = src.match(/AGENT_CAPABILITIES[^=]*=\s*\[([\s\S]*?)\]/)
    const version = src.match(/AGENT_API_VERSION\s*=\s*(\d+)/)
    return {
      capabilities: block ? [...block[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) : [],
      agentApiVersion: version ? Number(version[1]) : 2,
    }
  } catch {
    return { capabilities: [], agentApiVersion: 2 }
  }
}

/** The live price list, fetched with the user's cloud token; `{ models: [] }` when it cannot be read. */
export async function fetchPriceList(cloudToken, cloudBase = 'https://slates-api.fly.dev') {
  if (!cloudToken) return { models: [] }
  try {
    const res = await fetch(`${cloudBase}/api/agent/models`, { headers: { Authorization: `Bearer ${cloudToken}` } })
    if (!res.ok) return { models: [] }
    return await res.json()
  } catch {
    return { models: [] }
  }
}

/**
 * Start the fixture. Pass `priceList` (from fetchPriceList, once per batch), or
 * `cloudToken`, the real slates_sk_ token used only for one price-list GET to
 * `cloudBase`; it is never logged or written anywhere.
 * Returns { port, requests, close }; `requests` is the live request log.
 */
export async function startFixture({ desktopDir, priceList: given, cloudToken, cloudBase = 'https://slates-api.fly.dev', brain = brainDir() } = {}) {
  const health = desktopCapabilities(desktopDir)
  const priceList = given ?? await fetchPriceList(cloudToken, cloudBase)
  const requests = []
  const bundle = brainBundle(brain)

  const routes = {
    'GET /agent/healthz': () => ({ ok: true, service: 'slates-agent', version: '1.6.0', ...health }),
    'GET /agent/projects': () => ({ projects: PROJECTS }),
    'GET /agent/projects/get': (q) => {
      const p = PROJECTS.find((x) => x.id === q.get('id'))
      if (!p) throw httpError(404, `No project ${q.get('id')}. List them with slates_list_projects.`)
      return { project: { ...p, storyboards: p.id === P1 ? STORYBOARDS : [], libraryItemCount: p.id === P1 ? LIBRARY.items.length : 0 } }
    },
    'GET /agent/projects/location': (q) => ({ directory: `C:\\Users\\user\\Slates Projects\\${q.get('id')}` }),
    'GET /agent/view': () => ({ view: VIEW }),
    'GET /agent/selection': () => ({ selection: null, viewing: null }),
    'GET /agent/assets': (q) => ({ assets: projectOf(q) === P1 ? ASSETS : [] }),
    'GET /agent/assets/image': (q) => {
      const a = assetOf(q.get('id'), 'image')
      return { ...assetFields(a), ...picture(a) }
    },
    'GET /agent/assets/video-frames': (q) => {
      const a = assetOf(q.get('id'), 'video')
      const count = Math.min(Number(q.get('count') ?? 3) || 3, 8)
      const frames = Array.from({ length: count }, (_, i) => ({ ...picture(a), timestamp_seconds: Math.round((a.duration * (i + 0.5) / count) * 100) / 100 }))
      return { ...assetFields(a), duration_seconds: a.duration, frames }
    },
    'GET /agent/assets/get': (q) => {
      const a = ASSETS.find((x) => x.id === q.get('id') || x.code === q.get('id'))
      if (!a) throw httpError(404, `No asset ${q.get('id')}`)
      return { asset: a }
    },
    'GET /agent/folders': () => ({ folders: [] }),
    'GET /agent/pins': () => ({ pins: [] }),
    'GET /agent/library': (q) => (projectOf(q) === P1 ? LIBRARY : { categories: LIBRARY.categories, items: [] }),
    'GET /agent/characters': (q) => ({ characters: projectOf(q) === P1 ? LIBRARY.items.filter((i) => i.kind === 'character') : [] }),
    'GET /agent/environments': (q) => ({ environments: projectOf(q) === P1 ? LIBRARY.items.filter((i) => i.kind === 'location') : [] }),
    'GET /agent/styles': () => ({ styles: [] }),
    'GET /agent/storyboards': (q) => ({ storyboards: projectOf(q) === P1 ? STORYBOARDS : [] }),
    'GET /agent/storyboards/get': (q) => {
      const sb = STORYBOARDS.find((s) => s.id === q.get('id'))
      if (!sb) throw httpError(404, `No storyboard ${q.get('id')}. List them with slates_list_storyboards.`)
      return { storyboard: sb }
    },
    'GET /agent/scenes/full': (q) => (q.get('storyboardId') === SB1 ? { scenes: SCENES, variety: VARIETY.report, varietySummary: VARIETY.summary } : { scenes: [], variety: null, varietySummary: '' }),
    'GET /agent/shots': (q) => {
      const rows = q.get('storyboardId') ? (q.get('storyboardId') === SB1 ? SHOTS : []) : projectOf(q) === P1 ? SHOTS : []
      return { shots: rows, variety: rows.length ? VARIETY.report : null, varietySummary: rows.length ? VARIETY.summary : '' }
    },
    'GET /agent/shots/get': (q) => {
      const s = shotById(q.get('id'))
      if (!s) throw httpError(404, `No shot ${q.get('id')}`)
      return { shot: detail(s) }
    },
    'GET /agent/shots/quote': (q) => {
      const input = JSON.parse(q.get('input') ?? '{}')
      const rows = (input.shotIds ?? SHOTS.map((s) => s.id)).map(shotById).filter(Boolean)
      const credits = (priceList.models ?? []).find((m) => m.model === SHOT_COST_KEY)
      const each = credits ? credits.cost_credits ?? credits.cost_cents ?? null : null
      const items = rows.map((s) => {
        const blocked = detail(s).blocked
        return { shotId: s.id, name: s.name, code: s.code, model: s.model, prompt: s.rawPrompt, cost: blocked ? null : each, credits: blocked ? null : each, blocked }
      })
      const priced = items.filter((i) => i.credits != null).map((i) => i.credits)
      return { fingerprint: 'fixture-quote-1', items, total: priced.reduce((a, b) => a + b, 0), largest: Math.max(0, ...priced), unpriced: items.length - priced.length }
    },
    'GET /agent/shots/inputs': (q) => ({ shot: shotById(q.get('id'))?.code ?? null, inputs: [] }),
    'GET /agent/script': (q) => {
      const sceneId = q.get('sceneId')
      const text = sceneId === SC1 ? SCRIPT_TEXT.split('\n').slice(0, 2).join('\n') : SCRIPT_TEXT.split('\n').slice(2).join('\n')
      return { sceneId, script: text, rev: 'r1', shots: SHOTS.filter((s) => s.sceneId === sceneId).map((s) => ({ id: s.id, code: s.code, start: s.scriptStart, end: s.scriptEnd, line: s.line })), revision: 3 }
    },
    'GET /agent/script/document': () => ({ storyboardId: SB1, revision: 3, scenes: SCENES.map((s) => ({ id: s.id, name: s.name })), text: SCRIPT_TEXT }),
    'GET /agent/script/sections': () => ({ sections: [], revision: 3 }),
    'GET /agent/script/suggestions': () => ({ suggestions: [], revision: 3 }),
    'GET /agent/script/uses': () => ({ uses: [] }),
    'GET /agent/composer': () => ({ composer: null }),
    'GET /agent/timelines': () => ({ timelines: [] }),
    'GET /agent/timeline': () => ({ timeline: null, reason: 'no timeline in this project yet' }),
    'GET /agent/timeline/export-batches': () => ({ batches: [] }),
    'GET /agent/timeline/variant-grid': () => ({ rows: [], columns: [], cells: [] }),
    'GET /agent/shots/progress': () => ({ boards: [], running: 0 }),
    'GET /agent/usage': (q) => ({ period: q.get('period') ?? 'month', generations: 6, creditsSpent: null, byModel: [] }),
    'GET /agent/app-settings': () => ({ appVersion: '1.6.0', projectsFolder: 'C:\\Users\\user\\Slates Projects', newProjectLens: 'board', chatGptImagesEnabled: false }),
    'GET /agent/voices': () => VOICES,
    'GET /agent/generation/list': () => ({ generations: [] }),
    'GET /agent/generation/status': (q) => ({ status: 'unknown', id: q.get('id') }),
    'GET /agent/chatgpt/status': () => ({ connected: false }),
    'GET /agent/templates': () => ({ templates: [] }),
    'GET /agent/manual/pictures': () => ({ pictures: [] }),
    'GET /agent/ui/targets': () => ({ targets: [] }),
    // Cloud
    'GET /api/agent/me': () => ({ success: true, email: 'user@example.com', name: 'Test User', license: 'pro', credit_balance: 1240 }),
    'GET /api/agent/credits/balance': () => ({ success: true, credit_balance: 1240 }),
    'GET /api/agent/models': (q) => {
      const key = q.get('costKey')
      const models = priceList.models ?? []
      return { ...priceList, models: key ? models.filter((m) => m.model === key) : models }
    },
    'GET /brain': () => ({ version: bundle.version, tiers: bundle.tiers, files: Object.keys(bundle.files).map((name) => ({ name, open: true })) }),
    'GET /brain/bundle': () => bundle,
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const entry = { at: new Date().toISOString(), method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) }
    let body = ''
    for await (const chunk of req) body += chunk
    if (body) entry.body = body.slice(0, 2000)
    requests.push(entry)
    const send = (status, payload) => {
      entry.status = status
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(payload))
    }
    if (url.pathname.startsWith('/members/')) return send(402, { error: 'No active skills entitlement' })
    if (req.method === 'POST' && READ_POSTS[url.pathname]) {
      try {
        return send(200, READ_POSTS[url.pathname](body ? JSON.parse(body) : {}))
      } catch (error) {
        return send(error.status ?? 500, { error: error.message })
      }
    }
    if (req.method !== 'GET') return send(403, { error: 'This is a read-only test fixture: nothing was changed.' })
    const route = routes[`GET ${url.pathname}`]
    if (!route) return send(404, { error: `Not in the A/B fixture: ${url.pathname}` })
    try {
      send(200, await route(url.searchParams))
    } catch (error) {
      send(error.status ?? 500, { error: error.message })
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    port: server.address().port,
    requests,
    priceListSize: (priceList.models ?? []).length,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

/** slates-api's /brain/bundle for an account that opens every tier, from the brain folder (none: no files). */
function brainBundle(dir) {
  const files = dir ? readSkillDir(dir) : {}
  const version = `fixture.${createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12)}`
  return { version, tiers: ['bump', 'license'], files, locked: [] }
}

function projectOf(q) {
  return q.get('projectId') ?? P1
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}

/** A solid-colour PNG, small enough to ride a tool result: what the vision reads hand the model. */
function solidPng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => [r, g, b][i % 3])])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))])
}

// Each picture's colour. VID-V1's frames are near black: the edit-iterate case says 1A came out too dark.
const PICTURE_COLOUR = { 'IMG-A1': [205, 165, 115], 'IMG-A2': [70, 78, 88], 'IMG-A3': [180, 120, 60], 'VID-V1': [26, 22, 20] }

function picture(asset) {
  const png = solidPng(72, 128, PICTURE_COLOUR[asset.code] ?? [128, 128, 128])
  return { data: png.toString('base64'), mimeType: 'image/png', bytes: png.length }
}

const assetFields = (a) => ({ asset_id: a.id, code: a.code, label: a.label, file_path: ['C:', 'Users', 'user', 'Slates Projects', a.projectId, `${a.code}.${a.type === 'video' ? 'mp4' : 'png'}`].join('\\') })

function assetOf(ref, type) {
  const a = ASSETS.find((x) => x.id === ref || x.code === ref)
  if (!a) throw httpError(404, `No asset ${ref}`)
  if (a.type !== type) throw httpError(400, `${a.code} is a ${a.type}, not an ${type}`)
  return a
}

/** POST routes that only read, so the fixture answers them instead of refusing. */
const READ_POSTS = {
  '/agent/assets/batch-images': (body) => {
    const images = []
    const errors = []
    for (const ref of body.ids ?? []) {
      try {
        const a = assetOf(ref, 'image')
        images.push({ ...assetFields(a), ...picture(a) })
      } catch (error) {
        errors.push({ asset_id: ref, error: error.message })
      }
    }
    return { images, errors }
  },
}

export const FIXTURE_IDS = { P1, P2, SB1, SC1, SC2, shots: SHOTS.map((s) => ({ id: s.id, code: s.code })), assets: ASSETS.map((a) => ({ id: a.id, code: a.code })) }
