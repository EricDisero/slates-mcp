// The price a caller confirms is the price that is billed: the ops ask the DESKTOP what a job costs,
// send the request in a body, hold the submission to the quote, and refuse what the desktop would trim.
// The real desktop client runs here against an HTTP server on a local port that answers as the
// desktop's agent routes do; no app, provider or network is reached.
//
//   1  quote requests ride a JSON body where the desktop advertises 'quote-post'; an older desktop
//      gets the query, and a query too long to send is refused in words, never a bare 431
//   2  slates_generate_video takes its key and credits from /agent/generation/video-quote on every
//      model and sends them back as maxCredits; a higher price after confirm runs nothing
//   3  slates_edit_image confirms the key for the ratio the desktop resolved from the picture
//   4  a lip-sync on uploaded audio is priced on the measured track, never on a one-block floor, and the two
//      tools send the desktop the credits they are held to (maxCredits): a dearer measure runs nothing; where the
//      host has its own spending decision (ctx.spend) the ceiling and the quote come from it, never the input, and
//      a withdrawn approval sends nothing
//   5  a partial image batch reports what the saved images cost
//   6  an asset id from another project is a miss; a timeline clip may point into one
//   7  references over a model's cap are refused before any spend, and the caps come from the rows
//   8  slates_list_assets shows a clip's length
//
// Runs against the built package (npm run build -w packages/shared first).
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { desktopSource } from './desktop-source.mjs'
import { SlatesDesktopClient, MAX_GET_URL_LENGTH } from '../packages/shared/dist/clients/desktop.js'
import {
  listShots, generateVideo, editImage, generateLipSync, generateMotionTransfer, generateImage, getAsset, editCut, listAssets,
  videoCostKey, imageCostKey, IMAGE_MODELS, VIDEO_MODELS,
} from '../packages/shared/dist/operations/index.js'
import { MODEL_CAPABILITIES, maxIngredientImagesFor } from '../packages/shared/dist/prompts/model-capabilities.js'

// Every capability the current desktop advertises, read from its source, so a fake "current desktop"
// is never a hand-typed list.
const serverSrc = readFileSync(desktopSource('src/main/agent/server.ts'), 'utf8')
const ALL_CAPS = [...(/const AGENT_CAPABILITIES = \[([\s\S]*?)\] as const/.exec(serverSrc)?.[1] ?? '').replace(/\/\/[^\r\n]*/g, '').matchAll(/'([^']+)'/g)].map((m) => m[1])
for (const cap of ['quote-post', 'video-quote', 'edit-image-quote', 'lip-sync-quote']) {
  assert.ok(ALL_CAPS.includes(cap), `the desktop advertises ${cap}`)
}

