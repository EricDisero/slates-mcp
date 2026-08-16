#!/usr/bin/env node
/**
 * Build the paid "Agentic Skills Pack" zip (the $29 funnel order bump).
 *
 * WHY THIS EXISTS (2026-08-16): there was no build script. The v1.0.0 zip was
 * built by hand, which is why nobody could answer "what is actually in it?"
 * without downloading it from Tigris and unzipping it. It also shipped with
 * BACKSLASH path separators (`skills\name\SKILL.md`), which unzip warns about
 * and some extractors mishandle. Both problems are fixed here.
 *
 * CONTENTS = the free skills (placeholder filler, per slates-mcp/CLAUDE.md
 * "the currently-shipped pack zip is a placeholder built from these free skills
 * until blueprints exist") PLUS everything in pack-skills/, which is
 * pack-EXCLUSIVE and deliberately absent from the npm tarball.
 *
 *   packages/shared/skills/*.md   → free layer, also ships on npm
 *   pack-skills/*.md              → PAID, ships ONLY in this zip
 *
 * The zip is deterministic: fixed timestamps, sorted entries, no dependencies.
 * Rebuilding without source changes produces a byte-identical file, so the
 * content hash in the filename is stable and reviewable.
 *
 * Run: npm run build:skills-pack
 * Out: dist-pack/agentic-skills-pack-v<version>-<hash>.zip
 *      dist-pack/pack-manifest.json   ← what the lockstep gate reads
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// ── Version. Bump this deliberately; it lands in the public filename. ──
const PACK_VERSION = process.env.PACK_VERSION ?? '1.1.0';

const FREE_DIR = join(root, 'packages', 'shared', 'skills');
const PAID_DIR = join(root, 'pack-skills');
const OUT_DIR = join(root, 'dist-pack');

// ── Deterministic DOS timestamp (2026-08-16 12:00:00) ──────────────────
const DOS_TIME = (12 << 11) | (0 << 5) | 0;
const DOS_DATE = ((2026 - 1980) << 9) | (8 << 5) | 16;

// ── CRC32 ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Minimal, spec-correct zip writer (deflate, UTF-8 names, / separators) ──
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    if (name.includes('\\')) throw new Error(`Refusing backslash in zip entry: ${name}`);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    // Only use deflate if it actually helps; otherwise store.
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    // External attrs: regular file, mode 644. `<<` is signed 32-bit in JS, so
    // this overflows negative without the >>> 0.
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(centrals);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localPart, centralPart, eocd]);
}

// ── Collect skills ─────────────────────────────────────────────────────
function collect(dir, tier) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({
      key: basename(f, '.md'),
      tier,
      body: readFileSync(join(dir, f)),
    }));
}

const free = collect(FREE_DIR, 'free');
const paid = collect(PAID_DIR, 'paid');

if (paid.length === 0) {
  console.error(
    '✖ build:skills-pack — pack-skills/ is empty.\n' +
      '  The pack would contain nothing the free npm install does not already give away,\n' +
      '  which means the $29 bump has no exclusive content. Refusing to build.'
  );
  process.exit(1);
}

const all = [...free, ...paid].sort((a, b) => a.key.localeCompare(b.key));
const dupes = all.map((s) => s.key).filter((k, i, arr) => arr.indexOf(k) !== i);
if (dupes.length) {
  console.error(`✖ build:skills-pack — duplicate skill key(s) across free and paid: ${dupes.join(', ')}`);
  process.exit(1);
}

// ── README ─────────────────────────────────────────────────────────────
// Regenerated so the skill inventory is never hand-typed (workspace rule:
// "never hand-type a fact an LLM will read").
const paidList = paid.map((s) => `  - \`${s.key}\``).join('\n');
const readme = `# Slates — Agentic Skills Pack

The exact skills and workflows we use to make our own videos with Slates. Your AI agent
(Claude Code, Claude Desktop, Cursor, or any MCP client connected to Slates) reads these and
drives the whole production for you — storyboards, generation, editing, export — hands-off.

**Pack version ${PACK_VERSION} — ${all.length} skills.**

---

## ⭐ Pack-exclusive — these are ONLY in this download

These are the real campaign skills behind our own ads. They are **not** published to npm and
**not** installed by \`install-skills\`. The only way to get them is this zip:

${paidList}

**Install these by copying the folders** (Option B below). The one-command installer in
Option A does *not* include them — it only installs the free layer.

---

## What else is inside (\`skills/\`)

- **Production workflows** — full recipes the agent runs end to end (one-prompt film,
  direct-response ad, script → storyboard → shots → timeline, character turnaround,
  edit-and-iterate, vision feedback loop)
- **Per-model prompting mastery** — one skill per model, so the agent prompts each the way it
  actually responds best
- **Craft + discipline** — model selection, style prompting, project organization, cost
  discipline (the agent quotes credit costs before it spends), content policy

---

## Setup (about two minutes)

**Before you start:** your AI tool needs to be connected to Slates. If it isn't yet, follow
https://slates.video/docs/connect-claude first — one click from inside the app
(Settings → Agent Control), or one terminal command.

### Option A — one command (free layer only)

\`\`\`
npx -y @slatesvideo/cli install-skills --global
\`\`\`

That installs the free skills for Claude Code account-wide (drop \`--global\` to install into
just the current project folder). **It does not install the pack-exclusive skills listed
above** — use Option B for those. Restart your AI tool; skills load at startup.

### Option B — copy the folders (required for the exclusives)

Each skill in this pack's \`skills/\` folder is a ready-to-use folder
(\`<skill-name>/SKILL.md\`). Copy the ones you want into:

- **Claude Code (this project):** \`.claude/skills/\` inside your project folder
- **Claude Code (everywhere):** \`~/.claude/skills/\` (Windows: \`C:\\Users\\<you>\\.claude\\skills\\\`)
- **Other MCP clients (Claude Desktop, Cursor, etc.):** the skills also work as plain
  instructions — open any \`SKILL.md\` and paste its contents into your conversation or your
  tool's custom-instructions/rules area when you want that workflow.

Restart your AI tool after copying.

---

## Using them

Just ask — skills trigger automatically when your request matches. You never invoke them by name:

> "Make me a 30-second UGC-style ad for my coffee brand in Slates."

> "Take this script and build the whole video — storyboard it, generate the shots, assemble the timeline."

> "Create a consistent character named Mara and put her in five different scenes."

The agent opens a Slates project, generates the assets, and assembles everything while you watch
the app fill in live. Every generation shows its credit cost before it runs.

---

## Troubleshooting

- **The agent ignores the skills.** Restart your AI tool — skills are read at startup.
- **"Not connected to Slates."** Open the desktop app and check Settings → Agent Control, or
  run \`npx -y @slatesvideo/cli login\`.
- **Full setup guide:** https://slates.video/docs/skills-pack

---

_Setup guide: https://slates.video/docs/skills-pack — keep your purchase email; the download
link stays live._
`;

// ── Assemble ───────────────────────────────────────────────────────────
const entries = [
  { name: 'README.md', data: Buffer.from(readme, 'utf8') },
  ...all.map((s) => ({ name: `skills/${s.key}/SKILL.md`, data: s.body })),
];

const zip = buildZip(entries);
const hash = createHash('sha256').update(zip).digest('hex').slice(0, 16);
const filename = `agentic-skills-pack-v${PACK_VERSION}-${hash}.zip`;

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, filename), zip);

const manifest = {
  version: PACK_VERSION,
  filename,
  sha256: createHash('sha256').update(zip).digest('hex'),
  bytes: zip.length,
  url: `https://slates-web-assets.t3.tigrisfiles.io/${filename}`,
  skillCount: all.length,
  freeSkills: free.map((s) => s.key),
  paidSkills: paid.map((s) => s.key),
};
writeFileSync(join(OUT_DIR, 'pack-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ built ${filename}`);
console.log(`   ${all.length} skills (${free.length} free + ${paid.length} pack-exclusive), ${(zip.length / 1024).toFixed(1)} KB`);
console.log(`   pack-exclusive: ${paid.map((s) => s.key).join(', ')}`);
console.log(`   url: ${manifest.url}`);
