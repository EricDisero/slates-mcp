// The video ops refuse a malformed call before any desktop or cloud request.
// Runs against the built package (npm run build -w packages/shared first).
import assert from 'node:assert/strict'
import { generateVideo, editVideo, createShot, generateAudio, estimateGenerationCost, videoCostKey, VIDEO_MODELS, ELEVEN_SFX_MIN_SECONDS } from '../packages/shared/dist/operations/index.js'
import {
  MODEL_CAPABILITIES, billedReferenceSeconds, checkReferenceSeconds, checkVideoParams, maxReferenceVideosFor, referenceSecondsBounds,
} from '../packages/shared/dist/prompts/model-capabilities.js'

const projectId = '11111111-1111-4111-8111-111111111111'
const noTransport = { desktop: () => { throw new Error('no desktop call expected') }, cloud: () => { throw new Error('no cloud call expected') } }

// audioReferenceSpokenText pairs by position on EVERY model: one line for two clips
// would send clip A with clip B's words. It was enforced only inside the MiniMax block.
for (const model of ['seedance-2.5', 'wan-3.0', 'minimax-h3']) {
  const r = await generateVideo.run(generateVideo.input.parse({
    model, projectId, prompt: 'Two people talk.', aspectRatio: '16:9', duration: 5,
    ingredientAssetIds: ['IMG-A1'], audioReferenceAssetIds: ['AUD-S1', 'AUD-S2'], audioReferenceSpokenText: ['the words in clip two'],
  }), noTransport)
  assert.equal(r.data?.requires_clarification, true, `${model}: a misaligned spoken-text array is refused`)
  assert.match(r.data.message, /pairs by position/)
}
// The Shot path pairs through the same rule.
const shot = await createShot.run(createShot.input.parse({
  projectId, prompt: 'Two people talk.', refs: { 'audio-reference': ['AUD-S1', 'AUD-S2'] }, audioRefSpokenText: ['one line'],
}), noTransport)
assert.match(shot.data?.message ?? '', /pairs by position/)

// edit_video takes the union of its engines' resolutions; each engine's own row decides.
const editDesktop = { desktop: () => ({ requireCapability: async () => {}, get: async (path) => { throw new Error('unexpected GET ' + path) } }), cloud: noTransport.cloud }
const edit = await editVideo.run(editVideo.input.parse({
  projectId, sourceVideoAssetId: 'VID-V1', prompt: 'Make it night.', model: 'omni-flash-1-2-edit', videoResolution: '480p',
}), editDesktop)
assert.equal(edit.data?.requires_clarification, true, 'omni-flash-1-2-edit at 480p is a capability refusal, not a registry miss')
assert.match(edit.data.message, /omni-flash-1-2-edit does not render at 480p/)

// ── Reference seconds: one rounding and one verdict, for every model the op offers ──
// The desktop, its handlers and the server call the same helpers (slates-api's
// composition-matrix-check.mjs sweeps all four layers); this proves the op's half here.
assert.equal(billedReferenceSeconds([4.3, 4.3, 4.3]), 15, 'each clip rounds up on its own, never the sum')
assert.equal(billedReferenceSeconds([8.02]), 8, 'a probe reading a few hundredths long is not a second')

/** The op's verdict on a set of reference clips: null when its gates pass (it reached a transport), else its refusal. */
const clipRefusal = async (model, clips) => {
  const input = generateVideo.input.parse({
    model, projectId, prompt: 'A lighthouse at dusk.', aspectRatio: '16:9', duration: 5,
    videoReferenceAssetIds: clips.map((_, i) => `VID-V${i + 1}`), videoReferenceSecondsEach: clips,
  })
  try {
    const r = await generateVideo.run(input, noTransport)
    return r.data?.message ?? JSON.stringify(r.data)
  } catch (e) {
    if (/no (desktop|cloud) call expected/.test(e.message)) return null
    throw e
  }
}
let clipCells = 0
for (const model of VIDEO_MODELS) {
  const maxClips = maxReferenceVideosFor(model, 5)
  if (!maxClips) continue
  const { clip, max } = referenceSecondsBounds(model, 'video')
  const rowBasis = MODEL_CAPABILITIES[model].referenceVideoSecondsBasis ?? 'actual'
  const longest = clip?.max ?? max
  // The op refuses exactly what the shared verdict refuses, on every edge the row declares.
  const sets = [[longest - 0.2], [longest + 0.03], [longest + 1]]
  // Measured seconds under the cap while the rounded-up seconds are over it: accepted where the row
  // counts measured seconds (the desktop used to refuse it after the op had quoted it).
  if (max > 0 && maxClips >= 2) {
    const k = Math.min(maxClips, 4)
    const each = Math.floor((max / k) * 10) / 10 - 0.5
    if (each > 0 && (!clip || (each >= clip.min && each <= clip.max))) sets.push(Array(k).fill(each))
  }
  for (const clips of sets) {
    clipCells++
    const verdict = checkReferenceSeconds(model, 'video', clips)
    const refusal = await clipRefusal(model, clips)
    assert.equal(refusal === null, verdict.error === null, `${model} [${clips.join(', ')}]s: the op ${refusal ? `refuses (${refusal})` : 'accepts'} and checkReferenceSeconds ${verdict.error ? `refuses (${verdict.error})` : 'accepts'}`)
    const clipsFit = clips.every((sec) => !clip || (sec >= clip.min && sec <= clip.max))
    if (rowBasis === 'actual' && max > 0 && clipsFit && verdict.actual <= max) assert.equal(verdict.error, null, `${model} [${clips.join(', ')}]s is ${verdict.actual.toFixed(1)}s measured, inside its ${max}s cap`)
    if (rowBasis === 'billed' && max > 0 && verdict.billed > max) assert.ok(verdict.error, `${model} [${clips.join(', ')}]s bills ${verdict.billed}s, past its ${max}s cap`)
  }
  // A probe reads a clip a few hundredths long: that much over a per-clip ceiling is still the ceiling.
  if (clip) {
    assert.ok(!/long\. Trim/.test(checkReferenceSeconds(model, 'video', [clip.max + 0.03]).error ?? ''), `${model}: a ${clip.max + 0.03}s clip is inside its ${clip.max}s ceiling`)
    assert.match(checkReferenceSeconds(model, 'video', [clip.max + 0.2]).error ?? '', /long\. Trim/, `${model}: a ${clip.max + 0.2}s clip is over its ${clip.max}s ceiling`)
  }
}
assert.ok(clipCells > 0, 'no model the op offers takes a reference video, so the sweep proved nothing')

