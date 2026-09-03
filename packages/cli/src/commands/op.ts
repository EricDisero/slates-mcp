import { z } from 'zod'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import {
  ALL_OPERATIONS,
  defaultContext,
  readDefaultProjectId,
  type Operation,
} from '@slatesvideo/shared'
import { EXIT, exitFor } from '../exit-codes.js'

interface RunOpOptions {
  opId: string
  rawArgs: string[]
  json: boolean
  saveImages?: string
}

// Run-command flags that are CLI-side controls, not operation inputs.
// They get filtered out of rawArgs so they don't fail strict schemas
// like z.object({}).strict() on operations that take no input.
//
// The value-taking ones are listed separately: `--save-images ./out` must eat
// its value, or `./out` is parsed as a bare positional and silently ignored.
const RUN_COMMAND_FLAGS = new Set(['--json', '--list', '--full', '--help', '-h'])
const RUN_COMMAND_VALUE_FLAGS = new Set(['--save-images', '--input', '--input-file'])

/**
 * Parse `--key value` pairs into an object. Repeated `--key` becomes an
 * array. Booleans accept `--flag` (true) and `--flag=false`. Numbers
 * auto-coerce when the Zod schema expects one — done at parse time
 * against the operation input shape.
 *
 * 🚨 FLAGS CANNOT EXPRESS A NESTED OBJECT, AND THAT IS WHY `--input` EXISTS.
 * Every op with an object-shaped param was UNCALLABLE from the CLI: all eight
 * Shot ops (`params`, `refs`, the script fields), `slates_batch_update_frames`,
 * `slates_update_timeline_settings`. The README tells a Claude Code user to
 * shell out to the CLI instead of loading the tool schemas — and then they
 * could not create a Shot. `--input '<json>'` and `--input-file <path>` carry
 * the whole object; explicit flags still win, so `--input ... --prompt x`
 * overrides the JSON's prompt.
 */
function parseArgs(rawArgs: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (!arg.startsWith('--')) continue
    const bare = arg.split('=')[0]
    if (RUN_COMMAND_FLAGS.has(bare) || RUN_COMMAND_VALUE_FLAGS.has(bare)) {
      // Skip the value too if it doesn't start with --
      if (!arg.includes('=')) {
        const next = rawArgs[i + 1]
        if (next != null && !next.startsWith('--')) i++
      }
      continue
    }
    const eqIdx = arg.indexOf('=')
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx)
      const value = arg.slice(eqIdx + 1)
      assign(out, key, value)
    } else {
      const key = arg.slice(2)
      const next = rawArgs[i + 1]
      if (next == null || next.startsWith('--')) {
        assign(out, key, true)
      } else {
        assign(out, key, next)
        i++
      }
    }
  }
  return out
}

/** The `--input` / `--input-file` payload, merged UNDER the explicit flags. */
function readInputObject(rawArgs: string[]): Record<string, unknown> {
  const valueOf = (flag: string): string | undefined => {
    for (let i = 0; i < rawArgs.length; i++) {
      const a = rawArgs[i]
      if (a === flag) return rawArgs[i + 1]
      if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1)
    }
    return undefined
  }
  const inline = valueOf('--input')
  const file = valueOf('--input-file')
  const sources: string[] = []
  if (file) {
    try {
      sources.push(readFileSync(file, 'utf8'))
    } catch (err) {
      console.error(`--input-file ${file}: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(EXIT.ERROR)
    }
  }
  if (inline) sources.push(inline)
  const merged: Record<string, unknown> = {}
  for (const src of sources) {
    let parsed: unknown
    try {
      parsed = JSON.parse(src)
    } catch (err) {
      console.error(`--input is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
      console.error('Tip: on PowerShell, single quotes do not escape inner double quotes — use --input-file.')
      process.exit(EXIT.ERROR)
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('--input must be a JSON OBJECT, e.g. \'{"projectId":"…","params":{"duration":8}}\'')
      process.exit(EXIT.ERROR)
    }
    Object.assign(merged, parsed as Record<string, unknown>)
  }
  return merged
}

