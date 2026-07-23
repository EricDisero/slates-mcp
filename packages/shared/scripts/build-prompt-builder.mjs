// Portable Slates Prompt Builder exporter.
//
// The downloadable .skill is a BUILD, never a prompting source. Its model,
// character, and policy references are copied from the exact production skill
// markdown embedded into @slatesvideo/shared for MCP, CLI, and Studio Agent.
// `--check` compares normalized text content and the deterministic ZIP bytes
// against those sources and exits 1 on drift.

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, unzipSync, zipSync } from 'fflate'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const exportRoot = join(pkgRoot, 'exports', 'slates-prompt-builder')
const generatedDir = join(exportRoot, 'generated')
const modelFactsPath = join(pkgRoot, 'src', 'prompts', 'model-facts.ts')
const checkOnly = process.argv.includes('--check')
const archiveName = 'slates-prompt-builder.skill'
const manifestName = 'slates-prompt-builder-manifest.json'
// DOS ZIP timestamps are local-time and reject anything before 1980. Using
// the local constructor avoids a western timezone converting UTC midnight to
// 1979 while keeping the archive deterministic on the same build platform.
const zipEpoch = new Date(1980, 0, 1, 0, 0, 0)

// The header ships to customers, so it carries no internal build command.
// Editing protection comes from the manifest + `--check`, not from this line.
const generatedComment =
  '<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->'

// Production skills are written for operators who have the Slates tools
// connected. Anything fenced with these markers is transport (tool names,
// params, billing mechanics, error codes) that a standalone reader cannot run,
// so it is stripped from the portable export. Capability statements stay —
// "Slates composes the naming for you" is doctrine a reader benefits from and
// a reason to buy. Only unrunnable instruction is fenced.
const slatesOnlyOpen = '<!-- slates-only -->'
const slatesOnlyClose = '<!-- /slates-only -->'

// If a fence is forgotten, these tokens reach the download and the build fails
// rather than silently shipping dead instructions to a prospect.
const leakPatterns = [
  /\bslates_[a-z][a-z0-9_]*/,
  /\bslate\/src\//,
  /\brequires_confirm\b/,
  /\bconfirm=true\b/,
  /\brealFaceConsent\b/,
  /\bseedanceRealFace\b/,
  /\b[a-z][a-zA-Z0-9]*AssetId\b/,
  // Cross-references to sibling production skills — dead pointers in a download.
  /\bslates-(?:prompting|model|cost|content)[a-z0-9-]*/,
]

const specs = [
  {
    output: 'SKILL.md',
    source: join(exportRoot, 'prompt-builder.md'),
    kind: 'router',
  },
  {
    output: 'reference-character.md',
    source: join(pkgRoot, 'skills', 'slates-character-identity.md'),
    kind: 'production-skill',
  },
  {
    output: 'reference-seedance.md',
    source: join(pkgRoot, 'skills', 'slates-prompting-seedance.md'),
    kind: 'production-skill',
  },
  {
    output: 'reference-kling.md',
    source: join(pkgRoot, 'skills', 'slates-prompting-kling-v3.md'),
    kind: 'production-skill',
  },
  {
    output: 'reference-nano-banana.md',
    source: join(pkgRoot, 'skills', 'slates-prompting-nano-banana-2.md'),
    kind: 'production-skill',
  },
  {
    output: 'reference-content-policy.md',
    source: join(pkgRoot, 'skills', 'slates-content-policy.md'),
    kind: 'production-skill',
  },
]

const portableModels = [
  { id: 'kling-v3', guide: 'reference-kling.md' },
  { id: 'seedance-2', guide: 'reference-seedance.md' },
  { id: 'nano-banana-2', guide: 'reference-nano-banana.md' },
]

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/u, '') + '\n'
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

