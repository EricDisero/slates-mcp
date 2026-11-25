import type { OperationResult, ToolDefinition } from '@slatesvideo/shared'

/**
 * WHO ASKS THE USER BEFORE AN OP THAT TAKES `confirm` RUNS.
 *
 * A model's `confirm: true` is not the user's yes: a prompt-injected agent can
 * send it on its first call. Where the host can show the user a form, the user
 * is asked, and which side asks is read off the op's rendered schema:
 *
 * - `op-asks`: `confirm` is optional. The op run without it spends nothing and
 *   returns `requires_confirm` with its quote; the user answers that quote.
 * - `server-asks`: `confirm` is required, so the op has no call that only
 *   quotes. The user is asked before it runs at all. Until 2026-11-24 these ran
 *   with the model's confirm stripped, expecting a quote the op never returns,
 *   so the two draft-finish ops spent credits with nobody asked.
 * - `none`: no `confirm` input, nothing to ask (a quote op's `requires_confirm`
 *   is information about a later call).
 */
export type ConfirmGate = 'none' | 'op-asks' | 'server-asks'

export function confirmGate(inputSchema: ToolDefinition['inputSchema']): ConfirmGate {
  const properties = (inputSchema.properties ?? {}) as Record<string, unknown>
  if (!Object.hasOwn(properties, 'confirm')) return 'none'
  const required = Array.isArray(inputSchema.required) ? (inputSchema.required as unknown[]) : []
  return required.includes('confirm') ? 'server-asks' : 'op-asks'
}

export const DECLINED_TEXT =
  'The user declined or did not answer, so nothing ran. Do not re-call without new instructions.'

/** The question for an op that cannot quote itself: its id and the ceiling the model sent. */
function serverQuestion(opId: string, args: Record<string, unknown>): string {
  const ceiling = typeof args.maxCredits === 'number' ? ` It may spend up to ${args.maxCredits} credits.` : ''
  return `Slates is about to run ${opId}, which the assistant marked as approved by you.${ceiling} Go ahead?`
}

export interface ConsentCall {
  opId: string
  gate: ConfirmGate
  /** The parsed arguments the model sent. */
  args: Record<string, unknown>
  /** Whether this host can put a form in front of the user right now. */
  hostCanAsk: boolean
  /** Run the op; `patch` overrides fields of the parsed arguments for that run. */
  run(patch?: Record<string, unknown>): Promise<OperationResult>
  /** The user's answer, or null when no person gave one and the model's own arguments stand. */
  ask(message: string): Promise<boolean | null>
}

/** Run one tool call with the user's consent where the host can ask for it. `declined` means nothing ran. */
export async function runWithConsent(call: ConsentCall): Promise<OperationResult | { declined: true }> {
  const { gate, args, run, ask } = call
  if (gate === 'none' || !call.hostCanAsk) return run()

  if (gate === 'server-asks') {
    if ((await ask(serverQuestion(call.opId, args))) === false) return { declined: true }
    return run()
  }

  // The op runs without the model's confirm, so its own gate quotes and the user answers the quote.
  const claimed = args.confirm === true
  const first = await run(claimed ? { confirm: undefined } : undefined)
  const data = first.data as Record<string, unknown> | undefined
  // `confirm_sends_as_written` is the one clarification confirm answers: without it, a claimed
  // confirm would come back the same clarification forever, with nobody asked.
  if (!(data?.requires_confirm === true || (claimed && data?.confirm_sends_as_written === true))) return first

  const answer = await ask(typeof data.message === 'string' ? data.message : first.text)
  if (answer === false) return { declined: true }
  if (answer === true) {
    // A quote that carries a fingerprint (`slates_generate_from_shots`) is fired only with it: the
    // user approved THAT quote, and a changed recipe must still refuse.
    const fingerprint = typeof data.fingerprint === 'string' ? { fingerprint: data.fingerprint } : {}
    return run({ ...fingerprint, confirm: true })
  }
  // null: no person answered, so this call stands as it would on a host with no elicitation. The
  // model's own confirm and fingerprint run, and without a confirm the quote goes back to the model.
  return claimed ? run() : first
}
