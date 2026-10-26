/**
 * The Slates analytics taxonomy: every event name slates-api, slates-web and
 * slate send to PostHog, who sends it, and what a purchase event must carry.
 *
 * ONE HOME. This file is the source; slates-web's `npm run build:llm-docs`
 * copies it verbatim into each consumer (`slates-web/src/app/lib/generated/analytics-events.ts`,
 * `slates-api/src/lib/generated/analytics-events.ts`, `slate/src/shared/analyticsEvents.ts`)
 * and its `--check` fails on drift. The consumers do not import the npm package for
 * this: a new shared export would make every API deploy wait on a shared
 * publish, which the release runbook ties to a desktop version bump.
 *
 * Each repo's `check:analytics` scans its source with `findEventCalls` below and
 * fails on a name outside this list, a name only the code can compute, a call
 * form it does not know, or a name listed for the repo that its code never sends. Plan: second-brain
 * `plans/2026-10-07-slates-launch-tracking-proof.md` § The event taxonomy.
 *
 * Self-contained on purpose: no imports, no Node APIs, so the copy is safe in
 * the renderer and the site bundle.
 */

export type AnalyticsSender = 'slates-api' | 'slates-web' | 'slate';

export type AnalyticsKind =
  /** A paid charge, sent by slates-api after the grant. Forwarded to Meta and Google. */
  | 'purchase'
  /** A step on the way to a charge: page views, checkout, upsell decisions. */
  | 'funnel'
  /** The buyer using the product: sign-in, generation, agent runs. */
  | 'product'
  /** Account and billing life after the purchase: top-ups, refunds, email changes. */
  | 'account'
  /** Offers, leads and codes from the offer machine. */
  | 'offer'
  /** A failure worth counting, on the server or in the app. */
  | 'ops';

export interface AnalyticsEvent {
  readonly name: string;
  readonly senders: readonly AnalyticsSender[];
  readonly kind: AnalyticsKind;
  readonly what: string;
  /** Sent by the PostHog library itself, so no call in the sender's code names it. */
  readonly library?: true;
}

/** Properties every purchase event carries; a send without one is a bug. */
export const PURCHASE_REQUIRED = ['value', 'currency', 'payment_intent_id', 'event_id'] as const;

/**
 * Properties a purchase event carries whenever the payment knows them: the
 * last-touch tags (`utm_*`), the first-touch tags (`ft_utm_*`), the landing
 * arm, the offer, the base payment on an upsell, the click ids and the buyer's
 * own IP and browser (Meta matches on them; the server's would be wrong).
 */
export const PURCHASE_CARRIED = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'ft_utm_source', 'ft_utm_medium', 'ft_utm_campaign', 'ft_utm_content', 'ft_utm_term',
  'lp_theme', 'lp_variant', 'offer_key', 'initial_pi',
  '_fbc', '_fbp', '_ttp', 'gclid', 'endorsely_referral',
  '$ip', '$raw_user_agent',
] as const;

const API: readonly AnalyticsSender[] = ['slates-api'];
const WEB: readonly AnalyticsSender[] = ['slates-web'];
const APP: readonly AnalyticsSender[] = ['slate'];

