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

import { BRAIN_SHAPE, SKILLS } from '../skills/content.js'

export const BRAIN_ROUTER = 'slates-start-here'
/** Every other name that opens the router (resolveGuideTopic); none of them may name a My brain file. */
export const ROUTER_ALIASES: readonly string[] = ['start-here', 'start here', 'start', 'router', 'brain', 'director-card', 'playbooks']
/**
 * The guide topic that serves the user's own brain: what an agent reads of it before the router
 * (skills/my-brain.ts, myBrainPreload). Its own topic, not a router alias; no My brain file takes the name.
 */
export const MY_BRAIN_TOPIC = 'my-brain'

/**
 * The playbooks (L2), pinned in scripts/brain-shape.json. The Director card says to follow a playbook's steps,
 * so the guide op serves each one whole at its default depth (guide-retrieval.ts).
 */
export const PLAYBOOKS: ReadonlySet<string> = new Set(BRAIN_SHAPE.layers.playbook ?? [])

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

// A My brain file named like a bundled skill adds to it rather than replacing it, so a later fix to the shared
// guide still reaches the user (skills/my-brain.ts). The served guide is one markdown string: the shared
// frontmatter (the guide still does the shared one's job), their file, then the shared body after a marker that
// only code reads. Every reader strips comments, so an agent sees the two lead lines and never the marker.
const OVERLAY_MARK = '<!-- @my-brain:shared -->'
export const OVERLAY_LEAD = "From the user's own brain (My brain): their rules for this guide, which win where they differ. The shared guide follows them."
export const OVERLAY_SHARED_LEAD = 'The shared guide of this name, under their rules:'

/** The guide served when a user's file `theirs` shares its name with the bundled `shared`. */
export function overlayGuide(theirs: string, shared: string): string {
  const frontmatter = FRONTMATTER_RE.exec(shared)?.[0] ?? ''
  return `${frontmatter}\n${OVERLAY_LEAD}\n\n${theirs.replace(FRONTMATTER_RE, '').trim()}\n\n${OVERLAY_MARK}\n${OVERLAY_SHARED_LEAD}\n\n${shared.replace(FRONTMATTER_RE, '').trim()}\n`
}

/** The two halves of an overlaid guide, or null when `content` is one file. */
export function splitOverlay(content: string): { theirs: string; shared: string } | null {
  const at = content.indexOf(OVERLAY_MARK)
  return at < 0 ? null : { theirs: content.slice(0, at), shared: content.slice(at + OVERLAY_MARK.length) }
}