// A cross-reference to a skill that also ships in this pack is a live pointer,
// not a leak — rewrite it to the portable filename instead of deleting it.
// Longest-first so `slates-prompting-kling-v3` cannot be partly eaten.
const crossRefs = [
  ['slates-prompting-nano-banana-2', 'reference-nano-banana.md'],
  ['slates-prompting-kling-v3', 'reference-kling.md'],
  ['slates-character-identity', 'reference-character.md'],
  ['slates-prompting-seedance', 'reference-seedance.md'],
  ['slates-content-policy', 'reference-content-policy.md'],
]

function rewriteCrossRefs(text) {
  let out = text
  for (const [from, to] of crossRefs) out = out.split(from).join(to)
  return out
}

function stripSlatesOnly(text, file) {
  let out = ''
  let cursor = 0
  while (true) {
    const open = text.indexOf(slatesOnlyOpen, cursor)
    if (open < 0) break
    const close = text.indexOf(slatesOnlyClose, open + slatesOnlyOpen.length)
    if (close < 0) throw new Error(`${file}: unclosed ${slatesOnlyOpen} fence`)
    const nested = text.indexOf(slatesOnlyOpen, open + slatesOnlyOpen.length)
    if (nested >= 0 && nested < close) throw new Error(`${file}: nested ${slatesOnlyOpen} fence`)
    // Only a fence that OWNS its lines takes a trailing newline with it — that
    // removes the block's own line break and lets the blank-run collapse below
    // close the gap. A fence opened mid-line is a phrase inside someone else's
    // sentence, so the newline that ends that sentence must survive; eating it
    // would weld the next paragraph or list onto the line above.
    const ownsItsLines = open === 0 || text[open - 1] === '\n'
    let end = close + slatesOnlyClose.length
    if (ownsItsLines && text[end] === '\n') end += 1
    out += text.slice(cursor, open)
    cursor = end
  }
  out += text.slice(cursor)
  const orphan = out.indexOf(slatesOnlyClose)
  if (orphan >= 0) throw new Error(`${file}: ${slatesOnlyClose} without a matching open fence`)
  // Collapse the 3+ newline runs that removing a whole section can leave.
  return out.replace(/\n{3,}/g, '\n\n')
}

function assertPortable(text, file) {
  for (const pattern of leakPatterns) {
    const hit = pattern.exec(text)
    if (hit) {
      throw new Error(
        `${file}: portable export leaks Slates-internal detail ${JSON.stringify(hit[0])} — ` +
          `wrap that block in ${slatesOnlyOpen} … ${slatesOnlyClose} in the production skill`
      )
    }
  }
}

function stripFrontmatter(text, file) {
  const normalized = normalize(text)
  if (!normalized.startsWith('---\n')) return normalized
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) throw new Error(`${file}: unclosed YAML frontmatter`)
  return normalized.slice(end + '\n---\n'.length).trimStart()
}

