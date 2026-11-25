import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import {
  ALL_OPERATIONS,
  defaultContext,
  prepareOperation,
  readDefaultProjectId,
  toolDefinition,
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
 * array. A bare `--flag` is true; every other value stays the string the shell
 * sent, and the shared parse repairs a number or a `true`/`false` the op's
 * schema asks for.
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

// ── The op's fields, read off the schema every host renders ──────────────────
//
// `toolDefinition()` is the one renderer: the MCP list, the Director and this
// CLI all read the same JSON Schema. The CLI once walked the Zod object itself
// and saw nothing behind a `.refine()`, so seven ops looked parameterless: no
// help, no default project, no flag handling (2026-11-24).

interface FieldSchema {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  description?: string
  items?: FieldSchema
  anyOf?: FieldSchema[]
}

interface OpFields {
  properties: Record<string, FieldSchema>
  required: ReadonlySet<string>
}

function opFields(op: Operation<unknown>): OpFields {
  const schema = toolDefinition(op).inputSchema as { properties?: Record<string, FieldSchema>; required?: string[] }
  return { properties: schema.properties ?? {}, required: new Set(schema.required ?? []) }
}

/** Every JSON type a field accepts, through `anyOf` and a `type` list. */
function typesOf(field: FieldSchema | undefined): string[] {
  if (!field) return []
  const own = Array.isArray(field.type) ? field.type : field.type ? [field.type] : []
  const literal = field.const !== undefined ? [field.const === null ? 'null' : typeof field.const] : []
  return [...own, ...literal, ...(field.anyOf ?? []).flatMap(typesOf)]
}

/** A human type name plus, for an enum, its legal values. */
function typeLabel(field: FieldSchema): string {
  if (field.enum) return `enum(${field.enum.join('|')})`
  if (field.anyOf) {
    const values = field.anyOf.filter((branch) => branch.type !== 'null')
    if (values.length > 0 && values.every((branch) => branch.const !== undefined)) return `enum(${values.map((branch) => branch.const).join('|')})`
    if (values.length === 1) return typeLabel(values[0])
    return 'union'
  }
  const type = Array.isArray(field.type) ? field.type.find((t) => t !== 'null') : field.type
  if (type === 'array') return `${field.items ? typeLabel(field.items) : 'value'}[]`
  if (type === 'integer') return 'number'
  return type ?? 'value'
}

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s/)[0].trim()
  return s.length > 200 ? `${s.slice(0, 197)}…` : s
}

/** The fields flags cannot express: an object, or a list of them. */
function objectFieldsOf(properties: Record<string, FieldSchema>): string[] {
  return Object.keys(properties).filter((key) => typesOf(properties[key]).includes('object'))
}

/**
 * `slates run <op> --help`.
 *
 * The only way to learn an op's parameters used to be `slates run --list`,
 * which printed every description in full, the generated capability tables
 * included, and not one parameter NAME. An agent shelling out had to guess the
 * flags or go and read a skill.
 */
export function printOpHelp(op: Operation<unknown>): void {
  console.log(`${op.id}\n`)
  console.log(`${op.description}\n`)
  const { properties, required } = opFields(op)
  const keys = Object.keys(properties)
  if (keys.length === 0) {
    console.log('Takes no parameters.')
    return
  }
  console.log('Parameters:')
  for (const key of keys) {
    const field = properties[key]
    console.log(
      `  --${key}${' '.repeat(Math.max(1, 26 - key.length))}${typeLabel(field)}${required.has(key) ? '  (required)' : ''}`
    )
    if (field.description) console.log(`      ${firstSentence(field.description)}`)
  }
  const objectFields = objectFieldsOf(properties)
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

  const { properties } = opFields(op)
  const prepared = prepareOperation(op, buildOpInput(op, opts.rawArgs, readDefaultProjectId))
  if (!prepared.ok) {
    // One line per problem (the shared flattener), never Zod's issue JSON: an
    // agent shelling out pays a turn for every unreadable error.
    console.error(prepared.message)
    // An OBJECT field is the failure the flag parser structurally cannot fix,
    // so name the one thing that does fix it rather than leaving the caller to
    // guess why `--params.duration 8` did nothing.
    const objectFields = objectFieldsOf(properties)
    if (objectFields.length > 0) {
      console.error(
        `
Note: ${objectFields.join(', ')} ${objectFields.length === 1 ? 'is an OBJECT' : 'are OBJECTS'} — ` +
          `flags cannot express nested values. Pass them with --input '<json>' or --input-file <path>. ` +
          `\`slates run ${op.id} --help\` lists every flag.`
      )
    }
    process.exit(EXIT.ERROR)
  }

  let result
  try {
    result = await prepared.call.run(defaultContext())
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

/**
 * The op's input from the command line: `--input` under the flags, then the two
 * things only a shell needs. `--folderId null` is JSON null where the field
 * allows it, and one `--ids a,b` is a list where the field is a list and
 * nothing else. Then the default project, for an op that takes one.
 *
 * Numbers and booleans are not touched here: `prepareOperation` repairs them
 * for every host the same way, and refuses `--sound on` by name.
 */
export function buildOpInput(
  op: Operation<unknown>,
  rawArgs: string[],
  defaultProjectId: () => string | null
): Record<string, unknown> {
  const { properties } = opFields(op)
  const input: Record<string, unknown> = { ...readInputObject(rawArgs) }
  for (const [key, value] of Object.entries(parseArgs(rawArgs))) {
    const types = typesOf(properties[key])
    if (value === 'null' && types.includes('null')) input[key] = null
    else if (types.includes('array') && !types.includes('string') && !Array.isArray(value)) {
      input[key] = typeof value === 'string' ? value.split(',').map((part) => part.trim()).filter((part) => part.length > 0) : [value]
    } else input[key] = value
  }
  // `slates use <project>` writes a default. Filled ONLY when the op declares a
  // projectId and the caller left it out — never overriding an explicit value.
  if (input.projectId === undefined && Object.hasOwn(properties, 'projectId')) {
    const fallback = defaultProjectId()
    if (fallback) input.projectId = fallback
  }
  return input
}