export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  // ── Purchases (slates-api, from the Stripe webhook after the grant) ──
  { name: 'license_purchased', senders: API, kind: 'purchase', what: 'The base license, with the bump inside its value' },
  { name: 'bump_skills_purchased', senders: API, kind: 'purchase', what: 'The Skills Pack bump, its own cents only' },
  { name: 'pro_license_purchased', senders: API, kind: 'purchase', what: 'Pro bought outright (the $297 checkout)' },
  { name: 'pro_upgraded', senders: API, kind: 'purchase', what: 'Base to Pro: the /letsgo/pro upsell or the /upgrade page' },
  { name: 'mega_credits_purchased', senders: API, kind: 'purchase', what: 'The mega credit pack upsell' },
  { name: 'credit_boost_purchased', senders: API, kind: 'purchase', what: 'The credit boost upsell' },
  { name: 'credits_purchased', senders: API, kind: 'purchase', what: 'A credit pack bought on its own' },
  { name: 'vault_purchased', senders: API, kind: 'purchase', what: 'The legacy vault SKU (unrouted since 2026-07-09)' },
  { name: 'thumbs_purchased', senders: API, kind: 'purchase', what: 'A Thumbs purchase' },
  { name: 'thumbs_oto2_purchased', senders: API, kind: 'purchase', what: 'Thumbs as the /letsgo OTO2 (unrouted since 2026-07-09)' },

  // ── Funnel ──
  { name: '$pageview', senders: WEB, kind: 'funnel', what: 'A page view, sent by hand on each route change' },
  { name: '$pageleave', senders: APP, kind: 'funnel', what: "posthog-js's own leave event in the app (capture_pageleave)", library: true },
  { name: 'view_content', senders: WEB, kind: 'funnel', what: 'A sales page seen; browser pixel and PostHog with one id' },
  { name: 'initiate_checkout', senders: WEB, kind: 'funnel', what: 'The checkout opened; browser pixel and PostHog with one id' },
  { name: 'checkout_started', senders: API, kind: 'funnel', what: "The API first learns the buyer's email for a PaymentIntent" },
  { name: 'thumbs_checkout_started', senders: API, kind: 'funnel', what: 'A Thumbs checkout created' },
  { name: 'checkout_payment_intent_failed', senders: WEB, kind: 'funnel', what: 'The checkout could not create its PaymentIntent' },
  { name: 'headline_variant_shown', senders: WEB, kind: 'funnel', what: 'The /letsgo headline arm shown' },
  { name: 'theme_variant_shown', senders: WEB, kind: 'funnel', what: 'The /letsgo theme arm shown' },
  { name: 'funnel_step', senders: WEB, kind: 'funnel', what: 'An upsell or success page reached' },
  { name: 'oto_decision', senders: WEB, kind: 'funnel', what: 'An upsell accepted or declined' },
  { name: 'bump_skills_toggled', senders: WEB, kind: 'funnel', what: 'The Skills Pack bump ticked or unticked' },
  { name: 'aov_running_total', senders: WEB, kind: 'funnel', what: "The buyer's running order value on each upsell page" },
  { name: 'tier_at_purchase', senders: WEB, kind: 'funnel', what: 'The tier the success page shows' },
  { name: 'currency_displayed', senders: WEB, kind: 'funnel', what: 'The currency /letsgo priced in' },
  { name: 'checkout_theme_toggled', senders: WEB, kind: 'funnel', what: 'The checkout switched light or dark' },
  { name: 'checkout_exit_intent_shown', senders: WEB, kind: 'funnel', what: 'The checkout exit prompt shown' },
  { name: 'checkout_exit_intent_kept', senders: WEB, kind: 'funnel', what: 'The buyer stayed at the exit prompt' },
  { name: 'checkout_exit_intent_dismissed', senders: WEB, kind: 'funnel', what: 'The buyer left at the exit prompt' },
  { name: 'decoy_coupon_removed', senders: WEB, kind: 'funnel', what: 'The decoy coupon removed' },
  { name: 'decoy_coupon_reapplied', senders: WEB, kind: 'funnel', what: 'The decoy coupon put back' },
  { name: 'pro_upgrade_accepted', senders: WEB, kind: 'funnel', what: 'The success-page Pro offer accepted' },
  { name: 'pro_upgrade_declined', senders: WEB, kind: 'funnel', what: 'The success-page Pro offer declined' },
  { name: 'upgrade_page_viewed', senders: WEB, kind: 'funnel', what: 'The /upgrade page seen' },
  { name: 'skills_pack_download_clicked', senders: WEB, kind: 'funnel', what: 'The Skills Pack download pressed on the success page' },
  { name: 'video_play', senders: WEB, kind: 'funnel', what: 'A sales-page video started' },
  { name: 'video_unmute', senders: WEB, kind: 'funnel', what: 'A sales-page video unmuted' },
  { name: 'video_watch_25', senders: WEB, kind: 'funnel', what: 'A quarter of a sales-page video watched (forwarded to Meta)' },
  { name: 'video_watch_50', senders: WEB, kind: 'funnel', what: 'Half a sales-page video watched' },
  { name: 'video_watch_75', senders: WEB, kind: 'funnel', what: 'Three quarters of a sales-page video watched' },
  { name: 'video_watch_100', senders: WEB, kind: 'funnel', what: 'A sales-page video watched to the end' },
  { name: 'web_login_link_sent', senders: WEB, kind: 'account', what: 'A web sign-in link sent' },
  { name: 'web_login_google_started', senders: WEB, kind: 'account', what: 'A web Google sign-in started' },
  { name: 'web_login_completed', senders: WEB, kind: 'account', what: 'A web sign-in finished' },
  { name: 'charge_upsell_initial_pi_rejected', senders: API, kind: 'ops', what: 'An upsell refused: its base payment did not qualify' },
  { name: 'charge_upsell_no_initial_pi', senders: API, kind: 'ops', what: 'An upsell refused: no base payment named' },

  // ── Offers and leads ──
  { name: 'lead_captured', senders: [...API, ...WEB], kind: 'offer', what: 'An email typed at checkout and kept before payment' },
  { name: 'offer_code_issued', senders: API, kind: 'offer', what: 'A personal offer code minted' },
  { name: 'offer_code_redeemed', senders: API, kind: 'offer', what: 'A personal offer code spent by a payment' },
  { name: 'deal_viewed', senders: WEB, kind: 'offer', what: 'A page showing a live deal seen' },
  { name: 'deal_expired', senders: WEB, kind: 'offer', what: "A deal's clock ran out on screen" },
  { name: 'personal_deal_viewed', senders: WEB, kind: 'offer', what: 'A personal code page seen' },
  { name: 'letsgo_unlock_shown', senders: WEB, kind: 'offer', what: 'The /letsgo unlock offer shown' },
  { name: 'letsgo_unlock_applied', senders: WEB, kind: 'offer', what: 'The /letsgo unlock offer taken' },
  { name: 'letsgo_unlock_dismissed', senders: WEB, kind: 'offer', what: 'The /letsgo unlock offer closed' },
  { name: 'checkout_unlock_shown', senders: WEB, kind: 'offer', what: 'The checkout unlock offer shown' },
  { name: 'checkout_unlock_applied', senders: WEB, kind: 'offer', what: 'The checkout unlock offer taken' },
  { name: 'checkout_unlock_dismissed', senders: WEB, kind: 'offer', what: 'The checkout unlock offer closed' },
  { name: 'exit_capture_shown', senders: WEB, kind: 'offer', what: 'The exit email popup shown' },
  { name: 'exit_capture_submitted', senders: WEB, kind: 'offer', what: 'The exit email popup filled in' },
  { name: 'exit_capture_dismissed', senders: WEB, kind: 'offer', what: 'The exit email popup closed' },
  { name: 'offer_shown', senders: APP, kind: 'offer', what: 'An in-app offer shown' },
  { name: 'offer_dismissed', senders: APP, kind: 'offer', what: 'An in-app offer dismissed' },
  { name: 'offer_clicked', senders: APP, kind: 'offer', what: 'An in-app offer clicked' },

  // ── Product ──
  { name: 'user_logged_in', senders: APP, kind: 'product', what: 'A desktop sign-in, from the app' },
  { name: 'user_logged_out', senders: APP, kind: 'product', what: 'A desktop sign-out, from the app' },
  { name: 'generation_started', senders: APP, kind: 'product', what: 'Generate pressed in the app' },
  { name: 'desktop_signed_in', senders: API, kind: 'product', what: 'A desktop sign-in, from the server (first=true on the first)' },
  { name: 'generation_charged', senders: API, kind: 'product', what: "A generation's credits debited, from the server" },
  { name: 'agent_brain_turn', senders: API, kind: 'product', what: 'One Studio Agent turn on the server brain' },
  // The app's agent loop sends these through POST /agent/event; the API relays them.
  { name: 'agent_run_started', senders: [...APP, ...API], kind: 'product', what: 'A Studio Agent run started' },
  { name: 'agent_run_completed', senders: [...APP, ...API], kind: 'product', what: 'A Studio Agent run finished' },
  { name: 'agent_run_cancelled', senders: [...APP, ...API], kind: 'product', what: 'A Studio Agent run stopped by the user' },
  { name: 'agent_run_failed', senders: [...APP, ...API], kind: 'product', what: 'A Studio Agent run failed' },
  { name: 'agent_plan_approved', senders: [...APP, ...API], kind: 'product', what: "The agent's plan approved" },
  { name: 'agent_plan_rejected', senders: [...APP, ...API], kind: 'product', what: "The agent's plan rejected or edited" },

  // ── Account ──
  { name: 'auto_topup_enabled', senders: API, kind: 'account', what: 'Auto top-up switched on' },
  { name: 'auto_topup_disabled', senders: API, kind: 'account', what: 'Auto top-up switched off' },
  { name: 'auto_topup_charged', senders: API, kind: 'account', what: 'An auto top-up charged' },
  { name: 'auto_topup_failed', senders: API, kind: 'account', what: 'An auto top-up failed' },
  { name: 'one_click_topup_charged', senders: API, kind: 'account', what: 'A one-click top-up charged' },
  { name: 'one_click_topup_failed', senders: API, kind: 'account', what: 'A one-click top-up failed' },
  { name: 'account_email_changed', senders: API, kind: 'account', what: "An account's email changed (the person splits; see the plan)" },
  { name: 'account_email_reverted', senders: API, kind: 'account', what: 'An email change undone' },
  { name: 'refund_processed', senders: API, kind: 'account', what: 'A refund taken back what its payment granted' },
  { name: 'dispute_opened', senders: API, kind: 'account', what: 'A chargeback opened' },

  // ── Failures (second-brain plans/2026-10-25-slates-bug-capture.md): crashes as `$exception`, and the failures that throw nothing ──
  { name: '$exception', senders: [...APP, ...API], kind: 'ops', what: 'An error: posthog-js exception capture in the app, captureException in main and slates-api', library: true },
  { name: 'generation_failed', senders: APP, kind: 'ops', what: 'A generation turned failed: its model, error class and provider status, never the prompt' },
  { name: 'export_failed', senders: APP, kind: 'ops', what: 'An MP4 or XML export failed, by error class' },
  { name: 'agent_op_failed', senders: APP, kind: 'ops', what: "An outside agent's /agent request answered 500, or a Studio Agent tool call threw" },
  { name: 'action_retried', senders: APP, kind: 'ops', what: 'One action (same target, same input) failed three times inside ten minutes' },
  { name: 'session_ended_after_error', senders: APP, kind: 'ops', what: 'The app quit within a minute of one of the failures above' },
];