function assign(obj: Record<string, unknown>, key: string, value: unknown): void {
  const existing = obj[key]
  if (existing == null) {
    obj[key] = value
    return
  }
  if (Array.isArray(existing)) {
    existing.push(value)
    return
  }
  obj[key] = [existing, value]
}

// ── Zod introspection, shared by --help and the missing-object hint ──────────

interface ZodLike {
  _def?: {
    typeName?: string
    description?: string
    shape?: () => Record<string, ZodLike>
    innerType?: ZodLike
    schema?: ZodLike
    type?: ZodLike
    values?: string[]
    checks?: unknown[]
  }
  shape?: Record<string, ZodLike>
}

const WRAPPERS = new Set([
  'ZodOptional',
  'ZodDefault',
  'ZodNullable',
  'ZodReadonly',
  'ZodEffects',
  'ZodCatch',
  'ZodBranded',
])

function unwrap(t: ZodLike | undefined): ZodLike | undefined {
  let cur = t
  let depth = 0
  while (cur?._def?.typeName && WRAPPERS.has(cur._def.typeName) && depth < 8) {
    cur = cur._def.innerType ?? cur._def.schema
    depth++
  }
  return cur
}

function isOptional(t: ZodLike | undefined): boolean {
  let cur = t
  let depth = 0
  while (cur?._def?.typeName && depth < 8) {
    if (cur._def.typeName === 'ZodOptional' || cur._def.typeName === 'ZodDefault') return true
    if (!WRAPPERS.has(cur._def.typeName)) return false
    cur = cur._def.innerType ?? cur._def.schema
    depth++
  }
  return false
}

function describeOf(t: ZodLike | undefined): string {
  let cur = t
  let depth = 0
  while (cur?._def && depth < 8) {
    if (cur._def.description) return cur._def.description
    cur = cur._def.innerType ?? cur._def.schema
    depth++
    if (!cur) break
  }
  return ''
}

function objectShape(schema: unknown): Record<string, ZodLike> {
  const z = schema as ZodLike
  if (z?._def?.typeName !== 'ZodObject') return {}
  return typeof z._def.shape === 'function' ? z._def.shape() : (z.shape ?? {})
}

/** A human type name plus, for an enum, its legal values. */
function typeLabel(t: ZodLike | undefined): string {
  const leaf = unwrap(t)
  const name = leaf?._def?.typeName ?? ''
  switch (name) {
    case 'ZodString':
      return 'string'
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodEnum':
      return `enum(${(leaf?._def?.values ?? []).join('|')})`
    case 'ZodNativeEnum':
      return 'enum'
    case 'ZodArray':
      return `${typeLabel(leaf?._def?.type)}[]`
    case 'ZodObject':
      return 'object'
    case 'ZodUnion':
      return 'union'
    default:
      return name.replace(/^Zod/, '').toLowerCase() || 'value'
  }
}

/**
 * Zod's default error is a JSON blob of issue objects. Flatten to one readable
 * line per problem, with the legal set printed whenever an enum was what
 * failed — the same treatment the MCP server gives it, because both surfaces
 * are read by an agent that pays a turn for every unclear error.
 */
function flattenZodError(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      if (issue.code === 'invalid_enum_value') {
        const legal = (issue as unknown as { options?: unknown[] }).options ?? []
        return `  ${path}: ${issue.message}. Legal values: ${legal.join(', ')}`
      }
      if (issue.code === 'unrecognized_keys') {
        const keys = (issue as unknown as { keys?: string[] }).keys ?? []
        return `  ${path}: unknown parameter(s) ${keys.join(', ')}`
      }
      return `  ${path}: ${issue.message}`
    })
    .join('\n')
}

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s/)[0].trim()
  return s.length > 200 ? `${s.slice(0, 197)}…` : s
}

/**
 * `slates run <op> --help`.
 *
 * The only way to learn an op's parameters used to be `slates run --list`,
 * which printed all 91 descriptions — 29 KB, including the generated capability
 * tables — and not one parameter NAME. An agent shelling out had to guess the
 * flags or go and read a skill.
 */