// ── 0 (static). Every paid send of a billable op is held to the host's approval as it goes ──
// The Director withdraws a plan while an op is still pricing (the user steers or stops); an op that awaited a quote
// and then posted anyway spent on a withdrawn plan. So each billable op's paid `.post` (any post but a quote route's)
// must follow an `approvedSpend(ctx` with no await between them but the post's own.
function unheldSends(source) {
  const lines = source.split('\n')
  const starts = lines.flatMap((line, i) => (/^(export )?const \w+\s*:\s*Operation\b/.test(line) ? [i] : []))
  const found = []
  starts.forEach((start, k) => {
    const chunk = lines.slice(start, starts[k + 1] ?? lines.length).join('\n')
    if (!/\bbillable: true\b/.test(chunk)) return
    const name = /const (\w+)/.exec(lines[start])[1]
    for (const post of chunk.matchAll(/\.post\s*[<(]/g)) {
      const path = /\(\s*['`]([^'`]*)['`]/.exec(chunk.slice(post.index, post.index + 800))?.[1] ?? ''
      if (/quote/.test(path)) continue
      const held = chunk.lastIndexOf('approvedSpend(ctx', post.index)
      const between = held < 0 ? null : chunk.slice(held, post.index).replace(/\bawait\s+[\w.()]+\s*$/, '')
      if (between === null || /\bawait\b/.test(between)) found.push(`${name} → ${path || '(unnamed route)'}`)
    }
  })
  return found
}
{
  const op = (body) => `export const x: Operation<{}> = {\n  billable: true,\n  async run(input, ctx) {\n${body}\n  },\n}\n`
  assert.deepEqual(unheldSends(op("    await desktop.post('/agent/generation/x', {})")), ['x → /agent/generation/x'], 'self-test: a send with no approvedSpend')
  assert.deepEqual(unheldSends(op("    approvedSpend(ctx)\n    await desktop.requireCapability('y', 'y')\n    await desktop.post('/agent/generation/x', {})")).length, 1, 'self-test: an await between the check and the send')
  assert.deepEqual(unheldSends(op("    const q = await desktop.post('/agent/generation/x-quote', {})\n    const approved = approvedSpend(ctx, input)\n    const r = await ctx.desktop().post<{ a: 1 }>('/agent/generation/x', {})")), [], 'self-test: a quote post, then a held send')
  const unheld = unheldSends(readFileSync(new URL('../packages/shared/src/operations/index.ts', import.meta.url), 'utf8'))
  assert.deepEqual(unheld, [], `A billable op sends without checking the host's approval right before it:\n  ${unheld.join('\n  ')}\nCall approvedSpend(ctx) immediately before the paid send, after the op's last await, so a withdrawn plan sends nothing.`)
}

/** A desktop on a local port. `routes` maps "METHOD /path" to (payload) => answer; `requests` records every call. */
const servers = []
async function desktop(routes, { without = [] } = {}) {
  const requests = []
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
      if (url.pathname === '/agent/healthz') return send(200, { ok: true, agentApiVersion: 2, capabilities: ALL_CAPS.filter((c) => !without.includes(c)) })
      const key = `${req.method} ${url.pathname}`
      const payload = req.method === 'GET' ? Object.fromEntries(url.searchParams) : (raw ? JSON.parse(raw) : null)
      requests.push({ key, payload })
      const route = routes[key]
      if (!route) return send(404, { error: `no route ${key}` })
      try { send(200, route(payload)) } catch (error) { send(400, { error: error.message }) }
    })
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  servers.push(server)
  const client = new SlatesDesktopClient({ token: 'check', port: server.address().port })
  return { requests, client, sent: (key) => requests.filter((r) => r.key === key).map((r) => r.payload) }
}
/** A registry that prices any key asked by name; `prices` overrides, `each` is the default. */
const cloud = (prices = {}, each = 7) => ({
  get: async (path) => {
    const key = new URL(path, 'http://x').searchParams.get('costKey')
    return { models: key ? [{ model: key, cost_credits: prices[key] ?? each }] : Object.entries(prices).map(([model, cost_credits]) => ({ model, cost_credits })) }
  },
})
const ctxFor = (d, registry = cloud()) => ({ desktop: () => d.client, cloud: () => registry })