function modelFact(source, id) {
  const marker = `id: '${id}'`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error(`model-facts.ts: missing ${id}`)
  const blockStart = source.lastIndexOf('\n  {', markerIndex)
  const nextBlock = source.indexOf('\n  {', markerIndex + marker.length)
  const blockEnd = nextBlock < 0 ? source.indexOf('\n]', markerIndex) : nextBlock
  const block = source.slice(blockStart, blockEnd)
  const label = /label:\s*'((?:\\'|[^'])+)'/.exec(block)?.[1]?.replace(/\\'/g, "'")
  const notes = /notes:\s*'((?:\\'|[^'])+)'/s.exec(block)?.[1]?.replace(/\\'/g, "'")
  if (!label || !notes) throw new Error(`model-facts.ts: could not parse label/notes for ${id}`)
  return { label, notes: notes.replace(/\s+/g, ' ').trim() }
}

function routingTable(modelFactsSource) {
  const rows = portableModels.map(({ id, guide }) => {
    const fact = modelFact(modelFactsSource, id)
    return `| **${fact.label}** | ${fact.notes} | \`${guide}\` |`
  })
  return [
    '| Model | Canonical route | Guide |',
    '|---|---|---|',
    ...rows,
  ].join('\n')
}

function stampRouter(text, file, modelFactsSource) {
  const normalized = normalize(text)
  if (!normalized.startsWith('---\n')) {
    throw new Error(`${file}: router must start with YAML frontmatter`)
  }
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) throw new Error(`${file}: unclosed YAML frontmatter`)
  const boundary = end + '\n---\n'.length
  const open = '<!-- @generated:model-routing -->'
  const close = '<!-- @end:model-routing -->'
  const openIndex = normalized.indexOf(open)
  const closeIndex = normalized.indexOf(close)
  if (openIndex < boundary || closeIndex < openIndex) {
    throw new Error(`${file}: missing or invalid model-routing marker pair`)
  }
  if (normalized.indexOf(open, openIndex + open.length) >= 0 || normalized.indexOf(close, closeIndex + close.length) >= 0) {
    throw new Error(`${file}: model-routing markers must appear exactly once`)
  }
  const resolved =
    normalized.slice(0, openIndex + open.length) +
    '\n' + routingTable(modelFactsSource) + '\n' +
    normalized.slice(closeIndex)
  return normalize(
    resolved.slice(0, boundary) + '\n' + generatedComment + '\n\n' + resolved.slice(boundary).trimStart()
  )
}

function render(spec, raw, modelFactsSource) {
  if (spec.kind === 'router') return stampRouter(raw, spec.source, modelFactsSource)
  const body = rewriteCrossRefs(stripSlatesOnly(stripFrontmatter(raw, spec.source), spec.source))
  const note =
    '> **This is the real thing.** Every rule below is the working doctrine Slates runs in production against this model — not a summary written for a handout. Slates automates it end to end; the doctrine works by hand too.'
  const output = normalize(`${generatedComment}\n\n${note}\n\n${body}`)
  assertPortable(output, spec.source)
  return output
}

// Runs against the RENDERED export, not the source: fencing a block must not
// be able to quietly delete the contract from the shipped file.
function assertCharacterContract(renderedText) {
  const rulesPath = join(pkgRoot, 'src', 'prompts', 'reference-rules.ts')
  const builderPath = join(pkgRoot, 'src', 'prompts', 'character-sheet.ts')
  const rules = readFileSync(rulesPath, 'utf8')
  const builder = readFileSync(builderPath, 'utf8')
  const match = /export const IDENTITY_PLATE_HEX = ['"]([^'"]+)['"]/.exec(rules)
  if (!match) throw new Error('reference-rules.ts: could not resolve IDENTITY_PLATE_HEX')
  const plate = match[1]
  const required = [
    'one identity sheet per character',
    plate,
    'flat and shadowless',
    'portrait, three-quarter angle, largest panel',
    'full-body front',
    'full-body back',
  ]
  const lower = renderedText.toLowerCase()
  for (const phrase of required) {
    if (!lower.includes(phrase.toLowerCase())) {
      throw new Error(`reference-character.md: missing canonical contract phrase ${JSON.stringify(phrase)}`)
    }
  }
  if (!builder.includes('three panels side by side on one plate') || !builder.includes('IDENTITY_LIGHTING_CLAUSE')) {
    throw new Error('character-sheet.ts: runtime builder no longer matches the one-sheet/neutral-light contract')
  }
}

function makeArchive(outputs) {
  const input = {}
  for (const [name, text] of outputs) {
    input[name] = [strToU8(text), { mtime: zipEpoch }]
  }
  return Buffer.from(zipSync(input, { level: 9 }))
}

function validateArchive(archive, outputs) {
  const unpacked = unzipSync(new Uint8Array(archive))
  const expectedNames = [...outputs.keys()].sort()
  const actualNames = Object.keys(unpacked).sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `${archiveName}: entries differ\n  expected: ${expectedNames.join(', ')}\n  actual:   ${actualNames.join(', ')}`
    )
  }
  for (const [name, text] of outputs) {
    const actual = Buffer.from(unpacked[name])
    const expected = Buffer.from(text, 'utf8')
    if (!actual.equals(expected)) throw new Error(`${archiveName}: ${name} content differs from generated source`)
  }
}

const rendered = new Map()
const sources = []
const modelFactsSource = readFileSync(modelFactsPath, 'utf8')

for (const spec of specs) {
  if (!existsSync(spec.source)) throw new Error(`missing source: ${spec.source}`)
  const raw = readFileSync(spec.source, 'utf8')
  const output = render(spec, raw, modelFactsSource)
  if (spec.output === 'reference-character.md') assertCharacterContract(output)
  rendered.set(spec.output, output)
  sources.push({
    path: relative(pkgRoot, spec.source).replace(/\\/g, '/'),
    sha256: sha256(normalize(raw)),
  })
}
sources.push({
  path: relative(pkgRoot, modelFactsPath).replace(/\\/g, '/'),
  sha256: sha256(normalize(modelFactsSource)),
})

const archive = makeArchive(rendered)
validateArchive(archive, rendered)

const manifest = {
  schemaVersion: 1,
  source: '@slatesvideo/shared',
  sourceFiles: sources,
  outputs: [...rendered.entries()].map(([path, text]) => ({
    path,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256(text),
  })),
  archive: {
    path: archiveName,
    bytes: archive.length,
    sha256: sha256(archive),
    entries: [...rendered.keys()].sort(),
  },
}
const manifestText = JSON.stringify(manifest, null, 2) + '\n'
const expected = new Map(rendered)
expected.set(archiveName, archive)
expected.set(manifestName, manifestText)

function bytesOf(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
}

function checkGenerated() {
  const failures = []
  const expectedNames = [...expected.keys()].sort()
  const actualNames = existsSync(generatedDir)
    ? readdirSync(generatedDir).filter((name) => !name.startsWith('.')).sort()
    : []
  for (const name of expectedNames) {
    const path = join(generatedDir, name)
    if (!existsSync(path)) {
      failures.push(`${name}: missing`)
      continue
    }
    const actual = readFileSync(path)
    const expectedValue = expected.get(name)
    const wanted = bytesOf(expectedValue)
    // Git may check text out as CRLF on Windows. Compare normalized text
    // content, but keep the binary .skill archive byte-exact.
    const comparableActual = Buffer.isBuffer(expectedValue)
      ? actual
      : Buffer.from(normalize(actual.toString('utf8')), 'utf8')
    if (!comparableActual.equals(wanted)) {
      failures.push(`${name}: stale (${sha256(comparableActual)} != ${sha256(wanted)})`)
      if (name === archiveName) {
        try {
          validateArchive(actual, rendered)
        } catch (error) {
          failures.push(`${archiveName}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }
  for (const extra of actualNames.filter((name) => !expected.has(name))) {
    failures.push(`${extra}: unexpected generated file`)
  }
  return failures
}

if (checkOnly) {
  const failures = checkGenerated()
  if (failures.length) {
    console.error('[prompt-builder] generated export is out of sync:')
    for (const failure of failures) console.error(`  - ${failure}`)
    console.error('[prompt-builder] run `npm run sync-prompt-builder` at the slates-mcp root.')
    process.exit(1)
  }
  console.log(`[prompt-builder] verified ${rendered.size} generated markdown files + deterministic .skill`)
} else {
  mkdirSync(generatedDir, { recursive: true })
  const extras = existsSync(generatedDir)
    ? readdirSync(generatedDir).filter((name) => !name.startsWith('.') && !expected.has(name))
    : []
  if (extras.length) {
    console.error(`[prompt-builder] refusing to delete unexpected files from generated/: ${extras.join(', ')}`)
    process.exit(1)
  }
  for (const [name, value] of expected) writeFileSync(join(generatedDir, name), bytesOf(value))
  console.log(`[prompt-builder] wrote ${rendered.size} markdown files, manifest, and ${archiveName}`)
}