export function printOpHelp(op: Operation<unknown>): void {
  console.log(`${op.id}\n`)
  console.log(`${op.description}\n`)
  const shape = objectShape(op.input)
  const keys = Object.keys(shape)
  if (keys.length === 0) {
    console.log('Takes no parameters.')
    return
  }
  console.log('Parameters:')
  const objectFields: string[] = []
  for (const key of keys) {
    const node = shape[key]
    const leaf = unwrap(node)
    const required = !isOptional(node)
    const label = typeLabel(node)
    if (leaf?._def?.typeName === 'ZodObject') objectFields.push(key)
    const desc = describeOf(node)
    console.log(
      `  --${key}${' '.repeat(Math.max(1, 26 - key.length))}${label}${required ? '  (required)' : ''}`
    )
    if (desc) console.log(`      ${firstSentence(desc)}`)
  }
  if (objectFields.length > 0) {
    console.log(
      `\nNested object field(s): ${objectFields.join(', ')}. Flags cannot express these — ` +
        `pass them with --input '<json>' or --input-file <path>.`
    )
    console.log(
      `  e.g. slates run ${op.id} --input '{"${objectFields[0]}":{}}'`
    )
  }
  console.log('\nExit codes: 0 done · 1 error · 3 confirm required · 4 clarification required · 5 desktop unreachable · 6 not signed in')
}

export async function runOp(opts: RunOpOptions): Promise<void> {
  const ops = ALL_OPERATIONS as readonly Operation<unknown>[]
  const op = ops.find((o) => o.id === opts.opId)
  if (!op) {
    console.error(`Unknown operation: ${opts.opId}`)
    console.error('Run `slates run --list` to see all operations.')
    process.exit(EXIT.ERROR)
  }

  if (opts.rawArgs.some((a) => a === '--help' || a === '-h')) {
    printOpHelp(op)
    return
  }

  const raw = { ...readInputObject(opts.rawArgs), ...parseArgs(opts.rawArgs) }
  const coerced = coerceForSchema(op.input, raw)

  // `slates use <project>` writes a default. Filled ONLY when the op declares a
  // projectId and the caller left it out — never overriding an explicit value.
  const shape = objectShape(op.input)
  if (coerced.projectId === undefined && 'projectId' in shape) {
    const fallback = readDefaultProjectId()
    if (fallback) coerced.projectId = fallback
  }

  let parsed: unknown
  try {
    parsed = op.input.parse(coerced)
  } catch (err) {
    // 🚨 ONE LINE PER PROBLEM, not Zod's issue JSON. The raw error is an array
    // of objects the caller has to read past to find the field name — and this
    // is the surface a Claude Code session shells out to, so an unreadable
    // error costs a turn every time. Same flattening the MCP server does.
    console.error(`Invalid arguments for ${op.id}:`)
    console.error(err instanceof z.ZodError ? flattenZodError(err) : String(err))
    // An OBJECT field is the failure the flag parser structurally cannot fix,
    // so name the one thing that does fix it rather than leaving the caller to
    // guess why `--params.duration 8` did nothing.
    const objectFields = Object.keys(shape).filter(
      (k) => unwrap(shape[k])?._def?.typeName === 'ZodObject'
    )
    if (objectFields.length > 0) {
      console.error(
        `\nNote: ${objectFields.join(', ')} ${objectFields.length === 1 ? 'is an OBJECT' : 'are OBJECTS'} — ` +
          `flags cannot express nested values. Pass them with --input '<json>' or --input-file <path>. ` +
          `\`slates run ${op.id} --help\` lists every flag.`
      )
    }
    process.exit(EXIT.ERROR)
  }

  let result
  try {
    result = await op.run(parsed as never, defaultContext())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    // 5 / 6 rather than a blanket 1: a script that shells out needs to tell
    // "the app is closed" from "the call was wrong", and retrying the second is
    // how an agent burns a loop.
    process.exit(exitFor(err))
  }

  const data = result.data as Record<string, unknown> | undefined

  // The banned-token warning is in the RESULT, where a model reads it. A human
  // running the CLI would never see it in --json, and would scroll past it in
  // the prose — so it also goes to stderr, in yellow.
  const warning = typeof data?.prompt_warning === 'string' ? data.prompt_warning : ''
  if (warning) process.stderr.write(`[33m${warning}[0m\n`)

  if (opts.saveImages && result.images?.length) {
    saveImages(result.images, opts.saveImages)
  }

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          text: result.text,
          data: result.data,
          images: result.images?.map((i) => ({
            mimeType: i.mimeType,
            bytes: Buffer.from(i.data, 'base64').byteLength,
          })),
        },
        null,
        2
      )
    )
    process.stdout.write('\n')
  } else {
    console.log(result.text)
    if (result.images && result.images.length > 0 && !opts.saveImages) {
      console.log(`\nReturned ${result.images.length} inline image(s).`)
      console.log('(--save-images <dir> writes them to disk; --json reports metadata only)')
    }
  }

  // 🚨 A COMPLETED OP IS NOT NECESSARILY A DONE OP. `requires_confirm` and
  // `requires_clarification` both used to exit 0, so a script or an agent
  // reading the exit code could not tell "done" from "I asked you something" —
  // and the natural reaction to a 0 is to move on.
  if (data?.requires_confirm === true) process.exit(EXIT.CONFIRM_REQUIRED)
  if (data?.requires_clarification === true) process.exit(EXIT.CLARIFICATION_REQUIRED)
}