const BY_NAME = new Map(ANALYTICS_EVENTS.map((e) => [e.name, e]));
if (BY_NAME.size !== ANALYTICS_EVENTS.length) {
  throw new Error('analytics taxonomy: a name is listed twice');
}

export function analyticsEvent(name: string): AnalyticsEvent | undefined {
  return BY_NAME.get(name);
}

/**
 * The one PostHog id for a person on every surface: the email, trimmed and
 * lowercased. A buyer who types a capital letter would otherwise be two people,
 * and PostHog will not merge two people who are both already identified.
 */
export function analyticsPersonId(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A purchase event's id: the event and its PaymentIntent. A replayed webhook
 * sends the same id, and Meta dedupes on it within 48 hours.
 */
export function purchaseEventId(event: string, paymentIntentId: string): string {
  return `${event}:${paymentIntentId}`;
}

/** The required purchase properties a payload lacks (empty string and null count as missing). */
export function missingPurchaseProperties(properties: Record<string, unknown>): string[] {
  return PURCHASE_REQUIRED.filter((key) => properties[key] === undefined || properties[key] === null || properties[key] === '');
}

// ═══════════════════════════════════════════════════════════════════════════
// The call-site scanner every repo's check:analytics runs
// ═══════════════════════════════════════════════════════════════════════════

/** A call form that sends an event: `callee(…)` with the name at argument `arg`. */
export interface EventCaller {
  readonly callee: string;
  readonly arg: number;
}

export interface EventCall {
  readonly callee: string;
  readonly line: number;
  /** The names the argument can take; empty when only the code can compute it. */
  readonly names: readonly string[];
  /** The argument's source text, whitespace collapsed. */
  readonly source: string;
}

const CALL = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)(\?\.)?\s*(?:<[^<>()]*>\s*)?\(/g;

interface RawCall {
  readonly callee: string;
  readonly line: number;
  /** Index just past the call's opening parenthesis. */
  readonly index: number;
}

/** Every call in `text`, its callee written as the source writes it (`?.capture` when it hangs off an expression). */
function allCalls(text: string): RawCall[] {
  const out: RawCall[] = [];
  for (const m of text.matchAll(CALL)) {
    const at = m.index!;
    if (/(function|async)\s+$/.test(text.slice(Math.max(0, at - 16), at))) continue;
    const hangs = text[at - 1] === '.' ? (text[at - 2] === '?' ? '?.' : '.') : '';
    out.push({ callee: hangs + m[1] + (m[2] ?? ''), line: text.slice(0, at).split('\n').length, index: at + m[0].length });
  }
  return out;
}

/**
 * Calls that look like an analytics send: a `.capture(` or `.track(` method,
 * or a function named `trackEvent`, `trackDualEvent` or `track…Event`. The
 * check fails on any of these that is not a known send form, so a new wrapper
 * cannot slip names past it.
 */
export function findSendLikeCalls(text: string): RawCall[] {
  return allCalls(text).filter(({ callee }) => {
    const method = /\.(capture|track)(\?\.)?$/.test(callee);
    const fn = /^track(Dual)?\w*Event$/.test(callee);
    return method || fn;
  });
}

/**
 * The calls in `text` made through `callers`, each with the event names its
 * name argument can take. A name argument that is a literal, or a ternary whose
 * branches are literals, resolves; anything else resolves to no names.
 */
export function findEventCalls(text: string, callers: readonly EventCaller[]): EventCall[] {
  const byCallee = new Map(callers.map((c) => [c.callee, c.arg]));
  const out: EventCall[] = [];
  for (const call of allCalls(text)) {
    const arg = byCallee.get(call.callee);
    if (arg === undefined) continue;
    const args = splitArguments(text, call.index);
    const source = (args[arg] ?? '').replace(/\s+/g, ' ').trim();
    out.push({ callee: call.callee, line: call.line, names: literalNames(source), source });
  }
  return out;
}

/** Top-level comma-separated arguments of the call whose `(` ends just before `start`. */
function splitArguments(text: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(text, i);
      current += text.slice(i, end);
      i = end - 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = (end === -1 ? text.length : end) - 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = (end === -1 ? text.length : end + 2) - 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        args.push(current);
        return args;
      }
      depth--;
    }
    if (ch === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  args.push(current);
  return args;
}

