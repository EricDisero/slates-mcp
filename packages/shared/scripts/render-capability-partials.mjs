// ============================================================
// GENERATED PARTIALS — the numbers a skill states that the CODE enforces.
//
// 🚨 FOUR SKILLS STATED FOUR NUMBERS THE OPS REFUSE (measured 2026-09-02):
//
//   * `slates-model-selection` said Seed Audio takes "1–120s". The op's floor
//     is 3, and it REFUSES below it. An agent following the skill quoted a
//     duration the proxy rejects — the exact bug the 2026-08 audio fix removed
//     from the code, still alive in the prose beside it.
//   * The same table, and `slates-prompting-elevenlabs`'s own frontmatter, said
//     Sound Effects takes "0.5–22s". The floor is 1.
//   * `slates-cost-discipline` told the agent the deviation threshold was
//     ">25%". The desktop pauses at 20%.
//   * Two skills hand-typed the confirm threshold as "~17 credits" — right
//     today, and a rate change away from being wrong in three places.
//
// Every one of those was a fact the code already owned. So they are GENERATED
// now: this script reads the built `@slatesvideo/shared` dist and writes
// `skills/_partials/thresholds.md`, which `sync-partials.mjs` injects between
// the `@inject:thresholds` markers in every skill that quotes one. Change the
// constant; the skills follow on the next build, and `sync-partials --check`
// fails the build if they have not.
//
// MODES
//   (no flag)  write the partial(s)
//   --check    fail if what is on disk differs from what would be written
//
// Runs BEFORE sync-partials in the build chain — it produces the partial that
// sync-partials then injects.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const partialsDir = join(pkgRoot, 'skills', '_partials')
const CHECK = process.argv.includes('--check')

const dist = join(pkgRoot, 'dist', 'index.js')
let shared
try {
  shared = await import(pathToFileURL(dist).href)
} catch {
  console.error(
    '[capability-partials] packages/shared/dist is missing or stale — run `tsc` first. ' +
      'This script reads the BUILT constants, not the source, so it cannot disagree with what ships.'
  )
  process.exit(1)
}

const {
  CONFIRM_CREDITS,
  DEVIATION_FACTOR,
  operations: { SEED_AUDIO_MIN_SECONDS, SEED_AUDIO_MAX_SECONDS, ELEVEN_SFX_MIN_SECONDS, ELEVEN_SFX_MAX_SECONDS },
} = shared

const deviationPct = Math.round((DEVIATION_FACTOR - 1) * 100)

/** The one place these four facts are written for a human to read. */
const thresholds = `<!-- GENERATED from @slatesvideo/shared — do not edit between the markers.
     Source: CONFIRM_CREDITS, DEVIATION_FACTOR and the audio bounds in
     packages/shared/src/operations/index.ts. Every number here is REFUSED by an
     op when a prompt gets it wrong, which is why none of them is typed by hand
     any more: this block replaced four claims that contradicted the code. -->

**The thresholds, from the code that enforces them:**

- **Confirm gate:** above **${CONFIRM_CREDITS} credits** an op returns \`requires_confirm\` and will not
  proceed until you re-call with \`confirm: true\`. Below it, announce the cost once and go.
- **Deviation pause:** the desktop Studio Agent stops and re-asks when projected generation spend
  exceeds the approved plan by more than **${deviationPct}%**. You do not trigger this; the app does.
- **Seed Audio duration:** **${SEED_AUDIO_MIN_SECONDS}–${SEED_AUDIO_MAX_SECONDS} seconds.** There is no duration
  parameter on the model — the number you pass is written into the prompt AND is what the user is
  billed. Outside that range the op refuses rather than clamping.
- **Sound Effects duration:** **${ELEVEN_SFX_MIN_SECONDS}–${ELEVEN_SFX_MAX_SECONDS} seconds**, billed per second, never left for the
  model to pick.

Never quote a credit figure from memory: \`slates_estimate_generation_cost\` returns the real one.`

const files = { 'thresholds.md': thresholds }

let drift = 0
mkdirSync(partialsDir, { recursive: true })
for (const [name, body] of Object.entries(files)) {
  const path = join(partialsDir, name)
  let current = null
  try {
    current = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  } catch {
    /* missing is drift */
  }
  const next = `${body}\n`
  if (current === next) continue
  if (CHECK) {
    console.error(`[capability-partials] _partials/${name} is stale.`)
    drift++
  } else {
    writeFileSync(path, next)
    console.log(`[capability-partials] wrote _partials/${name}`)
  }
}

if (drift > 0) {
  console.error('[capability-partials] run `npm run render-partials -w packages/shared` to fix.')
  process.exit(1)
}
console.log(
  `[capability-partials] ${CHECK ? 'verified' : 'rendered'} ${Object.keys(files).length} partial(s) ` +
    `(confirm ${CONFIRM_CREDITS}cr, deviation ${deviationPct}%, seed-audio ${SEED_AUDIO_MIN_SECONDS}-${SEED_AUDIO_MAX_SECONDS}s, sfx ${ELEVEN_SFX_MIN_SECONDS}-${ELEVEN_SFX_MAX_SECONDS}s)`
)
