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
 * CONTENTS = only what may be public to anyone holding the link. The zip sits
 * in the PUBLIC slates-web-assets bucket and its URL is in the public web code
 * and every receipt email, so a file in it is a public file:
 *
 *   packages/shared/skills/*.md       → FREE: the Director card and router, also on npm
 *   ../slates-api/pack-skills/*.md    → PAID: the ad playbooks, this zip and the members feed
 *
 * The brain (../slates-api/brain/: playbooks, rules, model guides) NEVER goes in
 * the zip. It is private and read by tier (brain/tiers.json): every Slates
 * license opens its `license` files, the pack (`skills_pack`) also opens its
 * `bump` files. A buyer gets them signed in, through `install-skills`, the app
 * and the MCP (slates-api /brain), or the members feed (/members), both of
 * which check the account's entitlement on every fetch. 1.1.5 shipped the whole
 * brain in this zip; that is the leak this layout closes. The build refuses a
 * zip entry that is a brain file.
 *
 * The paid folder lives in slates-api because that repo is private; this one
 * is public (moved 2026-09-27). Set SLATES_PACK_SKILLS_DIR to build from
 * elsewhere. What may be paid: second-brain funnel-architecture.md § Pack
 * content doctrine (capability free, outcomes paid; paid means proven ads).
 *
 * The manifest's `catalog` is THE chart of every skill and its tier (`free`,
 * `paid`, and the brain's `license` and `bump`, which are listed but not in the
 * zip). slates-web
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
import { buildZip } from './zip.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { loadTypeScriptModule } from './load-typescript.mjs';
import { brainDir } from './brain-source.mjs';
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
// 1.1.3, 2026-10-23: adds the seven skills written since 1.1.2 (captions, cuts,
// the three layers, motion, transitions). Uploaded, then both URLs moved.
// 1.1.4, 2026-10-23 (release 1.6.3): the roster cleanup's skills (Nano Banana 2.1
// for 2, 2 Lite and Pro; FLUX 3 for FLUX.2 Max; Kling 4.0, Omni 1.1, Wan 3.0) and
// the in-app agent named Slates Director. Uploaded, then both URLs moved.
// 1.1.5, 2026-10-25: the approved brain (slates-api brain/ at d7bbc80): the Director
// card and router (slates-start-here), the ad-variants playbook, and every guide as
// the brain review approved it. Uploaded, then both URLs moved.
// 1.1.6, 2026-10-26: the brain leaves the zip. 1.1.5 carried every brain file,
// the bump playbooks included, in a public object; 1.1.6 holds the card, the
// router and the two ad playbooks, and the chart lists the brain by its tier.
// The 1.1.5 key is overwritten with this content (slates-api docs/web-assets.md)
// so links already in receipt emails stop serving the brain and still resolve.
const PACK_VERSION = process.env.PACK_VERSION ?? '1.1.6';

const FREE_DIR = join(root, 'packages', 'shared', 'skills');
const PAID_DIR = process.env.SLATES_PACK_SKILLS_DIR ?? resolve(root, '..', 'slates-api', 'pack-skills');
const OUT_DIR = join(root, 'dist-pack');

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
// The brain is charted by its tier and never zipped: the zip is public, the brain is not.
const BRAIN_DIR = brainDir();
const bumpNames = new Set(JSON.parse(readFileSync(join(BRAIN_DIR, 'tiers.json'), 'utf8')).bump);
const brain = collect(BRAIN_DIR, 'license').map((s) => (bumpNames.has(s.key) ? { ...s, tier: 'bump' } : s));

if (paid.length === 0) {
  console.error(
    '✖ build:skills-pack — the paid skills folder is empty.\n' +
      '  The pack would contain nothing the free npm install does not already give away,\n' +
      '  which means the $29 bump has no exclusive content. Refusing to build.'
  );
  process.exit(1);
}

const all = [...free, ...paid].sort((a, b) => a.key.localeCompare(b.key));
const dupes = [...all, ...brain].map((s) => s.key).filter((k, i, arr) => arr.indexOf(k) !== i);
if (dupes.length) {
  console.error(`✖ build:skills-pack — duplicate skill key(s) across free, paid and the brain: ${dupes.join(', ')}`);
  process.exit(1);
}
// A brain body in the public zip, under any name, is the 1.1.5 leak again.
const brainBodies = new Set(brain.map((s) => s.body.toString('utf8')));
const leaked = all.filter((s) => brainBodies.has(s.body.toString('utf8')));
if (leaked.length) {
  console.error(`✖ build:skills-pack — brain file(s) in the public zip: ${leaked.map((s) => s.key).join(', ')}`);
  process.exit(1);
}
const licenseCount = brain.filter((s) => s.tier === 'license').length;
const bumpList = brain.filter((s) => s.tier === 'bump').map((s) => `- \`${s.key}\`: ${s.summary}`).join('\n');

// ── README ─────────────────────────────────────────────────────────────
// Regenerated so the skill inventory is never hand-typed (workspace rule:
// "never hand-type a fact an LLM will read").
const paidList = paid.map((s) => `- \`${s.key}\`: ${s.summary}`).join('\n');
const readme = `# Slates Agentic Skills Pack

**Pack version ${PACK_VERSION}: ${paid.length} ad playbooks to copy in, plus the playbooks your account opens.**

---

## What you paid for

**The ad playbooks.** The playbooks behind our own ads, in this download's \`skills/\` folder and in
your members feed. They are not on npm and the one-command installer does not include them, so
copy their folders in (Option B below).

${paidList}

**The playbooks past ads**, which your pack opens in your Slates account:

${bumpList}

These reach your AI from your account, never from this download, so they stay current as we fix
them: the signed-in Slates MCP and the desktop agent read them, and one command installs them
(Option A). Your members feed carries them too.

## What comes with every Slates license

${licenseCount} more playbooks, rules and model guides: per-model prompting, the production
workflows, and craft and cost discipline. They reach your AI the same way, from your account.
The Director card and router (\`slates-start-here\`) are free for everyone and are in \`skills/\`.

The full chart of every skill and who has it: https://slates.video/docs/skills-pack

---

## Setup

**Before you start:** your AI tool needs to be connected to Slates. If it isn't yet, follow
https://slates.video/docs/connect-claude first. It's one click from inside the app
(Settings → AI tools), or one terminal command.

### Option A: one command (everything your account opens)

\`\`\`
npx -y @slatesvideo/cli login
npx -y @slatesvideo/cli install-skills --global
\`\`\`

That installs the card, the router and every playbook, rule and guide your account opens for
Claude Code and Codex account-wide (drop \`--global\` for the current project). For Codex use
\`install-skills --client codex --global\`; \`--client both\` installs the same sources for both
clients. Run it again to pick up fixes. **It does not install the ad playbooks in this download**,
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
  // What is IN the zip: `freeSkills` and `paidSkills`. `brainSkills` is charted, never zipped.
  skillCount: all.length,
  freeSkills: free.map((s) => s.key),
  paidSkills: paid.map((s) => s.key),
  brainSkills: brain.map((s) => s.key),
  // THE chart: every skill, its tier, one line on what it does. Paid, the pack's brain files, the license's, then free.
  catalog: [...paid, ...brain.filter((s) => s.tier === 'bump'), ...brain.filter((s) => s.tier === 'license'), ...free]
    .map((s) => ({ key: s.key, tier: s.tier, summary: s.summary })),
};
writeFileSync(join(OUT_DIR, 'pack-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ built ${filename}`);
console.log(`   ${all.length} skills in the zip (${free.length} free + ${paid.length} pack-exclusive), ${(zip.length / 1024).toFixed(1)} KB; ${brain.length} brain files charted, none zipped`);
console.log(`   pack-exclusive: ${paid.map((s) => s.key).join(', ')}`);
console.log(`   url: ${manifest.url}`);
