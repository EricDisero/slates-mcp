// ============================================================
// THE TOOL SURFACE: annotations, tiers, and the ONE schema renderer.
//
// Three jobs that all answer "what does a client see, and when":
//
//   1. ANNOTATIONS (MCP spec 2025-06-18). `readOnlyHint` / `destructiveHint` /
//      `idempotentHint` / `openWorldHint`, so a host can auto-approve a read
//      and warn on a delete. Without them `slates_list_assets` prompts exactly
//      like `slates_delete_project`, every prompt looks the same, and the user
//      learns to click through all of them.
//
//   2. TIERS. 90 ops is 112 KB of descriptions and JSON schemas on EVERY
//      desktop Studio Agent turn. `core` is what a session needs to work;
//      `extended` is selected through `slates_load_tools`. Both surfaces replace
//      the optional selection on a named/group load. MCP keeps every direct
//      operation callable for compatibility and notifies when its listing changes.
//
//   3. ONE SCHEMA RENDERER. The desktop rendered `$refStrategy: 'none'` and
//      the MCP server rendered `target: 'openApi3'`, so "the two surfaces
//      expose the same tools" was true of the ID SET and unproven of the
//      BYTES. `toolDefinitions()` is now the only renderer either one calls.
//
// 🚨 NOTHING HERE IS HAND-SET PER OP. Annotations are derived from the op id
// by the rules below, and `scripts/agent-surface-lockstep-check.mjs` re-derives
// them INDEPENDENTLY from each op's own transport verbs — a `readOnlyHint` on
// an op whose `run` body posts is a lie that lets a host auto-approve a
// mutation, so the check has to be able to catch it, and it is mutation-tested.
// ============================================================

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { z } from 'zod'
import type { OperationAnnotations, OperationGroup, OperationTier } from './index.js'

/** Structural shape of an op, declared locally so this module never imports a
 *  VALUE from the registry (which imports this one). */
export interface SurfaceOp {
  id: string
  description: string
  input: z.ZodType<unknown>
  billable?: boolean
  tier?: OperationTier
  group?: OperationGroup
  annotations?: OperationAnnotations
}

// ── 1. Annotations ──────────────────────────────────────────────────────────

/** Ops that only read. Prefixes, because the verb IS the first word of the id. */
const READ_ONLY_PREFIXES = [
  'slates_get_',
  'slates_list_',
  'slates_estimate_',
  'slates_blender_status',
  'slates_blender_scene',
  'slates_blender_docs',
  'slates_blender_search_docs',
]

/**
 * Ops whose effect a user cannot undo from inside Slates.
 *
 * Moves are here on purpose: `slates_move_assets_to_project` relocates files on
 * disk, and an agent that guessed the wrong project has no "put it back"
 * without knowing where they came from. A rename is recoverable; a move across
 * projects, in practice, is not.
 */
const DESTRUCTIVE_IDS = new Set([
  'slates_delete_project',
  'slates_delete_asset',
  'slates_delete_folder',
  'slates_delete_character',
  'slates_delete_environment',
  'slates_delete_style',
  'slates_delete_library_item',
  'slates_delete_storyboard',
  'slates_delete_scene',
  'slates_delete_frame',
  'slates_move_assets_to_folder',
  'slates_move_assets_to_project',
  'slates_move_entity_to_project',
  'slates_merge_shots',
  'slates_split_shot',
])

/** Same input, same end state — `update`/`set`/`reorder`/`rename` all overwrite
 *  rather than append, so re-running one is a no-op rather than a second edit. */
const IDEMPOTENT_PREFIXES = [
  'slates_update_',
  'slates_set_',
  'slates_reorder_',
  'slates_rename_',
  'slates_batch_update_',
]

const startsWithAny = (id: string, prefixes: readonly string[]): boolean =>
  prefixes.some((p) => id.startsWith(p))

