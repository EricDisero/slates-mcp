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
 * CONTENTS = the paid skills PLUS the free ones, so a buyer has everything in
 * one download. The free/paid line is the FOLDER, and nothing else:
 *
 *   packages/shared/skills/*.md       → FREE: npm, the MCP, the desktop agent
 *   ../slates-api/pack-skills/*.md    → PAID: this zip and the members feed only
 *
 * The paid folder lives in slates-api because that repo is private; this one
 * is public (moved 2026-09-27). Set SLATES_PACK_SKILLS_DIR to build from
 * elsewhere. What may be paid: second-brain funnel-architecture.md § Pack
 * content doctrine (capability free, outcomes paid; paid means proven ads).
 *
 * The manifest's `catalog` is THE chart of every skill and its tier. slates-web
 * mirrors it into src/app/lib/generated/skillsCatalog.ts for /docs/skills-pack,
 * and its lockstep check fails when the mirror is stale.
 *
 * The zip is deterministic: fixed timestamps, sorted entries, no dependencies.
 * Rebuilding without source changes produces a byte-identical file, so the
 * content hash in the filename is stable and reviewable.
 *
 * Run: npm run build:skills-pack
 * Out: dist-pack/agentic-skills-pack-v<version>-<hash>.zip
 *      dist-pack/pack-manifest.json   ← what the lockstep gate reads
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { loadTypeScriptModule } from './load-typescript.mjs';
const { parseSkillMetadata } = loadTypeScriptModule(new URL('../packages/shared/src/skills/metadata.ts', import.meta.url));

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// ── Version. Bump this deliberately; it lands in the public filename. ──
// PATCH bump 2026-09-09 (house default; a minor/major needs Eric's word).
// v1.1.0's zip had gone four weeks stale: it advertised three skills that had
// been deleted and omitted eleven that exist, including the GPT Image 2.5
// prompting guide that replaced GPT Image 2's. Rebuilding at the SAME version
// would leave two different zips both calling themselves v1.1.0, which is what
// the lockstep gate refuses — correctly. Bumping makes the change visible.
// ✅ UPLOADED AND LIVE 2026-09-09. The zip is on Tigris (200) and both copies of
// SKILLS_PACK_DOWNLOAD_URL — slates-web/src/app/lib/pricing.ts and
// slates-api/src/routes/webhooks.ts — now point at it. v1.1.0 is deliberately
// LEFT UP: its URL is in the receipt email of everyone who bought before this,
// and a paid download must never 404 (PROTECTED_PREFIXES in the upload script
// refuses to prune it). Ordering, always: upload, then move the URLs.
//
// Rebuilt in place at 1.1.1 twice on 2026-09-09 — once for the GPT Image 2.5
// swap, once after the reference cap, transparent backgrounds and corrected size
// bounds landed. Rebuilding at the same version is refused for a PUBLISHED zip,
// but neither rebuild had been uploaded yet, so there was no second file to
// disagree with and no reason to burn a version number.
// 2026-09-15 local candidate: updated prompting corpus. Not uploaded or released.
const PACK_VERSION = process.env.PACK_VERSION ?? '1.1.2';

const FREE_DIR = join(root, 'packages', 'shared', 'skills');
const PAID_DIR = process.env.SLATES_PACK_SKILLS_DIR ?? resolve(root, '..', 'slates-api', 'pack-skills');
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
/**
 * The chart's one line: the frontmatter `description:` up to its first
 * sentence end or em dash (the website bans em dashes in visible copy).
 */
function summary(body) {
  const desc = parseSkillMetadata(body.toString('utf8')).description;
  let first = desc.split(/\s+—\s+|(?<=[.!?])\s/)[0].replace(/[.!?]$/, '');
  if (!first) throw new Error('a skill has no description: frontmatter; the chart cannot describe it');
  // A cut inside a parenthesis ("(ByteDance image model — the cheap…") closes it.
  if ((first.match(/\(/g) ?? []).length > (first.match(/\)/g) ?? []).length) first += ')';
  return `${first}.`;
}

function collect(dir, tier) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const body = readFileSync(join(dir, f));
      parseSkillMetadata(body.toString('utf8'), basename(f, '.md'));
      return { key: basename(f, '.md'), tier, body, summary: summary(body) };
    });
}