const projectId = '11111111-1111-4111-8111-111111111111'
const otherProject = '33333333-3333-4333-8333-333333333333'
const id = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`
const assets = [
  { id: id(1), code: 'IMG-A1', type: 'image', projectId },
  { id: id(2), code: 'VID-V1', type: 'video', projectId, duration: 14.6 },
  { id: id(3), code: 'AUD-S1', type: 'audio', projectId, duration: 3.25 },
  ...Array.from({ length: 40 }, (_, i) => ({ id: id(100 + i), code: `IMG-B${i}`, type: 'image', projectId })),
]
const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // an asset of otherProject
const assetRoutes = { 'GET /agent/assets': () => ({ assets }) }

try {
  // ── 1. quote requests ride a body ─────────────────────────────────────────
  {
    const shots = Array.from({ length: 400 }, (_, i) => ({ id: id(1000 + i), code: `SHOT-${i}`, name: `Shot ${i}`, model: 'seedance-2.5' }))
    const board = {
      'GET /agent/shots': () => ({ shots, variety: null, varietySummary: '' }),
      'POST /agent/shots/quote': ({ input }) => ({ items: input.shotIds.map((shotId) => ({ shotId, credits: 1 })) }),
      'GET /agent/shots/quote': ({ input }) => ({ items: JSON.parse(input).shotIds.map((shotId) => ({ shotId, credits: 1 })) }),
    }
    const current = await desktop(board)
    const listed = await listShots.run({ projectId }, ctxFor(current))
    assert.deepEqual(current.sent('POST /agent/shots/quote').map((p) => p.input.shotIds.length), [400], 'a 400-Shot board is quoted in one request, in the body')
    assert.deepEqual(current.sent('GET /agent/shots/quote'), [], 'and nothing rides the URL')
    assert.match(listed.text, /^400 shot\(s\)/)

    const older = await desktop(board, { without: ['quote-post'] })
    await assert.rejects(listShots.run({ projectId }, ctxFor(older)), /too long to send to this version of Slates.*Update Slates/s,
      'a query past the safe length is refused in words')
    assert.deepEqual(older.sent('GET /agent/shots/quote'), [], 'before any request is made')
    shots.length = 5
    await listShots.run({ projectId }, ctxFor(older))
    assert.deepEqual(older.sent('GET /agent/shots/quote').map((p) => JSON.parse(p.input).shotIds.length), [5], 'an older desktop still reads a short quote from the query')
    assert.deepEqual(older.sent('POST /agent/shots/quote'), [], 'and is never sent a body it would not read')

    // The client's own guard, on any GET.
    await assert.rejects(current.client.get('/agent/assets', { projectId: 'x'.repeat(MAX_GET_URL_LENGTH) }), /too long to send/)
    const opsSrc = readFileSync(new URL('../packages/shared/src/operations/index.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(opsSrc, /\.get(?:<[^(]*>)?\(\s*'[^']*quote'[^)]*JSON\.stringify/, 'no op sends a quote request as JSON in a query string')
    assert.doesNotMatch(opsSrc, /QUOTE_CHUNK/, 'and none splits a board to fit a URL')
    console.log('quote-ops: a 400-Shot board is quoted in one body; an older desktop reads a short query and a long one is refused in words')
  }

  // ── 2. the desktop is the one place a video is quoted, and the submission carries the ceiling ──
  {
    const made = { success: true, background: true, generationId: 'gen-1' }
    let quote = { costKey: 'seedance-2.5-vref-720p-20s', credits: 60 }
    let answer = made
    const d = await desktop({
      ...assetRoutes,
      'POST /agent/generation/video-quote': () => quote,
      'POST /agent/generation/video': () => answer,
    })
    const ctx = ctxFor(d, cloud({ 'seedance-2.5-vref-720p-20s': 60, 'seedance-2.5-vref-720p-21s': 63, 'minimax-h3-768p-5s-ref2': 44 }))
    // No clip length is passed: the desktop measures the clip (14.6s here), and its key is the price.
    const call = { projectId, model: 'seedance-2.5', prompt: 'The dancer crosses the roof.', aspectRatio: '16:9', duration: 5, videoResolution: '720p', videoReferenceAssetIds: ['VID-V1'] }
    const own = videoCostKey({ model: 'seedance-2.5', duration: 5, videoResolution: '720p' })
    assert.notEqual(own, quote.costKey, 'this case means something only where the op, unaided, would name another key')

    const preflight = await generateVideo.run({ ...call }, ctx)
    assert.equal(preflight.data.requires_confirm, true)
    assert.deepEqual([preflight.data.variant, preflight.data.estimated_credits], [quote.costKey, 60], 'the pre-flight names the desktop\'s key and its price')
    assert.match(preflight.text, /confirm=true, approvedCredits=60/, 'and the credits to send back as approved')
    assert.deepEqual(d.sent('POST /agent/generation/video'), [], 'a pre-flight sends nothing')
    const quoted = d.sent('POST /agent/generation/video-quote').at(-1).request
    assert.deepEqual(quoted.videoReferenceAssetIds, [id(2)], 'the quote is asked with the resolved ids, in the body')

    await generateVideo.run({ ...call, confirm: true, approvedCredits: 60, background: true }, ctx)
    const submitted = d.sent('POST /agent/generation/video').at(-1)
    assert.equal(submitted.maxCredits, 60, 'the submission carries the quoted credits as its ceiling')
    const { maxCredits: _ceiling, background: _background, ...sentRequest } = submitted
    assert.deepEqual(sentRequest, d.sent('POST /agent/generation/video-quote').at(-1).request, 'and is the request that was quoted, field for field')

    // The clip is re-measured a second longer between the pre-flight and the yes.
    quote = { costKey: 'seedance-2.5-vref-720p-21s', credits: 63 }
    const before = d.sent('POST /agent/generation/video').length
    const dearer = await generateVideo.run({ ...call, confirm: true, approvedCredits: 60, background: true }, ctx)
    assert.deepEqual([dearer.data.quote_exceeded, dearer.data.estimated_credits, dearer.data.variant], [true, 63, 'seedance-2.5-vref-720p-21s'], 'a price above the approved credits is asked about again')
    assert.equal(d.sent('POST /agent/generation/video').length, before, 'and nothing is sent')

    // The desktop composes a dearer request than it quoted (the route's own refusal).
    answer = { success: false, quoteExceeded: { credits: 66, costKey: 'seedance-2.5-vref-720p-22s' } }
    const refused = await generateVideo.run({ ...call, confirm: true, approvedCredits: 63, background: true }, ctx)
    assert.deepEqual([refused.data.quote_exceeded, refused.data.estimated_credits, refused.data.approvedCredits], [true, 66, 66], "the route's refusal comes back as a new price to approve, never an error")
    assert.match(refused.data.message, /^Nothing ran\./)
    answer = made

    // The confirm approves the figure in the unit the desktop holds (list credits), and a run approved below the
    // current quote is asked about again, never sent with a ceiling above the approval.
    assert.equal(preflight.data.approvedCredits, 60, 'the pre-flight names the figure a confirm approves')
    const discounted = ctxFor(d, cloud({ 'seedance-2.5-vref-720p-21s': 45 }))
    discounted.cloud = () => ({ get: async (path) => {
      const key = new URL(path, 'http://x').searchParams.get('costKey') ?? quote.costKey
      return { models: [{ model: key, cost_credits: 45, list_credits: 63 }] }
    } })
    const sentCount = d.sent('POST /agent/generation/video').length
    const underList = await generateVideo.run({ ...call, confirm: true, approvedCredits: 50, background: true }, discounted)
    assert.deepEqual([underList.data.quote_exceeded, underList.data.estimated_credits], [true, 63], 'an approval below the list quote asks again, even where the debit (45) fits under it')
    assert.equal(d.sent('POST /agent/generation/video').length, sentCount, 'and nothing is sent')
    // A host's approval carries the quote it was approved for to the desktop.
    await generateVideo.run({ ...call, confirm: true, background: true }, { ...ctx, spend: { approvedCredits: 63, quoteFingerprint: 'fp-v', approved: () => true } })
    assert.deepEqual([d.sent('POST /agent/generation/video').at(-1).maxCredits, d.sent('POST /agent/generation/video').at(-1).quoteFingerprint], [63, 'fp-v'])

    // MiniMax H3: a character named in the prompt brings reference pictures only the desktop can count.
    quote = { costKey: 'minimax-h3-768p-5s-ref2', credits: 44 }
    const h3 = await generateVideo.run({ projectId, model: 'minimax-h3', prompt: '@Maya walks in.', aspectRatio: '16:9', duration: 5, confirm: true, background: true }, ctx)
    assert.deepEqual([h3.data.variant, h3.data.cost_credits], ['minimax-h3-768p-5s-ref2', 44], 'H3 bills the key the desktop composed, mentions included')
    assert.equal(d.sent('POST /agent/generation/video').at(-1).maxCredits, 44)

    // A desktop before 'video-quote': the op builds the key, so it needs each clip's length, and sends no ceiling.
    const older = await desktop({ ...assetRoutes, 'POST /agent/generation/video': () => made }, { without: ['video-quote', 'quote-post'] })
    const asked = await generateVideo.run({ ...call, confirm: true, background: true }, ctxFor(older))
    assert.deepEqual(asked.data.missing, ['videoReferenceSecondsEach'], 'an older desktop cannot measure for the quote, so the lengths are asked for')
    const legacy = await generateVideo.run({ ...call, videoReferenceSecondsEach: [14.6], confirm: true, background: true }, ctxFor(older))
    assert.equal(legacy.data.variant, videoCostKey({ model: 'seedance-2.5', duration: 5, videoResolution: '720p', videoReferenceSecondsEach: [14.6] }))
    assert.equal('maxCredits' in older.sent('POST /agent/generation/video').at(-1), false)
    console.log('quote-ops: slates_generate_video bills the key the desktop quotes, sends it back as maxCredits, and a dearer call after the yes runs nothing')
  }

  // ── 3. an edit's ratio is part of the price, and the desktop resolves it ──
  {
    const gpt = IMAGE_MODELS.find((m) => m.startsWith('gpt-image'))
    const square = imageCostKey(gpt, '2k', undefined, '1:1')
    const wide = imageCostKey(gpt, '2k', undefined, undefined)
    assert.notEqual(square, wide, 'the ratio moves the GPT Image key')
    const d = await desktop({
      ...assetRoutes,
      'GET /agent/assets/get': () => ({ asset: assets[0] }),
      'POST /agent/generation/edit-image-quote': ({ request }) => ({ model: request.editModel, aspectRatio: request.aspectRatio ?? '1:1', costKey: square, credits: 90 }),
      'POST /agent/generation/edit-image': () => ({ success: true, background: true, generationId: 'gen-2' }),
    })
    const ctx = ctxFor(d, cloud({ [square]: 90, [wide]: 60 }))
    const call = { projectId, sourceAssetId: id(1), prompt: 'Make the jacket red.', editModel: gpt, resolution: '2k' }
    const preflight = await editImage.run({ ...call }, ctx)
    assert.deepEqual([preflight.data.variant, preflight.data.estimated_credits], [square, 90], 'a square picture edited with no ratio named is confirmed at the square key')
    assert.match(preflight.data.message, /at 1:1, the ratio nearest the picture's shape/)
    const ran = await editImage.run({ ...call, confirm: true, background: true }, ctx)
    assert.equal(d.sent('POST /agent/generation/edit-image').at(-1).aspectRatio, '1:1', 'and runs at the ratio that was priced')
    assert.equal(ran.data.cost_credits, 90)
    assert.equal(editImage.input.safeParse({ ...call, aspectRatio: '7:5' }).success, false, 'a ratio no image model takes is refused by the schema')
    assert.equal(editImage.input.safeParse({ ...call, aspectRatio: '1:1' }).success, true)
    console.log(`quote-ops: slates_edit_image confirms ${square}, the key for the ratio the desktop read off the picture, not ${wide}`)
  }

  // ── 4. a lip-sync on uploaded audio is priced on the measured track ──
  {
    let seconds = 23
    const routes = {
      ...assetRoutes,
      'GET /agent/assets/get': () => ({ asset: assets[0] }),
      'POST /agent/generation/lip-sync-quote': () => ({ seconds, credits: null }),
      'POST /agent/generation/lip-sync': () => ({ success: true, asset: { id: id(9) }, generationId: 'gen-3' }),
    }
    const prices = cloud({ 'kling-lip-sync-avatar-5s': 20, 'kling-lip-sync-avatar-25s': 100, 'kling-lip-sync-avatar-30s': 120 })
    const call = { projectId, sourceAssetId: id(1), sourceType: 'image', audioMethod: 'upload', audioFilePath: 'C:/voice/take-3.wav' }
    const d = await desktop(routes)
    const preflight = await generateLipSync.run({ ...call }, ctxFor(d, prices))
    assert.deepEqual([preflight.data.variant, preflight.data.estimated_credits, preflight.data.approvedCredits], ['kling-lip-sync-avatar-25s', 100, 100], 'a 23s track is five blocks, measured before the quote, and that is the figure a confirm approves')
    assert.doesNotMatch(preflight.data.message, /or more|at least/, 'a measured price is the price')
    const ran = await generateLipSync.run({ ...call, confirm: true }, ctxFor(d, prices))
    assert.equal(ran.data.cost_credits, 100)
    assert.equal(d.sent('POST /agent/generation/lip-sync').at(-1).maxCredits, 100, 'the run is held to the price confirmed')

    // The approved figure is a ceiling: a track that now measures longer runs nothing and asks again.
    seconds = 28
    const risen = await generateLipSync.run({ ...call, confirm: true, approvedCredits: 100 }, ctxFor(d, prices))
    assert.deepEqual([risen.data.quote_exceeded, risen.data.estimated_credits, risen.data.approvedCredits], [true, 120, 120], 'a quote above the approved credits is asked about again')
    assert.equal(d.sent('POST /agent/generation/lip-sync').length, 1, 'and nothing is sent')

    seconds = null
    const unread = await generateLipSync.run({ ...call, confirm: true }, ctxFor(d, prices))
    assert.equal(unread.data.requires_clarification, true, 'a track that cannot be measured has no price')
    assert.equal(d.sent('POST /agent/generation/lip-sync').length, 1, 'so it does not run')

    // Desktop 1.6.12 and older cannot measure an uploaded track and ignore the ceiling a run is sent with, so a
    // 30s track approved as one block would bill six: refused before anything is asked or sent.
    const older = await desktop(routes, { without: ['lip-sync-quote'] })
    for (const confirm of [undefined, true]) {
      await assert.rejects(generateLipSync.run({ ...call, confirm }, ctxFor(older, prices)), /'lip-sync-quote'.*Update Slates/s, 'an older desktop is told to update')
    }
    assert.deepEqual(older.requests.filter((r) => r.key.startsWith('POST ')), [], 'and is sent nothing')

    // A clip with no recorded length is quoted at one block; the desktop measures it before it runs and, above the
    // credits it was sent, runs nothing and names its price.
    const unmeasuredClip = { id: id(4), code: 'VID-V2', type: 'video', projectId }
    const clipRoutes = {
      'GET /agent/assets': () => ({ assets: [...assets, unmeasuredClip] }),
      'GET /agent/assets/path': () => ({ code: 'VID-V2', label: null }),
      'POST /agent/generation/lip-sync': ({ maxCredits }) => (maxCredits < 360
        ? { success: false, quoteExceeded: { credits: 360, costKey: 'kling-lip-sync-video-90s', fingerprint: 'fp-90s' } }
        : { success: true, asset: { id: id(9) }, generationId: 'gen-4' }),
    }
    const clipPrices = cloud({ 'kling-lip-sync-video-5s': 20 })
    const clipCall = { projectId, sourceAssetId: id(4), sourceType: 'video', audioMethod: 'tts', ttsText: 'Hello there.', ttsVoice: 'oversea_male1' }
    const measuring = await desktop(clipRoutes)
    const floor = await generateLipSync.run({ ...clipCall }, ctxFor(measuring, clipPrices))
    assert.deepEqual([floor.data.requires_confirm, floor.data.quote_is_floor, floor.data.approvedCredits], [true, true, 20])
    assert.match(floor.data.message, /^Cost: at least 20 credits, one 5s block/)
    const dearer = await generateLipSync.run({ ...clipCall, confirm: true }, ctxFor(measuring, clipPrices))
    assert.deepEqual([dearer.data.quote_exceeded, dearer.data.estimated_credits, dearer.data.approvedCredits, dearer.data.quote_fingerprint], [true, 360, 360, 'fp-90s'], 'a floor approved at one block is asked about again at 18, naming that quote')
    assert.deepEqual(measuring.sent('POST /agent/generation/lip-sync').map((p) => p.maxCredits), [20], 'held to the floor that was quoted')
    // The call that carries the measured price shows the user that figure before it runs, and runs held to it.
    const shown = await generateLipSync.run({ ...clipCall, approvedCredits: 360 }, ctxFor(measuring, clipPrices))
    assert.deepEqual([shown.data.requires_confirm, shown.data.approvedCredits], [true, 360])
    assert.match(shown.data.message, /up to 360 credits/, 'a ceiling above the quote is named before anything runs')
    assert.equal(measuring.sent('POST /agent/generation/lip-sync').length, 1)
    await generateLipSync.run({ ...clipCall, confirm: true, approvedCredits: 360 }, ctxFor(measuring, clipPrices))
    assert.equal(measuring.sent('POST /agent/generation/lip-sync').at(-1).maxCredits, 360, 'the approved price is the new ceiling')
    const olderClip = await desktop(clipRoutes, { without: ['lip-sync-quote'] })
    await assert.rejects(generateLipSync.run({ ...clipCall, confirm: true }, ctxFor(olderClip, clipPrices)), /'lip-sync-quote'/, 'an unmeasured clip on an older desktop is refused too')
    assert.deepEqual(olderClip.sent('POST /agent/generation/lip-sync'), [])

    // A host with its own spending decision (the desktop Studio Agent's loop): the input's approvedCredits is not
    // read, the ceiling and the quote are the host's, and a call whose approval was withdrawn sends nothing.
    const hosted = (spend) => ({ ...ctxFor(measuring, clipPrices), spend })
    await generateLipSync.run({ ...clipCall, confirm: true, approvedCredits: 999 }, hosted({ approved: () => true }))
    assert.deepEqual([measuring.sent('POST /agent/generation/lip-sync').at(-1).maxCredits, measuring.sent('POST /agent/generation/lip-sync').at(-1).quoteFingerprint],
      [20, undefined], "the model's approvedCredits raises nothing")
    await generateLipSync.run({ ...clipCall, confirm: true }, hosted({ approvedCredits: 360, quoteFingerprint: 'fp-90s', approved: () => true }))
    assert.deepEqual([measuring.sent('POST /agent/generation/lip-sync').at(-1).maxCredits, measuring.sent('POST /agent/generation/lip-sync').at(-1).quoteFingerprint],
      [360, 'fp-90s'], "the host's approval, for the quote it approved")
    const sentBefore = measuring.sent('POST /agent/generation/lip-sync').length
    await assert.rejects(generateLipSync.run({ ...clipCall, confirm: true }, hosted({ approvedCredits: 360, approved: () => false })), /withdrawn/)
    assert.equal(measuring.sent('POST /agent/generation/lip-sync').length, sentBefore, 'a withdrawn approval sends nothing')

    // Motion transfer: a clip with no recorded length is a floor, held to it, and never reported as its cost.
    const motion = await desktop({
      'GET /agent/assets': () => ({ assets: [...assets, unmeasuredClip] }),
      'GET /agent/assets/path': () => ({ code: 'VID-V2', label: null }),
      'POST /agent/generation/motion-transfer': () => ({ success: true, asset: { id: id(9) }, generationId: 'gen-5' }),
    })
    const mt = { projectId, sourceVideoAssetId: id(4), targetImageAssetId: id(1), motionModel: 'kling-mc-std' }
    const mtFloor = await generateMotionTransfer.run({ ...mt }, ctxFor(motion, cloud({ 'kling-mc-std-5s': 30 })))
    assert.deepEqual([mtFloor.data.requires_confirm, mtFloor.data.quote_is_floor, mtFloor.data.approvedCredits], [true, true, 30])
    const mtRan = await generateMotionTransfer.run({ ...mt, confirm: true }, ctxFor(motion, cloud({ 'kling-mc-std-5s': 30 })))
    assert.equal(motion.sent('POST /agent/generation/motion-transfer').at(-1).maxCredits, 30, 'held to the one-block floor')
    assert.deepEqual([mtRan.data.cost_credits, mtRan.data.minimum_credits, mtRan.data.quote_is_floor], [null, 30, true], 'an unmeasured clip never reports the floor as its cost')
    const mtRisen = await generateMotionTransfer.run({ ...mt, confirm: true, approvedCredits: 25 }, ctxFor(motion, cloud({ 'kling-mc-std-5s': 30 })))
    assert.deepEqual([mtRisen.data.quote_exceeded, mtRisen.data.approvedCredits], [true, 30], 'a quote above an approved ceiling asks again, never raises it')
    assert.equal(motion.sent('POST /agent/generation/motion-transfer').length, 1, 'and sends nothing')
    const mtOlder = await desktop({ 'GET /agent/assets': () => ({ assets: [...assets, unmeasuredClip] }) }, { without: ['lip-sync-quote'] })
    await assert.rejects(generateMotionTransfer.run({ ...mt, confirm: true }, ctxFor(mtOlder, cloud({ 'kling-mc-std-5s': 30 }))), /'lip-sync-quote'/, 'an older desktop would bill every block of an unmeasured clip')

    // A tier debited below list (the admin tier): the ceiling the desktop compares is the list price, the unit it quotes in.
    const discounted = { get: async (path) => {
      const key = new URL(path, 'http://x').searchParams.get('costKey')
      return { models: [{ model: key, cost_credits: 20, list_credits: 60 }] }
    } }
    const mtMeasured = { ...mt, sourceVideoAssetId: id(2) }
    const listed = await generateMotionTransfer.run({ ...mtMeasured }, ctxFor(motion, discounted))
    assert.deepEqual([listed.data.estimated_credits, listed.data.approvedCredits], [20, 60], 'the user sees the debit; the confirm approves the list figure the desktop holds')
    const listRan = await generateMotionTransfer.run({ ...mtMeasured, confirm: true }, ctxFor(motion, discounted))
    assert.deepEqual([motion.sent('POST /agent/generation/motion-transfer').at(-1).maxCredits, listRan.data.cost_credits], [60, 20], 'held in list credits, reported at the debit')
    console.log('quote-ops: a lip-sync on uploaded audio is quoted on the measured track and refused on a desktop that cannot hold it; an approved figure is a ceiling that asks again when the quote rises; ceilings are in list credits')
  }

  // ── 5. a partial batch cost what was saved ──
  {
    const d = await desktop({
      'POST /agent/generation/image': () => ({ success: false, error: 'content policy', assets: [{ id: id(20), code: 'IMG-C1', type: 'image' }, { id: id(21), code: 'IMG-C2', type: 'image' }] }),
      'GET /agent/assets/image': () => ({ data: 'AAAA', mimeType: 'image/png', bytes: 3 }),
    })
    const partial = await generateImage.run({ projectId, model: 'nano-banana-2-1', prompt: 'A lighthouse at dusk.', aspectRatio: '16:9', count: 4, confirm: true }, ctxFor(d, cloud({}, 4)))
    assert.deepEqual([partial.data.partial, partial.data.cost_credits, partial.data.quoted_credits], [true, 8, 16], 'two of four saved cost two images, not the four quoted')
    assert.match(partial.text, /2 of 4 image\(s\) saved .* for 8 credits, not the 16 credits quoted/)
    console.log('quote-ops: a partial image batch reports the saved images\' cost')
  }

  // ── 6. an id from another project is a miss ──
  {
    const d = await desktop({
      ...assetRoutes,
      'GET /agent/assets/get': () => ({ asset: { id: foreign, projectId: otherProject, prompt: 'private' } }),
      'POST /agent/timeline/cut': (body) => ({ replaced: body.assetId }),
    })
    await assert.rejects(getAsset.run({ projectId, assetId: foreign }, ctxFor(d)), /No asset matching "bbbbbbbb-.*" in this project/, "another project's asset id is refused by slates_get_asset")
    assert.deepEqual(d.sent('GET /agent/assets/get'), [], 'before the desktop is asked for it')
    await assert.rejects(generateVideo.run({ projectId, model: 'seedance-2.5', prompt: 'Go.', aspectRatio: '16:9', duration: 5, firstFrameAssetId: foreign, confirm: true }, ctxFor(d)), /No asset matching/, 'and as a start frame')
    await getAsset.run({ projectId, assetId: id(1) }, ctxFor(d))
    assert.deepEqual(d.sent('GET /agent/assets/get'), [{ id: id(1), projectId }], "the project's own asset is read, with its project named")
    // The one cross-project reference Slates allows: a clip on a timeline.
    await editCut.run({ action: 'replace', projectId, clipId: id(50), assetId: foreign }, ctxFor(d))
    assert.equal(d.sent('POST /agent/timeline/cut').at(-1).assetId, foreign, 'a timeline clip may show media from another project')
    console.log("quote-ops: an asset id from another project is refused before any route sees it; a timeline clip's media may cross projects")
  }

  // ── 7. over a cap is refused, and the caps are the rows' ──
  {
    const d = await desktop({ ...assetRoutes })
    const ctx = ctxFor(d)
    const refs = (n) => Array.from({ length: n }, (_, i) => `IMG-B${i}`)
    const maxLength = (schema) => { let node = schema; while (node?._def && node._def.maxLength === undefined) node = node._def.innerType; return node?._def.maxLength?.value }
    const imageCap = (m) => MODEL_CAPABILITIES[m].maxRefImages ?? 0
    assert.equal(maxLength(generateImage.input.shape.referenceAssetIds), Math.max(...IMAGE_MODELS.map(imageCap)), "generate_image's reference list is as long as the largest row's cap")
    assert.equal(maxLength(generateVideo.input.shape.ingredientAssetIds), Math.max(...VIDEO_MODELS.map((m) => maxIngredientImagesFor(m))), "generate_video's ingredient list is as long as the largest row's cap")
    for (const model of IMAGE_MODELS) {
      const cap = imageCap(model)
      if (cap >= Math.max(...IMAGE_MODELS.map(imageCap))) continue
      const over = await generateImage.run({ projectId, model, prompt: 'A room.', aspectRatio: '1:1', referenceAssetIds: refs(cap + 1), confirm: true }, ctx)
      assert.deepEqual([over.data.requires_clarification, over.data.missing], [true, ['referenceAssetIds']], `${model}: ${cap + 1} references are refused`)
      assert.match(over.data.message, new RegExp(`^Nothing ran\\. ${model.replace(/[.]/g, '\\.')} reads at most ${cap} reference images and this call names ${cap + 1}\\.`))
      // An edit carries the source as image 1, so one fewer beside it.
      const edit = await editImage.run({ projectId, sourceAssetId: id(1), prompt: 'Red jacket.', editModel: model, referenceAssetIds: refs(cap).map((_, i) => id(100 + i)), confirm: true }, ctx)
      assert.deepEqual([edit.data.requires_clarification, edit.data.missing], [true, ['referenceAssetIds']], `${model}: an edit with ${cap} references beside the source is refused`)
    }
    let videoCells = 0
    for (const model of VIDEO_MODELS) {
      const cap = maxIngredientImagesFor(model)
      if (!cap || cap + 1 > maxLength(generateVideo.input.shape.ingredientAssetIds)) continue
      const over = await generateVideo.run(generateVideo.input.parse({ projectId, model, prompt: 'A room.', aspectRatio: '16:9', duration: 5, ingredientAssetIds: refs(cap + 1), confirm: true }), ctx)
      assert.equal(over.data?.requires_clarification, true, `${model}: ${cap + 1} reference images are refused, not trimmed`)
      videoCells++
    }
    assert.ok(videoCells > 3, 'the video sweep covered the roster')
    assert.deepEqual(d.requests.filter((r) => r.key.startsWith('POST ')), [], 'nothing was quoted, sent or spent')
    console.log(`quote-ops: references past a model's cap are refused before any request, on every image seat and ${videoCells} video models; the schema maxima are the rows'`)
  }

  // ── 8. the asset list shows a clip's length ──
  {
    const d = await desktop({ ...assetRoutes, 'GET /agent/folders': () => ({ folders: [] }) })
    const listed = await listAssets.run({ projectId, type: 'video' }, ctxFor(d))
    const row = (listed.data.assets ?? []).find((a) => a.id === id(2))
    assert.equal(row?.duration, 14.6, 'slates_list_assets carries each clip\'s measured length')
    console.log('quote-ops: slates_list_assets shows a clip\'s length')
  }
} finally {
  for (const server of servers) server.close()
}