/**
 * Derive an op's four hints.
 *
 * `openWorldHint` means "reaches something outside this system": every billable
 * op hits a provider, and every Blender op hits a separate process over a
 * socket. Everything else touches only the user's own workspace.
 */
export function annotate(id: string, billable: boolean | undefined): OperationAnnotations {
  const readOnlyHint = startsWithAny(id, READ_ONLY_PREFIXES)
  return {
    readOnlyHint,
    // A read is never destructive, whatever the id looks like.
    destructiveHint: !readOnlyHint && DESTRUCTIVE_IDS.has(id),
    idempotentHint: readOnlyHint || startsWithAny(id, IDEMPOTENT_PREFIXES),
    openWorldHint: !!billable || id.startsWith('slates_blender_'),
  }
}

// ── 2. Tiers ────────────────────────────────────────────────────────────────

/**
 * The deferred groups, by op id. Everything NOT listed here is `core`.
 *
 * The cut is "what a session needs to do the work" versus "what it needs once,
 * when the user asks for that thing". Creating, generating, reviewing and
 * shot-listing are core; tidying the library, cutting a timeline, renaming and
 * deleting, and driving Blender are not — and each is a coherent thing a user
 * asks for by name, which is what makes a group loadable in one call.
 *
 * 🚨 A GROUP IS A BUDGET, NOT A LAW. If `final_state` falls on timeline or
 * library tasks after this shipped, move those ops back to core. The point is
 * the per-turn byte count, and a deferral that costs a turn every time is not
 * paying for itself.
 */
export const OPERATION_GROUPS: Record<OperationGroup, readonly string[]> = {
  // Folders, styles, and moving assets around. Reached when the user says
  // "tidy this up", never while making the thing.
  library: [
    'slates_list_folders',
    'slates_create_folder',
    'slates_rename_folder',
    'slates_delete_folder',
    'slates_set_folder_cover',
    'slates_move_assets_to_folder',
    'slates_set_asset_favorite',
    'slates_export_assets',
    'slates_list_pins',
    'slates_pin_references',
    'slates_unpin_reference',
    'slates_move_assets_to_project',
    'slates_copy_assets_to_project',
    'slates_move_entity_to_project',
    'slates_list_styles',
    'slates_create_style',
    'slates_update_style',
    'slates_delete_style',
    'slates_list_library',
    'slates_create_library_item',
    'slates_update_library_item',
    'slates_delete_library_item',
    'slates_manage_library_category',
    'slates_copy_library_item_to_project',
    'slates_get_template',
    'slates_export_template',
    'slates_import_template',
    'slates_get_project_directory',
    'slates_reveal_file',
  ],
  // The cut and the export. A generation session never touches these.
  script: ['slates_get_script_document', 'slates_update_script_document', 'slates_get_script_sections', 'slates_update_script_section', 'slates_get_script_suggestions', 'slates_update_script_suggestions', 'slates_get_script_uses', 'slates_preview_script_variation', 'slates_create_script_variation', 'slates_get_shot_inputs', 'slates_reuse_shot_take'],
  timeline: [
    'slates_list_timelines', 'slates_save_timeline', 'slates_export_cuts',
    'slates_get_timeline',
    'slates_add_clip_to_timeline',
    'slates_reorder_clips',
    'slates_remove_clip',
    'slates_add_timeline_track',
    'slates_update_timeline_track',
    'slates_remove_timeline_track',
    'slates_update_timeline_settings',
    'slates_export_video',
    'slates_export_timeline_xml',
    'slates_trim_video',
  ],
  // Rename, delete, reorder. The 63-op CRUD tail the review measured at 39.5 KB.
  admin: [
    'slates_update_project',
    'slates_delete_project',
    'slates_delete_asset',
    'slates_update_character',
    'slates_delete_character',
    'slates_update_environment',
    'slates_delete_environment',
    'slates_update_storyboard',
    'slates_delete_storyboard',
    'slates_update_scene',
    'slates_delete_scene',
    'slates_reorder_scenes',
    'slates_delete_frame',
    'slates_batch_update_frames',
    'slates_duplicate_shot',
    'slates_split_shot',
    'slates_merge_shots',
  ],
  // A third transport nobody without Blender installed can reach.
  blender: [
    'slates_blender_status',
    'slates_blender_execute',
    'slates_blender_scene',
    'slates_blender_docs',
    'slates_blender_search_docs',
    'slates_blender_render_blocking',
  ],
}