/** Write returned images to disk and print the paths. */
function saveImages(images: Array<{ data: string; mimeType: string }>, dir: string): void {
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  images.forEach((img, i) => {
    const ext = extname(`x.${img.mimeType.split('/')[1] ?? 'png'}`) || '.png'
    const path = join(dir, `slates-${stamp}-${i + 1}${ext}`)
    writeFileSync(path, Buffer.from(img.data, 'base64'))
    console.log(path)
  })
}

function coerceForSchema(schema: unknown, raw: Record<string, unknown>): Record<string, unknown> {
  // Best-effort coercion for the strings produced by parseArgs.
  // Zod's parse will reject unknown inputs anyway; this just improves
  // the experience for the common cases (numbers, booleans).
  // Values that arrived through --input are already typed, so they pass through.
  const shape = objectShape(schema)
  if (Object.keys(shape).length === 0) return raw

  // Does the declared type allow null anywhere in its wrapper chain?
  // (e.g. z.string().uuid().nullable() — so `--folderId null` → null.)
  const isNullable = (t: ZodLike | undefined): boolean => {
    let cur = t
    let depth = 0
    while (cur?._def?.typeName && depth < 8) {
      if (cur._def.typeName === 'ZodNullable') return true
      if (WRAPPERS.has(cur._def.typeName)) {
        cur = cur._def.innerType ?? cur._def.schema
        depth++
        continue
      }
      break
    }
    return false
  }

  const coerceScalar = (fieldType: string, value: string): unknown => {
    if (fieldType === 'ZodNumber') {
      const n = Number(value)
      return Number.isFinite(n) ? n : value
    }
    if (fieldType === 'ZodBoolean') return value === 'true' || value === '1'
    return value
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const declared = shape[key]
    const leaf = unwrap(declared)
    const fieldType = (leaf?._def?.typeName ?? '') as string

    // `--folderId null` (or a bare `--folderId` → true is NOT null) → JS null
    // for fields that actually allow null. Enables "move to project root",
    // "clear character identity", etc. from the CLI.
    if (value === 'null' && isNullable(declared)) {
      out[key] = null
      continue
    }

    // Array fields: a single `--ids X` produced a bare string; repeated
    // `--ids X --ids Y` produced an array. Accept either, plus comma-split
    // (`--ids a,b,c`). Coerce each element to the array's element type.
    if (fieldType === 'ZodArray' && typeof value !== 'object') {
      const elemType = (unwrap(leaf?._def?.type)?._def?.typeName ?? '') as string
      const arr = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
          : [value]
      out[key] = arr.map((v) => (typeof v === 'string' ? coerceScalar(elemType, v) : v))
      continue
    }

    if (typeof value === 'string') {
      out[key] = coerceScalar(fieldType, value)
      continue
    }
    out[key] = value
  }
  return out
}
