// ============================================================
// THE BRAIN'S LAYERS, extracted from the skills (second-brain
// plans/2026-10-25-slates-brain.md § The shape).
//
//   L0  the Director card: between the @director markers in slates-start-here,
//       always loaded (Director's system prompt, the MCP server's instructions)
//   L1  the router: the rest of slates-start-here, one row per job
//   L2  playbooks, L3 rules and model guides: each file leads with an
//       operative summary (@operative), or its craft card (@card) on a model guide
//
// Nothing here is written by hand: each layer is cut from its markdown, the same
// way craft-cards.ts cuts cards, so an edit to the skill is the only edit.
// scripts/brain-lint.mjs holds the shape (caps, summaries, reachability).
//
// Root barrel only, like agent-doctrine.ts: it pulls in the whole SKILLS record.
// ============================================================

import { SKILLS } from '../skills/content.js'

export const BRAIN_ROUTER = 'slates-start-here'

const DIRECTOR_RE = /<!--\s*@director:start\s*-->([\s\S]*?)<!--\s*@director:end\s*-->/
const OPERATIVE_RE = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/
const COMMENT_RE = /<!--[\s\S]*?-->/g
const FRONTMATTER_RE = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/

const router = SKILLS[BRAIN_ROUTER]
if (!router) throw new Error(`[brain] ${BRAIN_ROUTER}.md is missing from the embedded skills`)
const card = DIRECTOR_RE.exec(router)
if (!card) throw new Error(`[brain] ${BRAIN_ROUTER}.md has no @director block`)

/** L0: how every job starts. */
export const DIRECTOR_CARD: string = card[1].replace(COMMENT_RE, '').trim()

/** L1: the router without its frontmatter, title or Director card. */
export const ROUTER_BODY: string = router
  .replace(FRONTMATTER_RE, '')
  .replace(DIRECTOR_RE, '')
  .replace(COMMENT_RE, '')
  .replace(/^\s*# [^\n]*\n/, '')
  .trim()

/** A file's operative summary, or null when it carries none (a model guide's summary is its card). */
export function operativeSummary(content: string): string | null {
  const m = OPERATIVE_RE.exec(content)
  return m ? m[1].replace(COMMENT_RE, '').trim() : null
}