function skipString(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (quote === '`' && text[i] === '$' && text[i + 1] === '{') return text.length; // never treated as a literal
    if (text[i] === quote) return i + 1;
  }
  return text.length;
}

/** The names a literal or a ternary of literals can produce; [] when anything else. */
function literalNames(source: string): string[] {
  const s = stripParens(source.trim());
  const literal = /^(['"])([^'"\\]*)\1$/.exec(s) ?? /^(`)([^`\\$]*)`$/.exec(s);
  if (literal) return [literal[2]];
  const q = topLevelIndex(s, '?');
  if (q === -1) return [];
  const rest = s.slice(q + 1);
  const c = topLevelIndex(rest, ':');
  if (c === -1) return [];
  const a = literalNames(rest.slice(0, c));
  const b = literalNames(rest.slice(c + 1));
  return a.length && b.length ? [...a, ...b] : [];
}

function stripParens(s: string): string {
  while (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim();
  return s;
}

/** Index of `ch` outside strings and brackets, skipping `?.` and `??`. */
function topLevelIndex(s: string, ch: '?' | ':'): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(s, i) - 1;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && c === ch) {
      if (ch === '?' && (s[i + 1] === '.' || s[i + 1] === '?' || s[i - 1] === '?')) continue;
      return i;
    }
  }
  return -1;
}

