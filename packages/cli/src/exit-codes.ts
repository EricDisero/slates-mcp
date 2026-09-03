// ============================================================
// CLI EXIT CODES — a CONTRACT, not a convenience.
//
// Every completed op used to exit 0, including `requires_confirm` and
// `requires_clarification`. A script or an agent reading the exit code could
// not tell "done" from "I asked you something", and the natural reaction to a 0
// is to move on — so the question went unanswered and the work silently did not
// happen.
//
// 🚨 THESE NUMBERS ARE PUBLIC. Scripts and agent skills will branch on them.
// Add codes; never renumber one.
// ============================================================

export const EXIT = {
  /** The op ran and finished. */
  OK: 0,
  /** Anything went wrong: bad arguments, a provider error, an unexpected throw. */
  ERROR: 1,
  /** The op returned `requires_confirm` — a human has to OK the spend, then
   *  re-call with `--confirm true`. Nothing was charged. */
  CONFIRM_REQUIRED: 3,
  /** The op returned `requires_clarification` — a required choice is missing
   *  (aspect ratio, resolution, duration). Its `message` names the field. */
  CLARIFICATION_REQUIRED: 4,
  /** The Slates desktop app is not running with Agent Control on. */
  DESKTOP_UNREACHABLE: 5,
  /** No cloud token, or it was revoked. Run `slates login`. */
  NOT_SIGNED_IN: 6,
} as const

/** Map a thrown error to its exit code. Retrying a 5 or a 6 is pointless until
 *  the user does something; retrying a 1 might work. That distinction is the
 *  whole reason these exist. */
export function exitFor(err: unknown): number {
  const code = (err as { code?: unknown })?.code
  if (code === 'DESKTOP_SERVER_MISSING') return EXIT.DESKTOP_UNREACHABLE
  if (code === 'CLOUD_TOKEN_MISSING') return EXIT.NOT_SIGNED_IN
  const message = err instanceof Error ? err.message : String(err)
  if (/not reachable|Agent Control|is not running/i.test(message)) return EXIT.DESKTOP_UNREACHABLE
  if (/rejected the auth token|slates login|401/i.test(message)) return EXIT.NOT_SIGNED_IN
  return EXIT.ERROR
}
