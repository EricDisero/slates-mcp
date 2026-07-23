import { ALL_OPERATIONS, defaultContext, type Operation } from '@slatesvideo/shared'

interface RunOpOptions {
  opId: string
  rawArgs: string[]
  json: boolean
}

// Run-command flags that are CLI-side controls, not operation inputs.
// They get filtered out of rawArgs so they don't fail strict schemas
// like z.object({}).strict() on operations that take no input.
const RUN_COMMAND_FLAGS = new Set(['--json', '--list'])

// Parse `--key value` pairs into an object. Repeated `--key` becomes an
// array. Booleans accept `--flag` (true) and `--flag=false`. Numbers
// auto-coerce when the Zod schema expects one — done at parse time
// against the operation input shape.
function parseArgs(rawArgs: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (!arg.startsWith('--')) continue
    if (RUN_COMMAND_FLAGS.has(arg) || RUN_COMMAND_FLAGS.has(arg.split('=')[0])) {
      // Skip the value too if it doesn't start with --
      const next = rawArgs[i + 1]
      if (next != null && !next.startsWith('--')) i++
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

export async function runOp(opts: RunOpOptions): Promise<void> {
  const ops = ALL_OPERATIONS as readonly Operation<unknown>[]
  const op = ops.find((o) => o.id === opts.opId)
  if (!op) {
    console.error(`Unknown operation: ${opts.opId}`)
    console.error('Run `slates run --list` to see all operations.')
    process.exit(1)
  }

  const raw = parseArgs(opts.rawArgs)
  const coerced = coerceForSchema(op.input, raw)

  let parsed: unknown
  try {
    parsed = op.input.parse(coerced)
  } catch (err) {
    console.error('Invalid arguments for', op.id)
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  const result = await op.run(parsed as never, defaultContext())

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
    return
  }

  console.log(result.text)
  if (result.images && result.images.length > 0) {
    console.log(`\nReturned ${result.images.length} inline image(s).`)
    console.log('(--json reports image metadata only, not the bytes — use the MCP server for vision-aware tools)')
  }
}

function coerceForSchema(schema: unknown, raw: Record<string, unknown>): Record<string, unknown> {
  // Best-effort coercion for the strings produced by parseArgs.
  // Zod's parse will reject unknown inputs anyway; this just improves
  // the experience for the common cases (numbers, booleans).
  // We don't need to mirror every Zod type — pass-through is fine
  // because parse() will fail loudly on real type mismatches.
  type ZodLike = {
    _def?: {
      typeName?: string
      shape?: () => Record<string, ZodLike>
      innerType?: ZodLike
      schema?: ZodLike
      type?: ZodLike // ZodArray element type
    }
    shape?: Record<string, ZodLike>
  }
  const zodObj = schema as ZodLike
  if (zodObj?._def?.typeName !== 'ZodObject') return raw

  const shape: Record<string, ZodLike> =
    typeof zodObj._def.shape === 'function'
      ? zodObj._def.shape()
      : zodObj.shape ?? {}

  // Unwrap ZodOptional / ZodDefault / ZodNullable / ZodEffects / ZodReadonly
  // to find the leaf type. `z.number().optional()` reports typeName
  // 'ZodOptional' with `_def.innerType` pointing at the ZodNumber.
  const wrappers = new Set([
    'ZodOptional',
    'ZodDefault',
    'ZodNullable',
    'ZodReadonly',
    'ZodEffects',
    'ZodCatch',
    'ZodBranded',
  ])
  const unwrap = (t: ZodLike | undefined): ZodLike | undefined => {
    let cur = t
    let depth = 0
    while (cur?._def?.typeName && wrappers.has(cur._def.typeName) && depth < 8) {
      cur = cur._def.innerType ?? cur._def.schema
      depth++
    }
    return cur
  }

  // Does the declared type allow null anywhere in its wrapper chain?
  // (e.g. z.string().uuid().nullable() — so `--folderId null` → null.)
  const isNullable = (t: ZodLike | undefined): boolean => {
    let cur = t
    let depth = 0
    while (cur?._def?.typeName && depth < 8) {
      if (cur._def.typeName === 'ZodNullable') return true
      if (wrappers.has(cur._def.typeName)) {
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
    if (fieldType === 'ZodArray') {
      const elemType = (leaf?._def?.type?._def?.typeName ?? '') as string
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