// The estimate, the generate quote and the key bill the same seconds for the same clips, and never clamp.
const estimateKey = async (input) => {
  const empty = { desktop: noTransport.desktop, cloud: () => ({ get: async () => ({ models: [] }) }) }
  try {
    const r = await estimateGenerationCost.run(estimateGenerationCost.input.parse(input), empty)
    return `no key (${r.data?.message ?? JSON.stringify(r.data)})`
  } catch (e) {
    return /^No price for (\S+):/.exec(e.message)?.[1] ?? `no key (${e.message})`
  }
}
for (const model of VIDEO_MODELS.filter((m) => MODEL_CAPABILITIES[m].referenceVideoSecondsBasis === 'billed' || m === 'wan-3.0')) {
  const clips = [2.3, 2.3, 2.3]
  const key = videoCostKey({ model, duration: 5, videoReferenceSecondsEach: clips })
  assert.match(key, /-vref-.*-14s$/, `${model}: three 2.3s clips bill 9s in (3 each) plus 5s out, got ${key}`)
  assert.equal(await estimateKey({ type: 'video', model, duration: 5, videoReferenceSecondsEach: clips }), key, `${model}: the estimate quotes the key generate bills`)
  // The deprecated single value still reads as one clip.
  assert.equal(videoCostKey({ model, duration: 5, videoRefSeconds: 6.9 }), key.replace(/-14s$/, '-12s'), `${model}: videoRefSeconds is one clip`)
}

// Reference images at a resolution with no reference slot are refused from the row, before the quote.
for (const [model, cap] of Object.entries(MODEL_CAPABILITIES)) {
  for (const videoResolution of cap.noReferenceImagesAt ?? []) {
    const refusal = checkVideoParams(model, { videoResolution, referenceImages: 1, firstFrame: true })
    assert.equal(refusal?.field, 'references', `${model}: a reference image at ${videoResolution} is refused`)
    assert.equal(checkVideoParams(model, { videoResolution, referenceImages: 0 }), null, `${model}: ${videoResolution} without references is legal`)
  }
}

// A length the Sound Effects refusal recommends is a length the op takes.
const sfx = async (durationSeconds) => {
  try {
    return (await generateAudio.run(generateAudio.input.parse({ projectId, prompt: 'A door slams.', model: 'eleven-sfx', durationSeconds }), noTransport)).data?.message ?? null
  } catch (e) {
    if (/no (desktop|cloud) call expected/.test(e.message)) return null
    throw e
  }
}
const hint = await sfx(ELEVEN_SFX_MIN_SECONDS / 2)
assert.ok(hint, 'half the shortest sound effect is refused')
const recommended = [...hint.slice(hint.indexOf('Roughly')).matchAll(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?s\b/g)].flatMap(([, from, to]) => [from, to].filter(Boolean).map(Number))
assert.ok(recommended.length >= 3, 'the refusal recommends lengths')
for (const seconds of recommended) assert.equal(await sfx(seconds), null, `the refusal recommends ${seconds}s and the op refuses it`)

console.log(`Video op guards: spoken-text pairing on every model and the Shot path; edit resolution per engine; ${clipCells} reference clip sets reach the shared verdict; the estimate and generate bill one key; no reference images where the row has no slot; every recommended sound-effect length is legal.`)