if (!existsSync(PAID_DIR)) {
  console.error(
    `✖ build:skills-pack — the paid skills folder is missing: ${PAID_DIR}\n` +
      '  It lives in the private slates-api repo next to this one. Check it out there,\n' +
      '  or point SLATES_PACK_SKILLS_DIR at it.'
  );
  process.exit(1);
}

const free = collect(FREE_DIR, 'free');
const paid = collect(PAID_DIR, 'paid');

if (paid.length === 0) {
  console.error(
    '✖ build:skills-pack — the paid skills folder is empty.\n' +
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
const paidList = paid.map((s) => `- \`${s.key}\`: ${s.summary}`).join('\n');
const readme = `# Slates Agentic Skills Pack

**Pack version ${PACK_VERSION}: ${paid.length} paid ad playbooks, plus all ${free.length} free Slates skills.**

---

## What you paid for: the ad playbooks

The playbooks behind our own ads. They are only in this download and in your members feed.
They are not on npm and the one-command installer does not include them.

${paidList}

Install these by copying their folders (Option B below).

## What's free, and already yours

The other ${free.length} skills are free for everyone: per-model prompting, the production
workflows, and craft and cost discipline. The Slates MCP already serves them to your AI, and
one command installs them (Option A). They are in \`skills/\` too, so everything is in one place.

The full chart of what is free and what is paid: https://slates.video/docs/skills-pack

---

## Setup

**Before you start:** your AI tool needs to be connected to Slates. If it isn't yet, follow
https://slates.video/docs/connect-claude first. It's one click from inside the app
(Settings → AI tools), or one terminal command.

### Option A: one command (the free skills)

\`\`\`
npx -y @slatesvideo/cli install-skills --global
\`\`\`

That installs the free skills for Claude Code and Codex account-wide (drop \`--global\` for the current
project). For Codex use \`install-skills --client codex --global\`; \`--client both\` installs
the same sources for both clients. **It does not install the paid ad playbooks listed above**,
so use Option B for those. Start a new session after installation.

### Option B: copy the folders (required for the ad playbooks)

Each skill in this pack's \`skills/\` folder is a ready-to-use folder
(\`<skill-name>/SKILL.md\`). Copy the ones you want into:

- **Claude Code (this project):** \`.claude/skills/\` inside your project folder
- **Claude Code (everywhere):** \`~/.claude/skills/\` (Windows: \`C:\\Users\\<you>\\.claude\\skills\\\`)
- **Codex (this project):** \`.agents/skills/\` inside your project folder
- **Codex (everywhere):** \`~/.agents/skills/\` (Windows: \`C:\\Users\\<you>\\.agents\\skills\\\`)
- **Other MCP clients (Claude Desktop, Cursor, etc.):** the skills also work as plain
  instructions. Open any \`SKILL.md\` and paste its contents into your conversation or your
  tool's custom-instructions/rules area when you want that workflow.

Restart your AI tool after copying.

---

## Using them

In Claude Code and Codex, installed skills are selected from the ordinary-language request.
You do not need to name a skill or choose a model:

> "Make me a 30-second UGC-style ad for my coffee brand in Slates."

> "Take this script and build the whole video: storyboard it, generate the shots, assemble the timeline."

> "Create a consistent character named Mara and put her in five different scenes."

The agent chooses the workflow and relevant craft for your brief, works in the connected
Slates project and shows generation costs before spending. Other MCP clients can use the
authenticated members feed or the instructions you supplied; they do not discover local
skill folders through the Claude Code or Codex installer.

---

## Troubleshooting

- **The agent ignores the skills.** Restart your AI tool, since skills are read at startup.
- **"Not connected to Slates."** Open the desktop app and check Settings → AI tools, or
  run \`npx -y @slatesvideo/cli login\`.
- **Full setup guide:** https://slates.video/docs/skills-pack

---

_Setup guide: https://slates.video/docs/skills-pack. Keep your purchase email; the download
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

// Keep existing artifacts: published receipt URLs and previous local builds remain reviewable.
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
  // THE chart: every skill, its tier, one line on what it does. Paid first.
  catalog: [...paid, ...free].map((s) => ({ key: s.key, tier: s.tier, summary: s.summary })),
};
writeFileSync(join(OUT_DIR, 'pack-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ built ${filename}`);
console.log(`   ${all.length} skills (${free.length} free + ${paid.length} pack-exclusive), ${(zip.length / 1024).toFixed(1)} KB`);
console.log(`   pack-exclusive: ${paid.map((s) => s.key).join(', ')}`);
console.log(`   url: ${manifest.url}`);
