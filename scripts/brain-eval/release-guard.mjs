// A run of every case is the release batch, and it runs once, on the final brain hash, right before
// brain-review.mjs --approve (Eric, 2026-10-25): --approve needs results on the exact hash it approves, so a batch
// started before every fix and revert landed is an hour of plan usage thrown away (three were started that night and
// two thrown away). release-batch.mjs is the one way to start one: it checks the page is answered and the tree final
// first, then sets RELEASE_BATCH_ENV for the runs it starts. A targeted --cases run stays open, since that is how a
// fix is diagnosed. behaviour-ab/run.mjs and routing.mjs call this before they build an arm or spawn a session.
export const RELEASE_BATCH_ENV = 'SLATES_RELEASE_BATCH'

/** Ends the process when `selected` cases are the whole set of `total` and release-batch.mjs did not start it. */
export function refuseFullRun(script, { selected, total }) {
  if (selected < total || process.env[RELEASE_BATCH_ENV]) return
  console.error(`✗ ${script}: all ${total} cases is the release batch, which runs once on the final brain hash; start it with scripts/brain-eval/release-batch.mjs, or pass --cases id,id for what a fix touches.`)
  process.exit(1)
}
