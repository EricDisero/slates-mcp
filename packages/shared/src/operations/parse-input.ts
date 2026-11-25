import type { z } from 'zod/v3'
import type { Operation, OperationContext, OperationResult } from './index.js'

/**
 * THE ONE PATH FROM A CALLER'S RAW ARGUMENTS TO `op.run`.
 *
 * Every host (the MCP server, the CLI, the desktop Director) goes through
 * `prepareOperation`, so the op's Zod schema (defaults, integer checks, enums,
 * refinements) applies the same way everywhere. Until 2026-11-24 each host wrote
 * its own path and the Director skipped the parse: a model that sent
 * `duration: "5"` reached `checkDuration` with a string, and a customer saw
 * "wan-3.0 accepts 2-30s — 5s is not legal" for a legal 5-second clip.
 * `slate/scripts/op-entry-check.mjs` and `slates-mcp/scripts/op-entry-check.mjs`
 * fail any direct `.run(` on an operation outside this file.
 */

export type ParsedInput<I> = { ok: true; input: I } | { ok: false; message: string }

/** One readable line per Zod issue, for an agent that pays a turn for every unclear error. */
export function flattenZodError(err: z.ZodError, indent = ''): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      if (issue.code === 'invalid_enum_value') {
        return `${indent}${path}: ${JSON.stringify(issue.received)} is not allowed. Legal values: ${issue.options.join(', ')}`
      }
      if (issue.code === 'unrecognized_keys') {
        return `${indent}${path}: unknown parameter(s) ${issue.keys.join(', ')}. Check the tool schema`
      }
      return `${indent}${path}: ${issue.message}`
    })
    .join('\n')
}

const NUMERIC = /^\s*-?\d+(\.\d+)?\s*$/

/** Every issue that names a wrong scalar type, with the type the schema wanted; a union's branches included. */
function* scalarIssues(err: z.ZodError): Generator<{ path: (string | number)[]; expected: string }> {
  for (const issue of err.issues) {
    if (issue.code === 'invalid_union') for (const branch of issue.unionErrors) yield* scalarIssues(branch)
    else if (issue.code === 'invalid_type') yield { path: issue.path, expected: issue.expected }
    // `fps: 24 | 30 | 60` reports each literal it is not, never "expected number".
    else if (issue.code === 'invalid_literal') yield { path: issue.path, expected: typeof issue.expected }
  }
}

/**
 * A model or a shell sends `"5"` or `"true"` where the schema wants a number or
 * a boolean. The intent is unambiguous, so it is repaired at the exact path Zod
 * named and nowhere else. Only `"true"` and `"false"` are booleans: `"on"` or
 * `"yes"` stays a string and fails the schema by name. Returns a repaired copy,
 * or null when nothing was repairable.
 *
 * This is the only scalar coercion any host has. The CLI once ran its own
 * first, which turned `--sound on` into `false` without a word (2026-11-24).
 */
function repairScalars(value: unknown, err: z.ZodError): unknown | null {
  if (typeof value !== 'object' || value === null) return null
  const copy = structuredClone(value) as Record<string | number, unknown>
  let changed = false
  for (const issue of scalarIssues(err)) {
    if (issue.path.length === 0) continue
    let parent: unknown = copy
    for (const p of issue.path.slice(0, -1)) {
      parent = typeof parent === 'object' && parent !== null ? (parent as Record<PropertyKey, unknown>)[p] : undefined
    }
    if (typeof parent !== 'object' || parent === null) continue
    const holder = parent as Record<PropertyKey, unknown>
    const key = issue.path[issue.path.length - 1]
    const current = holder[key]
    if (typeof current !== 'string') continue
    if (issue.expected === 'number' && NUMERIC.test(current)) {
      holder[key] = Number(current)
      changed = true
    } else if (issue.expected === 'boolean' && (current === 'true' || current === 'false')) {
      holder[key] = current === 'true'
      changed = true
    }
  }
  return changed ? copy : null
}

/** Parse raw arguments against the op's schema, repairing stringified scalars once. */
export function parseOperationInput<I>(op: Operation<I>, raw: unknown): ParsedInput<I> {
  const first = op.input.safeParse(raw ?? {})
  if (first.success) return { ok: true, input: first.data }
  const repaired = repairScalars(raw ?? {}, first.error)
  const second = repaired ? op.input.safeParse(repaired) : first
  if (second.success) return { ok: true, input: second.data }
  return { ok: false, message: `Invalid arguments for ${op.id}:\n${flattenZodError(second.error)}` }
}

/**
 * A parsed call, ready to run. A host may adjust `input` before `run` (a consent
 * gate setting `confirm`, a session filling `projectId`); `patch` overrides
 * fields for one run without touching `input`.
 */
export interface PreparedOperation<I> {
  op: Operation<I>
  input: I
  run(ctx: OperationContext, patch?: Partial<I>): Promise<OperationResult>
}

export function prepareOperation<I>(
  op: Operation<I>,
  raw: unknown
): { ok: true; call: PreparedOperation<I> } | { ok: false; message: string } {
  const parsed = parseOperationInput(op, raw)
  if (!parsed.ok) return parsed
  const call: PreparedOperation<I> = {
    op,
    input: parsed.input,
    run: (ctx, patch) => op.run(patch ? { ...call.input, ...patch } : call.input, ctx),
  }
  return { ok: true, call }
}

/** Parse, then run; a parse failure comes back as the op's own error text. */
export async function runOperation<I>(op: Operation<I>, raw: unknown, ctx: OperationContext): Promise<OperationResult & { invalid?: true }> {
  const prepared = prepareOperation(op, raw)
  if (!prepared.ok) return { text: prepared.message, invalid: true }
  return prepared.call.run(ctx)
}