const GROUP_BY_OP = new Map<string, OperationGroup>()
for (const [group, ids] of Object.entries(OPERATION_GROUPS) as Array<
  [OperationGroup, readonly string[]]
>) {
  for (const id of ids) GROUP_BY_OP.set(id, group)
}

export function groupFor(id: string): OperationGroup | undefined {
  return GROUP_BY_OP.get(id)
}

/** `extended` iff the op names a group. Absent from every group ⇒ `core`, so a
 *  new op is visible until someone deliberately defers it. */
export const STARTUP_TOOL_IDS = new Set([
  'slates_load_tools', 'slates_get_prompting_guide', 'slates_get_workspace_state',
  'slates_list_projects', 'slates_create_project', 'slates_list_assets',
  'slates_get_asset_image', 'slates_get_generation_status', 'slates_estimate_generation_cost',
])

export function tierFor(id: string): OperationTier {
  return STARTUP_TOOL_IDS.has(id) ? 'core' : 'extended'
}

/** One-line summary of each group, for `slates_load_tools`' own description. */
export const GROUP_SUMMARY: Record<OperationGroup, string> = {
  library: 'folders, the Library (user-named categories of saved references: characters, locations, products, looks), moving and copying assets and Library items between projects, revealing files on disk',
  script: 'rich script documents, anchored sections, alternatives, reusable passages, variations and take input history',
  timeline: 'named cuts and selected exports; the timeline (tracks, clips, settings), video export and NLE XML export, clip trimming',
  admin: 'rename / delete / reorder for projects, characters, environments, storyboards, scenes and frames; shot duplicate, split and merge',
  blender: 'the Blender previs bridge — scene inspection, bpy execution, API docs, grey-box render',
}

// ── 3. The one schema renderer ──────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  /** JSON Schema. Both surfaces read the same object under their own key name. */
  inputSchema: Record<string, unknown>
  annotations: OperationAnnotations
}

/**
 * Render one op's tool definition.
 *
 * `$refStrategy: 'none'` is the shape both surfaces now emit: inlined, so no
 * client has to resolve a `$ref`, and byte-identical between them — which is
 * what makes "the two surfaces expose the same tools" checkable rather than
 * merely asserted about the id set.
 */
export function toolDefinition(op: SurfaceOp): ToolDefinition {
  const schema = zodToJsonSchema(op.input as never, { $refStrategy: 'none' }) as Record<
    string,
    unknown
  >
  delete schema.$schema
  return {
    name: op.id,
    description: op.description,
    inputSchema: schema,
    annotations: op.annotations ?? annotate(op.id, op.billable),
  }
}

/**
 * Render a tool surface.
 *
 * `desktop` sends `core` plus whatever groups have been loaded this run; `mcp`
 * renders all definitions; the MCP server filters its connection listing from that set.
 */
export function toolDefinitions(
  ops: readonly SurfaceOp[],
  opts: { surface: 'desktop' | 'mcp'; groups?: readonly OperationGroup[]; names?: readonly string[] }
): ToolDefinition[] {
  const loaded = new Set(opts.groups ?? [])
  return ops
    .filter((op) => {
      if (opts.surface === 'mcp') return true
      const group = groupFor(op.id)
      return STARTUP_TOOL_IDS.has(op.id) || !!opts.names?.includes(op.id) || (group !== undefined && loaded.has(group))
    })
    .map(toolDefinition)
}