/** Ways to reach `capture`/`track` that hide the call from the scan: each is refused. */
const INDIRECT_SENDS: readonly [RegExp, string][] = [
  [/\[\s*['"`](capture|track)['"`]\s*\]/g, 'bracket access to'],
  [/\.(capture|track)\s*\.\s*(bind|call|apply)\b/g, 'a bound or applied'],
  [/\{[^{}]*\b(capture|track)\b[^{}]*\}\s*=\s*(usePostHog\s*\(|posthog\b)/g, 'a destructured'],
];

export interface AnalyticsFinding {
  readonly file: string;
  readonly line: number;
  readonly problem: string;
}

/**
 * A send form allowed to pass a computed name. Either its names are checked
 * where the wrapper is called (no `namesFrom`), or the file declares them in
 * one const (`namesFrom`), whose string literals are checked instead.
 */
export interface DynamicSend {
  readonly file: string;
  readonly callee: string;
  readonly namesFrom?: string;
}

export interface CheckOptions {
  readonly callers: readonly EventCaller[];
  readonly dynamic?: readonly DynamicSend[];
  /** Send-like calls that are not PostHog (a pixel, say): `file` + `callee`. */
  readonly ignore?: readonly { file: string; callee: string }[];
  /** The only callee a purchase event may go through, which builds its required properties. */
  readonly purchaseVia?: string;
}

/** The string literals inside `const <name> = …`, up to the end of its bracketed value. */
export function constLiterals(text: string, name: string): string[] {
  const at = new RegExp(`const\\s+${name}\\b[^=]*=`).exec(text);
  if (!at) return [];
  const open = text.slice(at.index + at[0].length).search(/[[{(]/);
  if (open === -1) return [];
  const start = at.index + at[0].length + open + 1;
  const body = splitArguments(text, start).join(',');
  return [...body.matchAll(/(['"])([^'"\\]+)\1/g)].map((m) => m[2]);
}

/** Every event name the files send through `opts`, literal or declared for a computed send. */
export function sentNames(files: readonly { path: string; text: string }[], opts: CheckOptions): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    for (const call of findEventCalls(f.text, opts.callers)) for (const n of call.names) names.add(n);
    for (const d of opts.dynamic ?? []) {
      if (d.namesFrom && f.path.replace(/\\/g, '/').endsWith(d.file)) for (const n of constLiterals(f.text, d.namesFrom)) names.add(n);
    }
  }
  return names;
}

/** Check one source file of `sender` against the taxonomy. */
export function checkSource(file: string, text: string, sender: AnalyticsSender, opts: CheckOptions): AnalyticsFinding[] {
  const findings: AnalyticsFinding[] = [];
  const flag = (line: number, problem: string) => findings.push({ file, line, problem });
  const matches = (d: { file: string; callee: string }, callee: string) =>
    d.callee === callee && file.replace(/\\/g, '/').endsWith(d.file);

  const known = new Set(opts.callers.map((c) => c.callee));
  for (const call of findSendLikeCalls(text)) {
    if (known.has(call.callee) || opts.ignore?.some((d) => matches(d, call.callee))) continue;
    flag(call.line, `unknown send form \`${call.callee}(\`: add it to this repo's callers in check:analytics, or send through a known one`);
  }
  for (const [pattern, what] of INDIRECT_SENDS) {
    for (const m of text.matchAll(pattern)) {
      flag(text.slice(0, m.index!).split('\n').length, `${what} \`${m[1]}\` hides the event name from this check: call it directly`);
    }
  }

  const checkName = (line: number, name: string, callee: string) => {
    const event = analyticsEvent(name);
    if (!event) flag(line, `\`${name}\` is not in the analytics taxonomy (slates-mcp packages/shared/src/analytics/events.ts)`);
    else if (!event.senders.includes(sender)) flag(line, `\`${name}\` is not listed as sent by ${sender}`);
    else if (event.kind === 'purchase' && opts.purchaseVia && callee !== opts.purchaseVia) {
      flag(line, `purchase event \`${name}\` must go through ${opts.purchaseVia}, which adds ${PURCHASE_REQUIRED.join(', ')}`);
    }
  };

  for (const call of findEventCalls(text, opts.callers)) {
    if (call.names.length > 0) {
      for (const name of call.names) checkName(call.line, name, call.callee);
      continue;
    }
    const allowed = opts.dynamic?.find((d) => matches(d, call.callee));
    if (!allowed) {
      flag(call.line, `event name \`${call.source}\` is computed; use a literal from the taxonomy`);
    } else if (allowed.namesFrom) {
      const names = constLiterals(text, allowed.namesFrom);
      if (names.length === 0) flag(call.line, `\`${allowed.namesFrom}\` declares no event names in this file`);
      for (const name of names) checkName(call.line, name, call.callee);
    }
  }
  return findings;
}

/**
 * Mutation cases a repo's check runs on itself. Each must produce a finding, or
 * the check has gone blind; returns the cases that produced none.
 */
export function selfTest(sender: AnalyticsSender, opts: CheckOptions): string[] {
  const caller = opts.callers.find((c) => c.callee !== opts.purchaseVia && !opts.dynamic?.some((d) => d.callee === c.callee)) ?? opts.callers[0];
  const call = (name: string) => `${caller.callee}(${[...Array(caller.arg).fill('who'), name].join(', ')}, {});`;
  const cases: [string, string][] = [
    ['a hand-typed name outside the taxonomy', call("'purchase_completed'")],
    ['a computed name', call('eventName')],
    ['an unknown send form', "analytics.capture('license_purchased');"],
    ['an unknown send form with type arguments', "analytics.capture <Props>('license_purchased');"],
    ['bracket access', "posthog['capture']('license_purchased');"],
    ['a destructured capture', 'const { capture } = usePostHog();'],
  ];
  if (opts.purchaseVia) cases.push([`a purchase event sent around ${opts.purchaseVia}`, call("'license_purchased'")]);
  return cases.filter(([, text]) => checkSource('self-test.ts', text, sender, opts).length === 0).map(([what]) => what);
}

/**
 * The whole check for one repo: its files scanned, the self-test, and its copy
 * of this module compared with the source when the slates-mcp checkout is
 * beside it (`copy` and `source` are the two texts; leave `source` undefined
 * when there is no sibling). Returns the lines to print and whether it passed.
 */
export function analyticsReport(
  files: readonly { path: string; text: string }[],
  sender: AnalyticsSender,
  opts: CheckOptions,
  taxonomy: { copy: string; source?: string },
): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  const findings = files.flatMap((f) => checkSource(f.path, f.text, sender, opts));
  const sent = sentNames(files, opts);
  for (const e of ANALYTICS_EVENTS) {
    if (e.senders.includes(sender) && !e.library && !sent.has(e.name)) {
      findings.push({ file: 'taxonomy', line: 0, problem: `\`${e.name}\` is listed as sent by ${sender}, but no code here sends it: remove ${sender} from its senders, or send it` });
    }
  }
  for (const f of findings) lines.push(`  ${f.file}:${f.line}  ${f.problem}`);
  const blind = selfTest(sender, opts);
  for (const what of blind) lines.push(`  self-test: ${what} passed the check; the scanner has gone blind`);
  const body = taxonomy.copy.replace(/\r\n/g, '\n').split('\n').filter((l) => !l.startsWith('// GENERATED by') && !l.startsWith('// Never hand-edit')).join('\n');
  const drift = taxonomy.source !== undefined && body !== taxonomy.source.replace(/\r\n/g, '\n');
  if (drift) lines.push('  the taxonomy copy differs from slates-mcp packages/shared/src/analytics/events.ts: run `npm run build:llm-docs` in slates-web');
  const ok = findings.length === 0 && blind.length === 0 && !drift;
  const sends = files.reduce((n, f) => n + findEventCalls(f.text, opts.callers).length, 0);
  lines.unshift(ok
    ? `✓ analytics: ${sends} sends in ${files.length} files match the taxonomy (${ANALYTICS_EVENTS.length} events)${taxonomy.source === undefined ? '; no slates-mcp checkout beside this repo, so the copy was not compared' : ''}`
    : `✖ analytics: ${findings.length + blind.length + (drift ? 1 : 0)} problem(s)`);
  return { ok, lines };
}
