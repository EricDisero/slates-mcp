// Operations layer — the ONE place every Slates agent tool is defined.
// Both the MCP server and the CLI register these as their tool / command
// surface. Every operation:
//
//   - has a stable string id (matches the MCP tool name)
//   - has a Zod input schema (used for both MCP tool definition and CLI
//     argument parsing)
//   - returns a structured object that's JSON-encoded for CLI stdout and
//     wrapped in MCP content blocks for the MCP path
//   - chooses its transport (cloud vs desktop) internally — callers
//     don't need to know which side a given op talks to

import { z } from 'zod'
import { SlatesCloudClient, type SlatesUserInfo, type CreditsBalance, type ModelRegistryResponse } from '../clients/cloud.js'
import { SlatesDesktopClient } from '../clients/desktop.js'
import { SKILLS } from '../skills/content.js'

export interface OperationContext {
  cloud: () => SlatesCloudClient
  desktop: () => SlatesDesktopClient
}

export function defaultContext(): OperationContext {
  return {
    cloud: () => new SlatesCloudClient(),
    desktop: () => new SlatesDesktopClient(),
  }
}

export interface OperationResult {
  // Structured payload — for the CLI we JSON.stringify, for the MCP we
  // serialize as text content. Optional `images` list lets ops attach
  // inline base64 images so the calling LLM can see what was generated
  // (e.g., generate_image, get_asset_image).
  text: string
  images?: Array<{ data: string; mimeType: string }>
  data?: unknown
}

export interface Operation<I> {
  id: string
  description: string
  input: z.ZodType<I>
  run: (input: I, ctx: OperationContext) => Promise<OperationResult>
}

// ── Helpers ─────────────────────────────────────────────────────

function ok(data: unknown, text?: string): OperationResult {
  return {
    // Compact JSON — pretty-printing (indent 2) cost ~10-15% extra tokens
    // on every tool result the calling LLM reads.
    text: text ?? JSON.stringify(data),
    data,
  }
}

// ── Credits (2026-07-07 re-denomination) ────────────────────────
// Costs are ABSTRACT CREDITS now, not dollars. The API's model registry
// returns `cost_credits` (with `cost_cents` kept as a legacy alias carrying
// the same credit value); balances the same. Read via creditCost(); display
// via fmtCredits(). The confirm gate fires above CONFIRM_CREDITS (≈ the old
// $0.50 gate at the 3¢/credit peg).
const CONFIRM_CREDITS = 17
const CENTS_PER_CREDIT = 3 // peg: 1 credit = 3¢ billed = 2¢ COGS (mirror of slates-api)

function creditCost(m: { cost_credits?: number; cost_cents?: number } | undefined): number {
  if (!m) return 0
  return m.cost_credits ?? m.cost_cents ?? 0
}

function fmtCredits(credits: number): string {
  return `${Math.round(credits).toLocaleString('en-US')} credits`
}

/** Convert a legacy desktop dollar estimate (COGS × markup) to billed credits,
 *  mirroring the server's toCredits(round(dollars × 100)). The desktop's
 *  generations.cost column still stores dollars, so status reads convert. */
function creditsFromDollars(dollars: number): number {
  const cents = Math.round(dollars * 100)
  return cents <= 0 ? 0 : Math.max(1, Math.ceil(cents / CENTS_PER_CREDIT))
}

// Shared describe-text for the background flag on every generate_* op.
const BACKGROUND_DESCRIBE =
  'Submit and return immediately with generationId(s) instead of blocking until the file is saved. ' +
  'Poll with slates_get_generation_status. Recommended for video (1-5 min renders).'

// Early-return shape when a generation route accepted the job in background
// mode ({ background: true } in the response). No inline-image fetch — the
// asset doesn't exist yet; the poller delivers it on completion.
function backgroundSubmitted(
  kind: string,
  ids: string[],
  extra: Record<string, unknown>,
  note?: string
): OperationResult {
  const idText = ids.length > 0 ? ids.join(', ') : '(no id returned)'
  return {
    text:
      `Submitted ${kind} in the background — generationId(s): ${idText}. ` +
      `Call slates_get_generation_status with waitSeconds: 45 (it long-polls and returns on completion — ` +
      `never a rapid loop; video renders commonly take 1-5 minutes). Generations survive app restarts.` +
      (note ? ` ${note}` : ''),
    data: { generationIds: ids, status: 'processing', ...extra },
  }
}

// ── Workspace + identity ────────────────────────────────────────

export const getWorkspaceState: Operation<{ projectId?: string }> = {
  id: 'slates_get_workspace_state',
  description:
    'Snapshot of the user\'s Slates workspace: projects list, optional active project detail. Call once at the start of a workflow to seed your understanding.',
  input: z.object({ projectId: z.string().optional() }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    const { projects } = await desktop.get<{ projects: unknown[] }>('/agent/projects')
    let activeProject: unknown = undefined
    if (input.projectId) {
      const r = await desktop.get<{ project: unknown }>('/agent/projects/get', { id: input.projectId })
      activeProject = r.project
    }
    return ok({ projects, activeProject })
  },
}

export const getMe: Operation<Record<string, never>> = {
  id: 'slates_get_me',
  description: 'Identity, license tier, and credit balance for the connected Slates account.',
  input: z.object({}).strict(),
  async run(_input, ctx) {
    const me = await ctx.cloud().get<SlatesUserInfo>('/api/agent/me')
    return ok(me)
  },
}

export const getCreditBalance: Operation<Record<string, never>> = {
  id: 'slates_get_credit_balance',
  description: 'Current Slates credit balance (abstract credits — never expire). Call before any generation that costs credits.',
  input: z.object({}).strict(),
  async run(_input, ctx) {
    const r = await ctx.cloud().get<CreditsBalance>('/api/agent/credits/balance')
    const credits = r.credit_balance ?? r.credit_balance_cents ?? 0
    return ok({ success: r.success, credit_balance: credits }, `Balance: ${fmtCredits(credits)}.`)
  },
}

export const listAvailableModels: Operation<{ filter?: string }> = {
  id: 'slates_list_available_models',
  description: 'Registry of generation model cost keys with per-call credit cost, as a compact "key credits" table. Optional `filter` substring (e.g. "kling" or "nano-banana") keeps the result small — prefer it. For a single known model, slates_estimate_generation_cost is cheaper still.',
  input: z.object({
    filter: z.string().optional().describe('Substring match on the model key, e.g. "kling-v3" or "seedance"'),
  }),
  async run(input, ctx) {
    const r = await ctx.cloud().get<ModelRegistryResponse>('/api/agent/models')
    let models = r.models
    if (input.filter) {
      const q = input.filter.toLowerCase()
      models = models.filter((m) => m.model.toLowerCase().includes(q))
    }
    // Compact text table — "key credits" lines are ~5x denser than the raw
    // JSON registry (the full pretty-printed dump was an ~8k-token leak).
    const table = models.map((m) => `${m.model} ${creditCost(m)}`).join('\n')
    return {
      text:
        `${models.length} COST keys (credits per generation)${input.filter ? ` matching "${input.filter}"` : ''}. ` +
        `NOTE: these are billing keys for cost lookup ONLY — the \`model\` param on slates_generate_video takes a BASE id ` +
        `(kling-v3.0-std | kling-v3.0-pro | kling-v3.0-omni | seedance-2 | veo-3.1-fast | veo-3.1-standard) with duration/videoResolution as separate params:\n` +
        table,
      data: { count: models.length },
    }
  },
}

export const estimateGenerationCost: Operation<{
  model: string
  quantity?: number
  duration?: number
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  resolution?: '1k' | '2k' | '3k' | '4k'
  quality?: 'medium' | 'high'
  sound?: boolean
  seedanceFace?: boolean
  seedanceRealFace?: boolean
}> = {
  id: 'slates_estimate_generation_cost',
  description:
    'Pre-flight cost estimate. Call before any generate_* op so the user sees "this will cost N credits" up front. Takes the SAME base model ids as the generate ops (video: "seedance-2" + duration + videoResolution; image: "nano-banana-2" + resolution) — exact registry cost keys also work. Pairs with the confirm gate.',
  input: z.object({
    model: z.string().describe('Base model id as passed to the generate op (e.g. "seedance-2", "kling-v3.0-std", "nano-banana-2") or an exact registry cost key ("nano-banana-2-2k", "seedance-2-1080p-8s")'),
    quantity: z.number().int().min(1).max(10).optional().describe('Number of generations (default 1)'),
    duration: z.number().int().min(3).max(15).optional().describe('Video only — seconds. Cost scales linearly; required with a video base id.'),
    videoResolution: z.enum(['480p', '720p', '1080p', '4k']).optional().describe('Video only. Seedance defaults to 1080p.'),
    resolution: z.enum(['1k', '2k', '3k', '4k']).optional().describe('Image only (default 2k; 3k = gpt-image-2 1440p class).'),
    quality: z.enum(['medium', 'high']).optional().describe('gpt-image-2 only — quality tier (default medium).'),
    sound: z.boolean().optional().describe('Veo only — audio flag changes the cost key.'),
    seedanceFace: z.boolean().optional().describe('Seedance AI-face route (pricier key).'),
    seedanceRealFace: z.boolean().optional().describe('Seedance consented real-face route (premium key).'),
  }),
  async run(input, ctx) {
    const registry = await ctx.cloud().get<ModelRegistryResponse>('/api/agent/models')
    const byKey = new Map(registry.models.map((m) => [m.model, creditCost(m)]))

    // 1) exact registry cost key
    let key: string | null = byKey.has(input.model) ? input.model : null
    // 2) image base id + resolution (+ quality for gpt-image-2)
    if (!key) {
      const img = (['nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro', 'gpt-image-2', 'flux-2-max', 'seedream-5-lite'] as const).find(
        (m) => m === input.model
      )
      if (img) key = imageCostKey(img, input.resolution ?? (img === 'nano-banana-2-lite' ? '1k' : '2k'), input.quality ?? 'medium')
    }
    // 2b) Kling O3 edit base id + duration (ceiled source-clip length)
    if (!key && (input.model === 'kling-v3.0-omni-edit' || input.model === 'kling-v3.0-omni-pro-edit')) {
      if (!input.duration) {
        return ok({
          requires_clarification: true,
          missing: ['duration'],
          message: 'Kling O3 edit bills per second of output (≈ the source clip length, rounded up) — pass duration.',
        })
      }
      key = klingEditCostKey(input.model, input.duration)
    }
    // 3) video base id (or cost-key spelling) → the same forgiving resolver
    //    the generate op uses, so the two can never disagree about a model.
    if (!key) {
      const resolved = resolveVideoModel(input.model)
      if (resolved) {
        const duration = input.duration ?? resolved.duration
        if (!duration) {
          return ok({
            requires_clarification: true,
            missing: ['duration'],
            message: `"${resolved.model}" cost scales with duration — pass duration (seconds) to estimate.`,
          })
        }
        key = videoCostKey({
          model: resolved.model,
          duration,
          videoResolution:
            input.videoResolution ??
            resolved.videoResolution ??
            (resolved.model.startsWith('seedance') ? '1080p' : undefined),
          sound: input.sound ?? resolved.sound,
          seedanceFace: input.seedanceFace ?? resolved.seedanceFace,
          seedanceRealFace: input.seedanceRealFace,
        })
      }
    }

    const perCredits = key != null ? byKey.get(key) : undefined
    if (key == null || perCredits == null) {
      throw new Error(
        `Unknown model: ${input.model}. Pass a base id (${VIDEO_MODELS.join(' | ')} | nano-banana-2 | flux-2-max | seedream-5-lite) plus duration/resolution params, or use slates_list_available_models with a filter.`
      )
    }
    const qty = input.quantity ?? 1
    const totalCredits = perCredits * qty
    return ok({
      model: input.model,
      cost_key: key,
      quantity: qty,
      cost_per_credits: perCredits,
      total_credits: totalCredits,
      requires_confirm: totalCredits > CONFIRM_CREDITS,
    }, `${input.model}${qty > 1 ? ` ×${qty}` : ''}: ${fmtCredits(totalCredits)} (${key}).`)
  },
}

// ── Projects ────────────────────────────────────────────────────

export const listProjects: Operation<Record<string, never>> = {
  id: 'slates_list_projects',
  description: 'List all Slates projects in the desktop workspace.',
  input: z.object({}).strict(),
  async run(_input, ctx) {
    const r = await ctx.desktop().get<{ projects: unknown[] }>('/agent/projects')
    return ok(r)
  },
}

export const createProject: Operation<{ name: string }> = {
  id: 'slates_create_project',
  description: 'Create a new Slates project. Returns the new project record.',
  input: z.object({ name: z.string().min(1).max(120) }),
  async run(input, ctx) {
    const r = await ctx.desktop().post<{ project: unknown }>('/agent/projects', { name: input.name })
    return ok(r)
  },
}

export const getProject: Operation<{ id: string }> = {
  id: 'slates_get_project',
  description: 'Get a Slates project by id.',
  input: z.object({ id: z.string().uuid() }),
  async run(input, ctx) {
    const r = await ctx.desktop().get<{ project: unknown }>('/agent/projects/get', { id: input.id })
    return ok(r)
  },
}

// ── Assets ──────────────────────────────────────────────────────

/** Compact projection of a raw asset row — the full row (prompt, settings,
 * paths, thumbnails) is 20-50x heavier and was the single biggest context
 * leak in early agent sessions (494 assets ≈ 130KB ≈ 33k tokens in ONE
 * tool result). Every op that embeds asset lists uses this. */
function compactAsset(a: unknown): Record<string, unknown> {
  const r = a as Record<string, unknown>
  const prompt = typeof r.prompt === 'string' ? r.prompt : ''
  return {
    id: r.id,
    code: r.code ?? null,
    label: r.label ?? (prompt ? prompt.slice(0, 40) : null),
    type: r.type,
    created_at: r.createdAt ?? r.created_at ?? undefined,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ResolvedAssetRef {
  id: string
  code: string | null
  label: string | null
}

/**
 * Resolve asset references that may be UUIDs OR badge codes ("IMG-A8",
 * "vid-v3", bare "A8"). Codes resolve against the project's asset list AT
 * CALL TIME — never a stale mapping from earlier in a conversation. The
 * user creates assets in the Slates UI mid-chat; an agent that guesses or
 * reuses a nearby UUID for a code it never looked up burns real dollars on
 * the wrong start frame (observed live: "use A8" generated from A5).
 * Unknown codes throw a teaching error; unknown UUIDs pass through for the
 * desktop route to validate.
 */
async function resolveAssetRefs(
  ctx: OperationContext,
  projectId: string,
  refs: string[]
): Promise<Map<string, ResolvedAssetRef>> {
  const out = new Map<string, ResolvedAssetRef>()
  const pending = [...new Set(refs.filter((r) => typeof r === 'string' && r.trim().length > 0))]
  if (pending.length === 0) return out
  const { assets } = await ctx.desktop().get<{ assets: unknown[] }>('/agent/assets', { projectId })
  const rows = (assets ?? []).map(compactAsset)
  const byId = new Map(rows.map((a) => [String(a.id).toLowerCase(), a]))
  const byCode = new Map(
    rows.filter((a) => a.code).map((a) => [String(a.code).toUpperCase(), a])
  )
  for (const ref of pending) {
    const raw = ref.trim()
    if (UUID_RE.test(raw)) {
      const row = byId.get(raw.toLowerCase())
      out.set(ref, {
        id: raw,
        code: row ? ((row.code as string | null) ?? null) : null,
        label: row ? ((row.label as string | null) ?? null) : null,
      })
      continue
    }
    let row = byCode.get(raw.toUpperCase())
    if (!row && /^[AVS]\d+$/i.test(raw)) {
      // Bare "A8" / "V3" / "S1" — expand to the full badge family.
      const norm = raw.toUpperCase()
      const prefixed = norm.startsWith('A') ? `IMG-${norm}` : norm.startsWith('V') ? `VID-${norm}` : `AUD-${norm}`
      row = byCode.get(prefixed)
    }
    if (!row) {
      throw new Error(
        `No asset matching "${ref}" in this project. Codes resolve at call time — ` +
          `call slates_list_assets (search: "${ref}") to see what actually exists, then pass the exact code or id. Never guess.`
      )
    }
    out.set(ref, {
      id: String(row.id),
      code: (row.code as string | null) ?? null,
      label: (row.label as string | null) ?? null,
    })
  }
  return out
}

/** "first frame: IMG-A8 — Untitled" echo lines for generation results. */
function describeResolvedRefs(
  refInputs: Array<{ ref: string; role: string }>,
  resolved: Map<string, ResolvedAssetRef>
): string {
  if (refInputs.length === 0) return ''
  const lines = refInputs.map(({ ref, role }) => {
    const r = resolved.get(ref)
    if (!r) return `${role}: ${ref}`
    const name = r.code ?? r.id
    return `${role}: ${name}${r.label ? ` — ${r.label}` : ''}`
  })
  return `References used: ${lines.join('; ')}.`
}

export const listAssets: Operation<{
  projectId: string
  type?: 'image' | 'video' | 'audio'
  search?: string
  limit?: number
}> = {
  id: 'slates_list_assets',
  description: 'List assets in a Slates project as COMPACT rows (id, code, label, type) — newest first, default limit 50. Each asset carries its short code (IMG-A12 / VID-V3 / AUD-S1 — the badge the user sees on the gallery card) and label. When the user names an asset by code ("use IMG-A36 as the reference"), pass it as `search` to resolve the assetId. Always speak about assets by code + label, never by UUID. NOTE: generate_* results already return the new asset ids — do NOT call this to find an asset you just created.',
  input: z.object({
    projectId: z.string().uuid(),
    type: z.enum(['image', 'video', 'audio']).optional().describe('Only this asset type'),
    search: z.string().optional().describe('Case-insensitive match on code or label (e.g. "IMG-A36" or "sunset")'),
    limit: z.number().int().min(1).max(500).optional().describe('Max rows (default 50, newest first)'),
  }),
  async run(input, ctx) {
    const r = await ctx.desktop().get<{ assets: unknown[] }>('/agent/assets', {
      projectId: input.projectId,
    })
    const all = (r.assets ?? []).map(compactAsset)
    let rows = all
    if (input.type) rows = rows.filter((a) => a.type === input.type)
    if (input.search) {
      const q = input.search.toLowerCase()
      rows = rows.filter(
        (a) =>
          String(a.code ?? '').toLowerCase().includes(q) ||
          String(a.label ?? '').toLowerCase().includes(q)
      )
    }
    // Newest first, then cap. (created_at is ISO — lexicographic sort works.)
    rows = rows
      .slice()
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    const limit = input.limit ?? 50
    const truncated = rows.length > limit
    rows = rows.slice(0, limit)
    return ok({
      total_matching: truncated ? undefined : rows.length,
      total_in_project: all.length,
      truncated,
      assets: rows.map(({ created_at: _drop, ...rest }) => rest),
    })
  },
}

export const getAssetImage: Operation<{ id: string; fullRes?: boolean }> = {
  id: 'slates_get_asset_image',
  description:
    'Read an asset image off disk and return it inline as base64 so the calling LLM sees the actual pixels. The response also carries the asset\'s short code (e.g. IMG-A12) and human label — USE these when referring to the asset in chat with the user (e.g. "I\'m using IMG-A12 — Beach Sunset as the first frame") so they can match it to the badged thumbnail in the Slates gallery. Default JPEG 85% ≤1024px long-edge for token economy. Pass fullRes=true for the original PNG.',
  input: z.object({
    id: z.string().uuid(),
    fullRes: z.boolean().optional(),
  }),
  async run(input, ctx) {
    const r = await ctx.desktop().get<{
      asset_id: string
      code: string | null
      label: string | null
      file_path: string
      data: string
      mimeType: string
      bytes: number
    }>('/agent/assets/image', { id: input.id, fullRes: input.fullRes ?? false })
    const refLabel = r.code ? (r.label ? `${r.code} — ${r.label}` : r.code) : r.asset_id
    return {
      text: `Loaded ${refLabel} (${r.bytes} bytes, ${r.mimeType}). When referring to this asset to the user, use "${refLabel}" — they can find the matching badge in the Slates gallery.`,
      images: [{ data: r.data, mimeType: r.mimeType }],
      data: {
        asset_id: r.asset_id,
        code: r.code,
        label: r.label,
        file_path: r.file_path,
        bytes: r.bytes,
        mimeType: r.mimeType,
      },
    }
  },
}

export const getAssetsBatch: Operation<{ ids: string[] }> = {
  id: 'slates_get_assets_batch',
  description:
    'Fetch up to 8 image-asset thumbnails inline in a single call. Use this when picking the right reference from a project gallery — one round trip beats N. Each returned image carries its short code (IMG-A12) and label so you can speak about candidates in the user\'s shared vocabulary ("between IMG-A12 and IMG-A14, the second has the right composition"). Video assets are not supported here — call slates_get_asset_video_frames for those.',
  input: z.object({
    ids: z.array(z.string().uuid()).min(1).max(8).describe('1-8 image-asset ids. Order is preserved in the response.'),
  }),
  async run(input, ctx) {
    const r = await ctx.desktop().post<{
      images: Array<{
        asset_id: string
        code: string | null
        label: string | null
        file_path: string
        data: string
        mimeType: string
        bytes: number
      }>
      errors: Array<{ asset_id: string; error: string }>
    }>('/agent/assets/batch-images', { ids: input.ids })
    const refs = r.images.map((i) =>
      i.code ? (i.label ? `${i.code} — ${i.label}` : i.code) : i.asset_id
    )
    const errSummary =
      r.errors.length > 0
        ? ` Skipped ${r.errors.length}: ${r.errors.map((e) => `${e.asset_id} (${e.error})`).join('; ')}.`
        : ''
    return {
      text:
        `Loaded ${r.images.length} image(s): ${refs.join(', ')}.` +
        errSummary +
        ` When discussing these with the user, reference them by their codes so they can match each one to a gallery badge.`,
      images: r.images.map((i) => ({ data: i.data, mimeType: i.mimeType })),
      data: {
        images: r.images.map((i) => ({
          asset_id: i.asset_id,
          code: i.code,
          label: i.label,
          file_path: i.file_path,
          bytes: i.bytes,
          mimeType: i.mimeType,
        })),
        errors: r.errors,
      },
    }
  },
}

export const getAssetVideoFrames: Operation<{ id: string; count?: number }> = {
  id: 'slates_get_asset_video_frames',
  description:
    'Extract N evenly-spaced keyframes from a video asset and return them inline as base64 JPEGs. This is the "see the video" path — LLMs can\'t consume video natively, so frames are the next best thing. Default 3 frames (start / middle / end). Bump to 5-8 for longer clips or when motion is the whole story. Use this before writing a motion-transfer prompt, a lip-sync refinement, or any iteration on a video clip. Response carries the asset\'s code (e.g. VID-V3) + label — name them when discussing the clip with the user.',
  input: z.object({
    id: z.string().uuid(),
    count: z.number().int().min(1).max(8).optional().describe('Number of frames to extract. Default 3.'),
  }),
  async run(input, ctx) {
    const params: Record<string, string | number> = { id: input.id }
    if (input.count != null) params.count = input.count
    const r = await ctx.desktop().get<{
      asset_id: string
      code: string | null
      label: string | null
      file_path: string
      duration_seconds: number
      frames: Array<{ data: string; mimeType: string; timestamp_seconds: number; bytes: number }>
    }>('/agent/assets/video-frames', params)
    const refLabel = r.code ? (r.label ? `${r.code} — ${r.label}` : r.code) : r.asset_id
    const timestamps = r.frames.map((f) => `${f.timestamp_seconds}s`).join(', ')
    return {
      text:
        `Extracted ${r.frames.length} frame(s) from ${refLabel} ` +
        `(${r.duration_seconds}s clip) at: ${timestamps}. ` +
        `When referring to this video with the user, call it "${refLabel}".`,
      images: r.frames.map((f) => ({ data: f.data, mimeType: f.mimeType })),
      data: {
        asset_id: r.asset_id,
        code: r.code,
        label: r.label,
        file_path: r.file_path,
        duration_seconds: r.duration_seconds,
        frames: r.frames.map((f) => ({
          timestamp_seconds: f.timestamp_seconds,
          bytes: f.bytes,
          mimeType: f.mimeType,
        })),
      },
    }
  },
}

export const uploadReferenceImage: Operation<{
  projectId: string
  filePath?: string
  dataUrl?: string
  type?: 'image' | 'video'
}> = {
  id: 'slates_upload_reference_image',
  description:
    'Add a reference image OR video clip to a Slates project. Pass either filePath (absolute path to a local file) or dataUrl (base64 data: URL) — exactly one. Set type:"video" on a filePath import to bring in a clip (the user\'s own footage to edit/relocate/trim); imported videos are probed on ingest, so duration + dimensions are available immediately. Default type is "image". dataUrl is image-only.',
  input: z
    .object({
      projectId: z.string().uuid(),
      filePath: z.string().optional(),
      dataUrl: z.string().optional(),
      type: z
        .enum(['image', 'video'])
        .optional()
        .describe('Asset kind for a filePath import — "image" (default) or "video". A dataUrl is always an image.'),
    })
    .refine((d) => !!d.filePath !== !!d.dataUrl, {
      message: 'Pass exactly one of filePath or dataUrl',
    }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    if (input.filePath) {
      const r = await desktop.post<{ asset: unknown }>('/agent/assets/upload', {
        projectId: input.projectId,
        filePath: input.filePath,
        type: input.type ?? 'image',
      })
      return ok(r)
    }
    if (input.type === 'video') {
      throw new Error('dataUrl uploads are image-only — pass a filePath to import a video clip.')
    }
    const r = await desktop.post<{ asset: unknown }>('/agent/assets/upload-base64', {
      projectId: input.projectId,
      dataUrl: input.dataUrl,
    })
    return ok(r)
  },
}

// ── Folders ─────────────────────────────────────────────────────

export const listFolders: Operation<{ projectId: string }> = {
  id: 'slates_list_folders',
  description: 'List asset folders in a project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/folders', { projectId: input.projectId }))
  },
}

export const createFolder: Operation<{ projectId: string; name: string }> = {
  id: 'slates_create_folder',
  description: 'Create a new asset folder in a project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
  }),
  async run(input, ctx) {
    return ok(
      await ctx
        .desktop()
        .post('/agent/folders', { projectId: input.projectId, name: input.name })
    )
  },
}

export const moveAssetsToFolder: Operation<{ assetIds: string[]; folderId: string | null }> = {
  id: 'slates_move_assets_to_folder',
  description: 'Move one or more assets into a folder, or to the project root (folderId=null).',
  input: z.object({
    assetIds: z.array(z.string().uuid()).min(1),
    folderId: z.string().uuid().nullable(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/folders/move-assets', input))
  },
}

// ── Characters ──────────────────────────────────────────────────

export const listCharacters: Operation<{ projectId: string }> = {
  id: 'slates_list_characters',
  description: 'List characters in a Slates project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/characters', { projectId: input.projectId }))
  },
}

export const createCharacter: Operation<{
  projectId: string
  name: string
  description?: string
  style?: string
}> = {
  id: 'slates_create_character',
  description: 'Create a new character in a Slates project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    style: z.string().max(200).optional().describe("Art style. Omit to inherit the reference's style (the default). Canonical styles: photoreal, anime, painterly, 3d-render, comic. Or pass any free-text instruction, e.g. 'turn this into a real person'."),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/characters', input))
  },
}

export const setCharacterIdentity: Operation<{ characterId: string; assetId: string | null }> = {
  id: 'slates_set_character_identity_asset',
  description:
    'Bind one image asset as the character identity (or clear with assetId=null). The user sees the character card update live.',
  input: z.object({
    characterId: z.string().uuid(),
    assetId: z.string().uuid().nullable(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/characters/update', {
        id: input.characterId,
        data: { identityAssetId: input.assetId, expressionAssetId: null },
      })
    )
  },
}

// ── Environments ────────────────────────────────────────────────

export const listEnvironments: Operation<{ projectId: string }> = {
  id: 'slates_list_environments',
  description: 'List environments in a Slates project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/environments', { projectId: input.projectId }))
  },
}

export const createEnvironment: Operation<{
  projectId: string
  name: string
  description?: string
  style?: string
}> = {
  id: 'slates_create_environment',
  description: 'Create a new environment in a Slates project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    style: z.string().max(200).optional().describe("Art style. Omit to inherit the reference's style (the default). Canonical styles: photoreal, anime, painterly, 3d-render, comic. Or pass any free-text instruction, e.g. 'turn this into a real person'."),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/environments', input))
  },
}

export const generateCharacterIdentity: Operation<{
  characterId: string
  projectId: string
  baseAssetId: string
  userNotes?: string
  model?: 'nano-banana-2' | 'nano-banana-2-lite' | 'nano-banana-pro' | 'gpt-image-2'
}> = {
  id: 'slates_generate_character_identity',
  description:
    "Generate one character identity sheet from a base portrait asset and bind it as the character's canonical reference. Call after slates_create_character. Read slates-character-identity before calling and quote the cost from slates_estimate_generation_cost.",
  input: z.object({
    characterId: z.string().uuid(),
    projectId: z.string().uuid(),
    baseAssetId: z.string().uuid().describe('The base portrait asset the identity is generated from.'),
    userNotes: z.string().optional().describe('Extra instruction, e.g. "use the woman on the left".'),
    model: z
      .enum(['nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro', 'gpt-image-2'])
      .optional()
      .describe('Image model for the sheet. Omit for the default (nano-banana-2). Exists so the layout-vs-face tradeoff can be tested with comparison gens — do not switch without a receipt.'),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/characters/generate-identity', {
        characterId: input.characterId,
        projectId: input.projectId,
        baseAssetIds: [input.baseAssetId],
        userNotes: input.userNotes,
        model: input.model,
      })
    )
  },
}

export const generateEnvironmentPlate: Operation<{
  environmentId: string
  projectId: string
  baseAssetId?: string
  userNotes?: string
}> = {
  id: 'slates_generate_environment_plate',
  description:
    "Generate one clean establishing image from an optional base image and bind it as the environment's canonical reference. Call after slates_create_environment and quote the cost from slates_estimate_generation_cost.",
  input: z.object({
    environmentId: z.string().uuid(),
    projectId: z.string().uuid(),
    baseAssetId: z
      .string()
      .uuid()
      .optional()
      .describe('Optional base image to establish from (e.g. a rough location shot).'),
    userNotes: z.string().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/environments/generate-plate', {
        environmentId: input.environmentId,
        projectId: input.projectId,
        baseAssetIds: input.baseAssetId ? [input.baseAssetId] : [],
        userNotes: input.userNotes,
      })
    )
  },
}

// ── Storyboards ─────────────────────────────────────────────────

export const listStoryboards: Operation<{ projectId: string }> = {
  id: 'slates_list_storyboards',
  description: 'List storyboards in a Slates project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/storyboards', { projectId: input.projectId }))
  },
}

export const createStoryboard: Operation<{
  projectId: string
  name: string
  description?: string
}> = {
  id: 'slates_create_storyboard',
  description:
    'Create a new storyboard with a default first scene. Returns the storyboard record.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/storyboards', input))
  },
}

export const getStoryboardWithFrames: Operation<{ storyboardId: string }> = {
  id: 'slates_get_storyboard_with_frames',
  description: 'Deep-fetch a storyboard with all scenes and frames.',
  input: z.object({ storyboardId: z.string().uuid() }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    const [storyboard, scenes] = await Promise.all([
      desktop.get<{ storyboard: unknown }>('/agent/storyboards/get', { id: input.storyboardId }),
      desktop.get<{ scenes: unknown[] }>('/agent/scenes/full', { storyboardId: input.storyboardId }),
    ])
    return ok({ ...storyboard, scenes: scenes.scenes })
  },
}

export const addScene: Operation<{ storyboardId: string; name: string; position?: number }> = {
  id: 'slates_add_scene',
  description: 'Add a new scene to a storyboard.',
  input: z.object({
    storyboardId: z.string().uuid(),
    name: z.string().min(1).max(120),
    position: z.number().int().min(0).optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/scenes', input))
  },
}

export const addFrame: Operation<{
  projectId: string
  storyboardId: string
  sceneId: string
  assetId: string
  shotLabel?: string
  notes?: string
  position?: number
}> = {
  id: 'slates_add_frame',
  description: 'Add a frame (asset reference) to a scene.',
  input: z.object({
    projectId: z.string().uuid(),
    storyboardId: z.string().uuid(),
    sceneId: z.string().uuid(),
    assetId: z.string().uuid(),
    shotLabel: z.string().optional(),
    notes: z.string().optional(),
    position: z.number().int().min(0).optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/frames', input))
  },
}

// ── Reference preview helper ────────────────────────────────────
// When a generation accepts asset ids as references (first/last frame,
// ingredients, source video), the confirm gate inlines those assets so the
// calling LLM literally sees what it's working with before committing
// spend. Images come back as one base64 each; videos come back as N
// evenly-spaced keyframes (default 3). Each preview carries the asset's
// short code + label so the LLM can name them in chat using the same
// vocabulary the user sees on the gallery badge.

interface ReferencePreview {
  // Human-readable reference for chat ("IMG-A12 — Beach Sunset").
  ref: string
  role: string
  images: Array<{ data: string; mimeType: string }>
  meta: {
    asset_id: string
    code: string | null
    label: string | null
    type: 'image' | 'video'
    file_path: string
    frame_count?: number
  }
}

function formatRef(asset: { asset_id: string; code: string | null; label: string | null }): string {
  if (!asset.code) return asset.asset_id
  return asset.label ? `${asset.code} — ${asset.label}` : asset.code
}

// Cheap metadata-only lookup used by the mechanical-op confirm gates
// (motion_transfer, lip_sync). Returns the user-facing reference string
// without pulling any pixels — purely so the agent can announce the
// chosen assets to the user in shared vocabulary.
async function lookupAssetRef(
  desktop: { get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> },
  id: string
): Promise<string> {
  try {
    const r = await desktop.get<{ code: string | null; label: string | null }>('/agent/assets/path', { id })
    return formatRef({ asset_id: id, code: r.code ?? null, label: r.label ?? null })
  } catch {
    return id
  }
}

async function previewAsset(
  ctx: OperationContext,
  id: string,
  type: 'image' | 'video',
  role: string,
  videoFrameCount = 3
): Promise<ReferencePreview> {
  const desktop = ctx.desktop()
  if (type === 'image') {
    const r = await desktop.get<{
      asset_id: string
      code: string | null
      label: string | null
      file_path: string
      data: string
      mimeType: string
      bytes: number
    }>('/agent/assets/image', { id })
    return {
      ref: formatRef(r),
      role,
      images: [{ data: r.data, mimeType: r.mimeType }],
      meta: {
        asset_id: r.asset_id,
        code: r.code,
        label: r.label,
        type: 'image',
        file_path: r.file_path,
      },
    }
  }
  const r = await desktop.get<{
    asset_id: string
    code: string | null
    label: string | null
    file_path: string
    duration_seconds: number
    frames: Array<{ data: string; mimeType: string; timestamp_seconds: number; bytes: number }>
  }>('/agent/assets/video-frames', { id, count: videoFrameCount })
  return {
    ref: formatRef(r),
    role,
    images: r.frames.map((f) => ({ data: f.data, mimeType: f.mimeType })),
    meta: {
      asset_id: r.asset_id,
      code: r.code,
      label: r.label,
      type: 'video',
      file_path: r.file_path,
      frame_count: r.frames.length,
    },
  }
}

async function previewAssets(
  ctx: OperationContext,
  refs: Array<{ id: string; type: 'image' | 'video'; role: string }>
): Promise<ReferencePreview[]> {
  // Sequential — desktop is local, parallel buys nothing and the order
  // matters for the confirm-gate text (first frame, last frame, ingredients...).
  const out: ReferencePreview[] = []
  for (const r of refs) {
    try {
      out.push(await previewAsset(ctx, r.id, r.type, r.role))
    } catch (err) {
      // Best-effort previews — a missing frame shouldn't block the gen,
      // but flag it so the agent sees the gap.
      out.push({
        ref: `[unavailable] ${r.id}`,
        role: r.role,
        images: [],
        meta: {
          asset_id: r.id,
          code: null,
          label: null,
          type: r.type,
          file_path: '',
        },
      })
      void err
    }
  }
  return out
}

// ── Generation (cloud-routed, credits-default) ──────────────────

export type ImageModelId =
  | 'nano-banana-2'
  | 'nano-banana-2-lite'
  | 'nano-banana-pro'
  | 'gpt-image-2'
  | 'flux-2-max'
  | 'seedream-5-lite'

// Registry cost-key for an image model+resolution. Mirrors imageCreditKey()
// in slate/src/shared/pricing.ts — MUST byte-match it (the same hard rule as
// videoCostKey): NB2/NB Pro price per resolution, FLUX.2 Max prices per
// resolution (1k is the bare key), NB2 Lite/Seedream are flat, GPT Image 2 is
// quality × resolution-class (med|high; low deliberately not exposed).
function imageCostKey(
  model: ImageModelId,
  resolution: '1k' | '2k' | '3k' | '4k',
  quality: 'medium' | 'high' = 'medium'
): string {
  if (model === 'flux-2-max') return resolution === '1k' ? 'flux-2-max' : `flux-2-max-${resolution}`
  if (model === 'seedream-5-lite') return 'seedream-5-lite'
  if (model === 'nano-banana-2-lite') return 'nano-banana-2-lite'
  if (model === 'nano-banana-pro') return `nano-banana-pro-${resolution}`
  if (model === 'gpt-image-2') return `gpt-image-2-${quality === 'high' ? 'high' : 'med'}-${resolution}`
  return `nano-banana-2-${resolution}`
}

export const generateImage: Operation<{
  prompt: string
  model?: ImageModelId
  projectId?: string
  resolution?: '1k' | '2k' | '3k' | '4k'
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '4:5' | '5:4' | '2:3' | '3:2'
  quality?: 'medium' | 'high'
  count?: number
  referenceImageUrls?: string[]
  referenceAssetIds?: string[]
  background?: boolean
  confirm?: boolean
}> = {
  id: 'slates_generate_image',
  description:
    'Generate an image via Slates credits. Models: nano-banana-2 (default), nano-banana-2-lite (fast/cheap drafts, 1K only), nano-banana-pro (hero-frame/typography premium), gpt-image-2 (sharp text / character sheets / grids; quality medium|high), flux-2-max (photoreal, less censored), seedream-5-lite (cheapest flat, less censored). Which model for which job: read the slates-model-selection skill. Pass projectId to save into a Slates project (recommended — asset appears live in the desktop UI). All models except nano-banana-2 REQUIRE projectId (no headless path). REQUIRED before calling: read the slates-cost-discipline skill (and the model\'s slates-prompting-* skill). You MUST pass aspectRatio and resolution explicitly (the server returns requires_clarification when missing — defaults waste credits). Cost > $0.50 returns requires_confirm — pass confirm=true after explicit user OK. MCP/CLI generation always charges credits. No skill files installed? Call slates_get_prompting_guide with the model\'s topic (and \'slates-cost-discipline\') before first use.',
  input: z.object({
    prompt: z.string().min(1).max(4000),
    model: z.enum(['nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro', 'gpt-image-2', 'flux-2-max', 'seedream-5-lite']).optional().describe('Image model. Default nano-banana-2. Routing doctrine: slates-model-selection skill. All except nano-banana-2 require projectId.'),
    projectId: z.string().uuid().optional().describe('Save into this Slates project. Renderer refreshes live. Required for every model except nano-banana-2.'),
    resolution: z.enum(['1k', '2k', '3k', '4k']).optional().describe('Pick deliberately: 1k drafts, 2k hero shots, 4k print/final. nano-banana-2-lite is 1k-only. gpt-image-2 classes: 1k=1024², 2k=1080p, 3k=1440p, 4k=2160p (3k is gpt-image-2 only). Never default this.'),
    quality: z.enum(['medium', 'high']).optional().describe('gpt-image-2 only. medium (default) = sharp text, fast, the value seat; high = max text precision + reasoning at ~4× the price. Ignored by other models.'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '4:5', '5:4', '2:3', '3:2']).optional().describe('Pick deliberately from the use case. Cinematic → 16:9. TikTok/Reels/Story → 9:16. IG square → 1:1. Ultra-wide → 21:9. Ask the user when ambiguous.'),
    count: z.number().int().min(1).max(4).optional(),
    referenceImageUrls: z.array(z.string().url()).max(14).optional().describe('Headless (no-projectId) nano-banana-2 only: up to 14 ref URLs. For projectId runs, upload refs with slates_upload_reference_image first. Always label each image\'s role in the prompt text.'),
    referenceAssetIds: z.array(z.string()).max(14).optional().describe("Project assets to use as reference/ingredient images — asset UUIDs or badge codes (\"IMG-A8\"); codes resolve against the project at call time. Requires projectId. For nano-banana-2 up to 14 refs; FLUX/Seedream route to their edit endpoints with lower per-model caps. Label each reference's role in the prompt text."),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
    confirm: z.boolean().optional().describe('Set true to bypass the confirm gate.'),
  }),
  async run(input, ctx) {
    // Clarification gate: aspectRatio + resolution must be deliberate.
    // Mirrors the cost confirm gate — defaults silently wasted credits
    // (1:1 when user wanted 16:9, 4k when 1k would have done). The LLM
    // is forced to ask the user or read the skill instead of guessing.
    if (!input.aspectRatio || !input.resolution) {
      const missing: string[] = []
      if (!input.aspectRatio) missing.push('aspectRatio')
      if (!input.resolution) missing.push('resolution')
      return ok({
        requires_clarification: true,
        missing,
        message:
          `Missing required field(s): ${missing.join(', ')}. ` +
          `Read the slates-prompting-nano-banana-2 + slates-cost-discipline skills, ` +
          `or ask the user. Aspect ratio options: 1:1 16:9 9:16 4:3 3:4 21:9 9:21 4:5 5:4 2:3 3:2. ` +
          `Resolution options: 1k 2k 4k (same price band — pick by need, not cost).`,
      })
    }
    const resolution = input.resolution
    const imageModel = input.model ?? 'nano-banana-2'
    // The '3k' class exists only on gpt-image-2 (2560×1440); other models
    // would mis-key the registry lookup.
    if (resolution === '3k' && imageModel !== 'gpt-image-2') {
      return ok({
        requires_clarification: true,
        missing: ['resolution'],
        message: `3k (1440p) is a gpt-image-2 resolution class — pick 1k/2k/4k for ${imageModel}.`,
      })
    }
    // Only nano-banana-2 has a headless path — everything else routes through
    // the desktop generation pipeline, which needs a project.
    if (imageModel !== 'nano-banana-2' && !input.projectId) {
      return ok({
        requires_clarification: true,
        missing: ['projectId'],
        message: `${imageModel} requires projectId (no headless path). Use slates_list_projects / slates_create_project, then re-call with projectId.`,
      })
    }
    // referenceAssetIds are PROJECT assets — the desktop resolves them off
    // disk, so a headless run has nowhere to look them up. Same for
    // background mode: the poller (slates_get_generation_status) reads the
    // desktop's generation records.
    let referenceAssetIds = input.referenceAssetIds ?? []
    if (referenceAssetIds.length > 0 && !input.projectId) {
      return ok({
        requires_clarification: true,
        missing: ['projectId'],
        message:
          'referenceAssetIds are project assets resolved on the desktop — pass the projectId they live in (slates_list_projects to find it).',
      })
    }
    if (input.background && !input.projectId) {
      return ok({
        requires_clarification: true,
        missing: ['projectId'],
        message:
          'background=true routes through the desktop generation pipeline (so slates_get_generation_status can poll it) — pass a projectId, or drop background for a blocking headless run.',
      })
    }
    let refEcho = ''
    if (referenceAssetIds.length > 0) {
      await ctx.desktop().requireCapability('image-references', 'reference images on image generation')
      // UUIDs or badge codes — resolved against the project at call time
      // (stale-code guessing is a real, observed failure mode).
      const resolved = await resolveAssetRefs(ctx, input.projectId as string, referenceAssetIds)
      const refInputs = referenceAssetIds.map((ref) => ({ ref, role: 'reference' }))
      referenceAssetIds = referenceAssetIds.map((ref) => resolved.get(ref)?.id ?? ref)
      refEcho = describeResolvedRefs(refInputs, resolved)
    }
    if (input.background) {
      await ctx.desktop().requireCapability('background-generation', 'background generation')
    }
    // New-roster models need a desktop that knows them — an older desktop's
    // allowlist would silently fall back to nano-banana-2 while we quote the
    // new model's price.
    if (
      input.projectId &&
      (imageModel === 'gpt-image-2' || imageModel === 'nano-banana-pro' || imageModel === 'nano-banana-2-lite')
    ) {
      await ctx.desktop().requireCapability('image-models-v2', `${imageModel} generation`)
    }
    const costKey = imageCostKey(imageModel, resolution, input.quality ?? 'medium')
    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) throw new Error(`Model not in registry: ${costKey}`)
    const totalCents = creditCost(entry) * (input.count ?? 1)
    // Confirm gate. Fires on cost > $0.50, AND (look-first, mirroring
    // slates_generate_video) whenever reference assets are involved
    // regardless of cost — the LLM must see what it's referencing before
    // committing spend.
    if ((totalCents > CONFIRM_CREDITS || referenceAssetIds.length > 0) && !input.confirm) {
      if (referenceAssetIds.length === 0) {
        return ok({
          requires_confirm: true,
          model: costKey,
          estimated_cents: totalCents,
          estimated_credits: totalCents,
          message:
            `Cost exceeds ${CONFIRM_CREDITS} credits. Re-call with confirm=true to proceed, or pick a smaller resolution / count.`,
        })
      }
      const previews = await previewAssets(
        ctx,
        referenceAssetIds.map((id) => ({ id, type: 'image' as const, role: 'reference' }))
      )
      const refLines = previews.map((p) => `  - ${p.role}: ${p.ref}`).join('\n')
      return {
        text:
          `Pre-flight for ${imageModel} (${costKey}): ` +
          `${fmtCredits(totalCents)}.` +
          `\n\nReference images attached above:\n${refLines}\n\n` +
          `Review them against your prompt — every reference's role must be labeled in the prompt text. ` +
          `If the references suggest a different composition / style than the current prompt captures, REVISE the prompt before confirming. ` +
          `When you talk to the user about this gen, refer to each reference by its code (e.g. "${previews[0]?.ref ?? 'IMG-A?'}") — they'll see the matching badge in the Slates gallery.` +
          `\n\nWhen ready, re-call slates_generate_image with confirm=true and the (possibly revised) prompt.`,
        images: previews.flatMap((p) => p.images),
        data: {
          requires_confirm: true,
          model: imageModel,
          variant: costKey,
          estimated_cents: totalCents,
          estimated_credits: totalCents,
          references: previews.map((p) => ({
            role: p.role,
            ref: p.ref,
            asset_id: p.meta.asset_id,
            code: p.meta.code,
            label: p.meta.label,
            type: p.meta.type,
          })),
        },
      }
    }

    // Two paths:
    //   1. projectId given → route through the desktop's normal generation
    //      pipeline. Eric sees the progress card light up, the asset save
    //      lands in the project, the gallery refreshes, and every
    //      renderer-side hook fires identically to a UI-triggered run.
    //   2. no projectId → run headless via the cloud proxy and return
    //      bytes inline only (useful for headless agents that don't have
    //      a desktop attached).
    if (input.projectId) {
      const desktop = ctx.desktop()
      const result = await desktop.post<{
        success: boolean
        background?: boolean
        asset?: Record<string, unknown>
        assets?: Array<Record<string, unknown>>
        generationId?: string
        generationIds?: string[]
        error?: string
      }>('/agent/generation/image', {
        projectId: input.projectId,
        prompt: input.prompt,
        model: imageModel,
        resolution,
        aspectRatio: input.aspectRatio ?? '1:1',
        count: input.count ?? 1,
        ...(imageModel === 'gpt-image-2' ? { gptQuality: input.quality ?? 'medium' } : {}),
        ...(referenceAssetIds.length > 0 ? { referenceAssetIds } : {}),
        background: input.background,
      })
      // Partial multi-image failure: the desktop attaches an error message
      // but result.assets still holds the images that DID save. Throwing
      // here would discard real, paid-for assets and invite a full retry
      // that double-spends — surface what landed instead.
      const partialFailure =
        !result.success && Array.isArray(result.assets) && result.assets.length > 0
      if (!result.success && !partialFailure) {
        throw new Error(result.error ?? 'Generation failed')
      }
      if (result.background) {
        const ids = result.generationIds ?? (result.generationId ? [result.generationId] : [])
        return backgroundSubmitted(
          `${imageModel} image generation`,
          ids,
          {
            model: imageModel,
            costKey,
            projectId: input.projectId,
            cost_cents: totalCents,
            cost_credits: totalCents,
          },
          refEcho
        )
      }
      const assetList: Array<Record<string, unknown>> = result.assets
        ?? (result.asset ? [result.asset] : [])
      const images: Array<{ data: string; mimeType: string }> = []
      for (const asset of assetList) {
        const id = (asset as { id?: string }).id
        if (!id) continue
        try {
          const img = await desktop.get<{
            data: string
            mimeType: string
            bytes: number
          }>('/agent/assets/image', { id })
          images.push({ data: img.data, mimeType: img.mimeType })
        } catch {
          // Vision payload is best-effort; skip if the disk read fails.
        }
      }
      const requestedCount = input.count ?? 1
      return {
        text: partialFailure
          ? `Partial result: ${assetList.length} of ${requestedCount} image(s) saved into project ${input.projectId} ` +
            `(error on the rest: ${result.error ?? 'unknown error'}). ` +
            `The saved assets are in data.assets — re-generate only the missing count, don't redo the whole batch. ` +
            `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`
          : `Generated ${assetList.length} image(s) into project ${input.projectId} ` +
            `for ${fmtCredits(totalCents)}. ` +
            `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"` +
            (refEcho ? ` ${refEcho}` : ''),
        images,
        data: {
          model: imageModel,
          costKey,
          projectId: input.projectId,
          aspectRatio: input.aspectRatio,
          resolution,
          cost_cents: totalCents,
          cost_credits: totalCents,
          // Compact refs only — the full rows (prompt/settings/paths) were a
          // multi-KB leak per generation and everything needed downstream is
          // the id/code/label.
          assets: assetList.map(compactAsset),
          generationIds: result.generationIds ?? (result.generationId ? [result.generationId] : []),
          ...(partialFailure
            ? { partial: true, error: result.error ?? 'unknown error', requested_count: requestedCount }
            : {}),
        },
      }
    }

    // /proxy/generate kicks off a credit-aware job and returns a jobId
    // for fal/Veo (async providers). We poll /proxy/jobs/{jobId} until
    // the status is `completed` or `failed`, then fetch each image URL
    // and inline as base64 so the calling LLM sees the pixels.
    // The fal endpoint differs by mode: bare model id for text-to-image,
    // `/edit` when reference image URLs are provided. Sending text-to-image
    // to `/edit` 422s on the missing `image_urls` field.
    const hasReferenceImages =
      !!input.referenceImageUrls && input.referenceImageUrls.length > 0
    const endpoint = hasReferenceImages
      ? 'fal-ai/nano-banana-2/edit'
      : 'fal-ai/nano-banana-2'
    const proxyResult = await cloud.post<{
      success: boolean
      data?: { images?: Array<{ url?: string }> }
      jobId?: string
      error?: string
    }>('/proxy/generate', {
      provider: 'fal',
      type: 'image',
      model: costKey,
      endpoint,
      params: {
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio ?? '1:1',
        num_images: input.count ?? 1,
        ...(hasReferenceImages
          ? { image_urls: input.referenceImageUrls }
          : {}),
      },
    })
    if (!proxyResult.success) {
      throw new Error(proxyResult.error ?? 'Generation failed')
    }

    let imagesPayload: Array<{ url?: string }> | undefined =
      proxyResult.data?.images
    if (!imagesPayload && proxyResult.jobId) {
      const completed = await pollProxyJob(cloud, proxyResult.jobId)
      imagesPayload = completed.images
    }

    const urls = (imagesPayload ?? [])
      .map((i) => i.url)
      .filter((u): u is string => !!u)
    if (urls.length === 0) {
      throw new Error('Generation completed but returned no image URLs.')
    }
    const images: Array<{ data: string; mimeType: string }> = []
    for (const url of urls) {
      const r = await fetch(url)
      const buf = Buffer.from(await r.arrayBuffer())
      const mt = r.headers.get('content-type') || 'image/png'
      images.push({ data: buf.toString('base64'), mimeType: mt })
    }
    return {
      text:
        `Generated ${urls.length} image(s) for ${fmtCredits(totalCents)}. ` +
        `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
      images,
      data: {
        urls,
        model: imageModel,
        costKey,
        aspectRatio: input.aspectRatio,
        resolution,
        cost_cents: totalCents,
        cost_credits: totalCents,
      },
    }
  },
}

interface ProxyJobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  data?: { images?: Array<{ url?: string }> }
  error?: string
}

async function pollProxyJob(
  cloud: { get<T>(path: string): Promise<T> },
  jobId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<{ images?: Array<{ url?: string }> }> {
  const intervalMs = options.intervalMs ?? 3000
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs))
    let status: ProxyJobStatus
    try {
      status = await cloud.get<ProxyJobStatus>(`/proxy/jobs/${jobId}`)
    } catch {
      continue
    }
    if (status.status === 'completed') return status.data ?? {}
    if (status.status === 'failed') {
      throw new Error(status.error ?? 'Generation failed')
    }
  }
  throw new Error(`Generation timed out after ${Math.round(timeoutMs / 1000)}s.`)
}

// ── Edit image ──────────────────────────────────────────────────

export const editImage: Operation<{
  projectId: string
  sourceAssetId: string
  prompt: string
  editModel?: 'nano-banana-2' | 'nano-banana-2-lite' | 'nano-banana-pro' | 'gpt-image-2' | 'flux-2-max' | 'seedream-5-lite'
  referenceAssetIds?: string[]
  resolution?: '1k' | '2k' | '3k' | '4k'
  quality?: 'medium' | 'high'
  aspectRatio?: string
  confirm?: boolean
  background?: boolean
}> = {
  id: 'slates_edit_image',
  description:
    'Surgically edit an existing image asset with a text instruction (e.g. \'remove the lamppost\', \'make the jacket red\') instead of regenerating from scratch — use when ~90% of the image is already right. The edited result is saved as a NEW asset in the project (prompt prefixed \'[Edit]\'); the source is untouched. Default model nano-banana-2 (only model that also accepts referenceAssetIds); flux-2-max / seedream-5-lite use their own edit endpoints and ignore references. Before first use call slates_get_prompting_guide with topic \'slates-edit-and-iterate\'.',
  input: z.object({
    projectId: z.string().uuid(),
    sourceAssetId: z.string().uuid().describe('Image asset to edit. Must already exist in the project.'),
    prompt: z.string().min(1).max(4000).describe('The edit instruction — describe the change, not the whole image.'),
    editModel: z.enum(['nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro', 'gpt-image-2', 'flux-2-max', 'seedream-5-lite']).optional(),
    referenceAssetIds: z.array(z.string().uuid()).max(13).optional().describe('Nano-Banana family only: extra reference images (NB Pro takes up to 13, NB2 Lite up to 3).'),
    resolution: z.enum(['1k', '2k', '3k', '4k']).optional().describe('3k (1440p class) is gpt-image-2 only; nano-banana-2-lite is 1k only.'),
    quality: z.enum(['medium', 'high']).optional().describe('gpt-image-2 only — quality tier (default medium).'),
    aspectRatio: z.string().optional(),
    confirm: z.boolean().optional().describe('Set true to bypass the confirm gate.'),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('edit-image', 'image editing')
    if (input.background) {
      await desktop.requireCapability('background-generation', 'background generation')
    }
    const editModel = input.editModel ?? 'nano-banana-2'
    const resolution = input.resolution ?? (editModel === 'nano-banana-2-lite' ? '1k' : '2k')
    if (
      (editModel === 'gpt-image-2' || editModel === 'nano-banana-pro' || editModel === 'nano-banana-2-lite')
    ) {
      await desktop.requireCapability('image-models-v2', `${editModel} editing`)
    }
    // Nano-Banana family + GPT Image 2 edits charge the same key as gen;
    // FLUX / Seedream route to dedicated edit endpoints priced under '-edit' keys.
    const costKey =
      editModel === 'flux-2-max' || editModel === 'seedream-5-lite'
        ? `${imageCostKey(editModel, resolution)}-edit`
        : imageCostKey(editModel, resolution, input.quality ?? 'medium')
    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) throw new Error(`Model not in registry: ${costKey}`)
    const totalCents = creditCost(entry)

    if (totalCents > CONFIRM_CREDITS && !input.confirm) {
      const sourceRef = await lookupAssetRef(desktop, input.sourceAssetId)
      return ok({
        requires_confirm: true,
        variant: costKey,
        estimated_cents: totalCents,
        estimated_credits: totalCents,
        source_ref: sourceRef,
        message:
          `Cost: ${fmtCredits(totalCents)} to edit ${sourceRef} with ${editModel} (${costKey}). ` +
          `Re-call with confirm=true after the user explicitly OKs the spend. ` +
          `When discussing with the user, refer to the source by its code (matches the gallery badge).`,
      })
    }

    const result = await desktop.post<{
      success: boolean
      background?: boolean
      asset?: Record<string, unknown>
      generationId?: string
      generationIds?: string[]
      error?: string
    }>('/agent/generation/edit-image', {
      projectId: input.projectId,
      sourceAssetId: input.sourceAssetId,
      prompt: input.prompt,
      editModel,
      referenceAssetIds: input.referenceAssetIds,
      resolution,
      ...(editModel === 'gpt-image-2' ? { gptQuality: input.quality ?? 'medium' } : {}),
      aspectRatio: input.aspectRatio,
      background: input.background,
    })
    if (!result.success) throw new Error(result.error ?? 'Image edit failed')
    if (result.background) {
      const ids = result.generationIds ?? (result.generationId ? [result.generationId] : [])
      return backgroundSubmitted(`${editModel} image edit`, ids, {
        editModel,
        variant: costKey,
        projectId: input.projectId,
        sourceAssetId: input.sourceAssetId,
        cost_cents: totalCents,
        cost_credits: totalCents,
      })
    }

    // Inline the edited result so the LLM sees whether the surgery landed —
    // same best-effort pattern as slates_generate_image.
    const images: Array<{ data: string; mimeType: string }> = []
    const newAssetId = (result.asset as { id?: string } | undefined)?.id
    if (newAssetId) {
      try {
        const img = await desktop.get<{ data: string; mimeType: string; bytes: number }>(
          '/agent/assets/image',
          { id: newAssetId }
        )
        images.push({ data: img.data, mimeType: img.mimeType })
      } catch {
        // Vision payload is best-effort; skip if the disk read fails.
      }
    }
    return {
      text:
        `Edited image saved as a new asset in project ${input.projectId} ` +
        `for ${fmtCredits(totalCents)} via ${editModel}. ` +
        `Edit: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
      images,
      data: {
        editModel,
        variant: costKey,
        projectId: input.projectId,
        sourceAssetId: input.sourceAssetId,
        resolution,
        cost_cents: totalCents,
        cost_credits: totalCents,
        asset: result.asset,
        generationId: result.generationId,
      },
    }
  },
}

// ── Generate video ──────────────────────────────────────────────

// Exported: the exact `model` ids slates_generate_video accepts — consumed
// by the desktop Studio Agent system prompt (SSOT; never restate these ids
// in prose that can drift).
export const VIDEO_MODELS = [
  'kling-v3.0-std',
  'kling-v3.0-pro',
  'kling-v3.0-omni',
  'veo-3.1-fast',
  'veo-3.1-standard',
  'seedance-2',
  'omni-flash',
] as const

type VideoModel = (typeof VIDEO_MODELS)[number]

// Model → registry cost-key. Each provider's keys ship with their own
// shape (verified against /api/agent/models):
//   Kling: kling-v3-{standard|pro|omni}-{N}s — note the user-facing
//     model id `kling-v3.0-std` maps to registry key `kling-v3-standard`.
//   Veo:   veo-3.1-{fast|standard}[-4k]-{N}s[-audio]
//   Seedance: seedance-2-{res}-{N}s (BytePlus ModelArk, sole provider). The
//     cost key encodes resolution (480p/720p/1080p/4k) — price scales with
//     resolution, so the key MUST carry it or the pre-flight quote is wrong.
const KLING_TIER_MAP: Record<string, string> = {
  'kling-v3.0-std': 'kling-v3-standard',
  'kling-v3.0-pro': 'kling-v3-pro',
  'kling-v3.0-omni': 'kling-v3-omni',
  // Missing until 2026-07-05 — the fallthrough quoted a nonexistent
  // 'kling-v3.0-omni-pro-…' key for O3 Pro (caught by the consistency check
  // the day omni-pro was added to its coverage).
  'kling-v3.0-omni-pro': 'kling-v3-omni-pro',
}

// Exported for scripts/pricing-consistency-check.mjs (slates-api repo), which
// asserts this builder byte-matches the desktop's klingCreditKey/seedanceCreditKey.
export function videoCostKey(input: {
  model: VideoModel
  duration: number
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  sound?: boolean
  seedanceFace?: boolean
  seedanceRealFace?: boolean
  /** Seedance only: ceiled combined seconds of reference VIDEO inputs (motion
   *  transfer / lip-sync on video / relocate). >0 bills the vref key on TOTAL
   *  (input+output) seconds — the server re-derives this by probing the refs. */
  videoRefSeconds?: number
}): string {
  if (input.model.startsWith('seedance')) {
    // Mirrors seedanceCreditKey() in slate/src/shared/pricing.ts (face × vref ×
    // res × duration). AI-face route bills the `-face-` key (~45% over faceless);
    // consented real-person route bills the premium `-realface-` key (fal partner
    // endpoint). A reference video flips to `-vref-{res}-{T}s`, T = in + out (6..30).
    const res = input.videoResolution ?? '1080p'
    const face = input.seedanceRealFace ? '-realface' : input.seedanceFace ? '-face' : ''
    const vrefSecs = input.videoRefSeconds ?? 0
    if (vrefSecs > 0) {
      // ceil(x - 0.05) matches the server's probe rounding — quote = bill.
      const total = Math.min(30, Math.max(6, Math.ceil(vrefSecs - 0.05) + input.duration))
      return `${input.model}${face}-vref-${res}-${total}s`
    }
    return `${input.model}${face}-${res}-${input.duration}s`
  }
  if (input.model.startsWith('veo')) {
    const is4k = input.videoResolution === '4k'
    const audio = input.sound !== false // default audio on for Veo
    const parts: string[] = [input.model]
    if (is4k) parts.push('4k')
    parts.push(`${input.duration}s`)
    if (audio) parts.push('audio')
    return parts.join('-')
  }
  if (input.model.startsWith('kling-v3.0')) {
    // Mirrors klingCreditKey() in slate/src/shared/pricing.ts. Kling native 4K
    // bills flat-rate keys: std/pro/omni all get a `-4k` tier key, and omni-pro
    // shares kling-v3-omni-4k (the o3/4k endpoint has one flat rate, audio
    // included). At 1080p AUDIO IS A KEY DIMENSION (credits = COGS × markup,
    // locked 2026-07-05): sound → `-audio` variant. Kling sound defaults OFF.
    const tier = KLING_TIER_MAP[input.model] ?? input.model
    if (input.videoResolution === '4k') {
      const tier4k = tier === 'kling-v3-omni-pro' ? 'kling-v3-omni' : tier
      return `${tier4k}-4k-${input.duration}s`
    }
    return `${tier}-${input.duration}s${input.sound === true ? '-audio' : ''}`
  }
  if (input.model === 'omni-flash') {
    // Mirrors omniFlashCreditKey() in slate/src/shared/pricing.ts — flat 720p
    // rate, audio native + included, no resolution/audio key dimension.
    return `omni-flash-${input.duration}s`
  }
  throw new Error(`Unknown video model: ${input.model}`)
}

// Kling O3 video-to-video edit cost key — mirrors klingEditCreditKey() in
// slate/src/shared/pricing.ts (must byte-match; checked by the slates-api
// pricing-consistency script). Duration is the CEILED source-clip length —
// billing is per second of output ≈ source length, always rounded up.
export function klingEditCostKey(
  model: 'kling-v3.0-omni-edit' | 'kling-v3.0-omni-pro-edit',
  duration: number
): string {
  const tier = model === 'kling-v3.0-omni-pro-edit' ? 'kling-v3-omni-pro-edit' : 'kling-v3-omni-edit'
  return `${tier}-${duration}s`
}

// Omni Flash video-edit cost key — mirrors omniFlashCreditKey() in
// slate/src/shared/pricing.ts (must byte-match; checked by the slates-api
// pricing-consistency script). Duration is the CEILED source-clip length.
export function omniFlashEditCostKey(duration: number): string {
  return `omni-flash-edit-${duration}s`
}

/**
 * Forgiving model-id resolver. Agents routinely paste registry COST keys
 * ("kling-v3-standard-8s", "seedance-2-1080p-8s") into the `model` param —
 * an observed 15-turn error-retry spiral in a live session. Instead of
 * rejecting, extract the intent: base model + any duration / resolution /
 * audio the key encodes. Returns null only when nothing matches.
 */
function resolveVideoModel(raw: string): {
  model: VideoModel
  duration?: number
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  sound?: boolean
  seedanceFace?: boolean
} | null {
  let s = raw.trim().toLowerCase()
  const out: ReturnType<typeof resolveVideoModel> = { model: 'kling-v3.0-std' }
  const dur = /-(\d+)s\b/.exec(s)
  if (dur) {
    out!.duration = parseInt(dur[1], 10)
    s = s.replace(/-(\d+)s\b/, '')
  }
  const res = /-(480p|720p|1080p|4k)\b/.exec(s)
  if (res) {
    out!.videoResolution = res[1] as '480p' | '720p' | '1080p' | '4k'
    s = s.replace(/-(480p|720p|1080p|4k)\b/, '')
  }
  if (/-audio\b/.test(s)) {
    out!.sound = true
    s = s.replace(/-audio\b/, '')
  }
  if (/-(realface|face)\b/.test(s)) {
    out!.seedanceFace = true
    s = s.replace(/-(realface|face)\b/, '')
  }
  const direct = (VIDEO_MODELS as readonly string[]).find((m) => m === s)
  if (direct) {
    out!.model = direct as VideoModel
    return out
  }
  const aliases: Record<string, VideoModel> = {
    'kling-v3-standard': 'kling-v3.0-std',
    'kling-v3-std': 'kling-v3.0-std',
    'kling-v3.0-standard': 'kling-v3.0-std',
    'kling-v3': 'kling-v3.0-std',
    'kling-v3-pro': 'kling-v3.0-pro',
    'kling-v3-omni': 'kling-v3.0-omni',
    'kling-v3-omni-pro': 'kling-v3.0-omni',
    'kling-v3.0-omni-pro': 'kling-v3.0-omni',
    'seedance-2.0': 'seedance-2',
    'seedance-2-0': 'seedance-2',
    seedance: 'seedance-2',
    'veo-3.1': 'veo-3.1-fast',
    'veo-3': 'veo-3.1-fast',
    'gemini-omni-flash': 'omni-flash',
    'gemini-omni-flash-preview': 'omni-flash',
    'omni-flash-preview': 'omni-flash',
  }
  if (aliases[s]) {
    out!.model = aliases[s]
    return out
  }
  return null
}

// Maps a video model id to its bundled prompting skill (frontmatter `name:`),
// so guidance text points at a skill that actually exists. Deriving the name
// via model.split('-')[0] produced 'slates-prompting-kling' / '...-veo', which
// match no file — only seedance happened to line up.
function promptingSkillFor(model: string): string {
  if (model.startsWith('kling')) return 'slates-prompting-kling-v3'
  if (model.startsWith('veo')) return 'slates-prompting-veo-3'
  if (model.startsWith('seedance')) return 'slates-prompting-seedance'
  if (model.startsWith('omni-flash')) return 'slates-prompting-omni-flash'
  return 'slates-cost-discipline'
}

export const generateVideo: Operation<{
  prompt: string
  // Accepts base ids AND registry cost-key spellings — normalized by
  // resolveVideoModel() at the top of run() before any use.
  model: string
  projectId?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '4:5' | '5:4' | '2:3' | '3:2'
  duration?: number
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  firstFrameAssetId?: string
  lastFrameAssetId?: string
  ingredientAssetIds?: string[]
  characterAssetIds?: string[]
  environmentAssetIds?: string[]
  styleAssetIds?: string[]
  videoReferenceAssetId?: string
  videoReferenceSeconds?: number
  audioReferenceAssetId?: string
  sound?: boolean
  audioLanguage?: 'EN' | 'ZH' | 'JA' | 'KO' | 'ES'
  generateMusic?: boolean
  seedanceFace?: boolean
  seedanceRealFace?: boolean
  realFaceConsent?: boolean
  negativePrompt?: string
  background?: boolean
  confirm?: boolean
}> = {
  id: 'slates_generate_video',
  description:
    'Generate video via Slates credits. REQUIRED before calling: read slates-model-selection (the routing doctrine), slates-cost-discipline, and the matching per-model prompting skill (slates-prompting-seedance / slates-prompting-kling-v3 / slates-prompting-veo-3) — video models prompt very differently; load them via slates_get_prompting_guide if no skill files are installed. Read slates-content-policy when the scene involves conflict, creatures, crowds, destruction, weapons, or young characters. projectId, aspectRatio, and duration are required (requires_clarification otherwise). Cost > $0.50 returns requires_confirm — pass confirm=true after explicit user OK. Image-to-video via firstFrameAssetId; first+last frames = Veo/Seedance only; ingredients via ingredientAssetIds (Kling Omni / Seedance). Asset params take UUIDs or badge codes ("IMG-A8").',
  input: z.object({
    prompt: z.string().min(1).max(4000),
    model: z.string().describe('One of: kling-v3.0-std | kling-v3.0-pro | kling-v3.0-omni | seedance-2 | veo-3.1-fast | veo-3.1-standard | omni-flash. Pass the BASE id — duration and videoResolution are separate params (registry cost keys like "kling-v3-standard-8s" auto-resolve). Route per the slates-model-selection skill: Kling std = general-purpose DEFAULT, Seedance 2 = premium physics/effects/hero tier, Veo = native-synced-audio niche only (16:9, 4/6/8s) — never the default, omni-flash = cheap 720p tier with audio included (3-10s, 16:9/9:16; t2v, single-start-frame i2v, or up to 7 reference images; no last frame / video / audio refs). All are VIDEO-only. For per-call cost, call slates_estimate_generation_cost — never quote prices from memory.'),
    projectId: z.string().uuid().optional().describe('Save into this Slates project. Strongly recommended — the desktop UI shows a progress card live and the asset appears when complete.'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '4:5', '5:4', '2:3', '3:2']).optional().describe('Veo locks to 16:9 — passing anything else will be ignored or fail. Kling/Seedance support all.'),
    duration: z.number().int().min(3).max(15).optional().describe('Seconds. Kling: 5-15. Veo: 4, 6, or 8 only (4K only at 8s). Seedance: 4-15. Omni Flash: 3-10. Default 5 if omitted but always be explicit (cost scales linearly).'),
    videoResolution: z.enum(['480p', '720p', '1080p', '4k']).optional().describe('Veo + Seedance. Seedance: 480p/720p/1080p/4K (default 1080p; 4K is native, the most expensive). Veo: 720p/1080p same price, 4K more (8s only).'),
    firstFrameAssetId: z.string().optional().describe('Starting frame for image-to-video: asset UUID or badge code ("IMG-A8") — codes resolve against the project at call time, so a code the user just spoke is always safe to pass.'),
    lastFrameAssetId: z.string().optional().describe('Ending frame (UUID or badge code). Veo and Seedance only. Pairs with firstFrameAssetId for guided transitions.'),
    ingredientAssetIds: z.array(z.string()).max(9).optional().describe('Visual reference / ingredient assets (UUIDs or badge codes) for Kling Omni, Seedance, or Omni Flash. Up to 9 (Seedance), 4 (Kling), or 7 (Omni Flash, combined across all ref params).'),
    characterAssetIds: z.array(z.string()).optional().describe('Character sheet assets (UUIDs or badge codes) — keeps a character consistent across the shot.'),
    environmentAssetIds: z.array(z.string()).optional().describe('Environment reference assets (UUIDs or badge codes) — keeps a location/setting consistent across the shot.'),
    styleAssetIds: z.array(z.string()).optional().describe('Style reference assets (UUIDs or badge codes) — locks the visual style of the shot.'),
    videoReferenceAssetId: z.string().optional().describe('Seedance ONLY: an existing VIDEO asset (UUID or badge code) to use as a reference — edit/relocate a clip, or MOTION TRANSFER (pair with a subject in ingredientAssetIds and a prompt like "the character from image 1 performs the motion from video 1"). 2-15s. Billing switches to input+output seconds (the vref key) — pass videoReferenceSeconds so the quote is right. If the clip contains a human/AI character, pair with seedanceFace=true (the default Seedance route blocks people). Ignored by Kling/Veo.'),
    videoReferenceSeconds: z.number().optional().describe('REQUIRED with videoReferenceAssetId: the reference clip\'s duration in seconds (from the asset listing). Feeds the vref cost key — a video-reference gen bills combined input+output seconds; the server re-derives this by probing the clip, so an understated value just gets corrected upward.'),
    audioReferenceAssetId: z.string().optional().describe('Seedance ONLY: an AUDIO asset (UUID or badge code), ≤15s, used as a reference — e.g. lip-sync a character to this audio ("the character in image 1 speaks the dialogue from audio 1"). No billing surcharge (Seedance audio is included). Requires at least one image or video reference alongside.'),
    sound: z.boolean().optional().describe('Kling Omni / Veo / Seedance: enable audio generation. Default true.'),
    audioLanguage: z.enum(['EN', 'ZH', 'JA', 'KO', 'ES']).optional().describe('Kling Omni only — language for dialogue.'),
    generateMusic: z.boolean().optional().describe('Kling Omni only — auto-generate background music.'),
    seedanceFace: z.boolean().optional().describe('Seedance ONLY: set true when a reference/ingredient shows an AI-character\'s FACE. Faces are blocked on the default (cheaper) Seedance route, so this reroutes the gen to a face-capable provider at ~45% more (the cost key becomes seedance-2-face-*). Leave false/unset for faceless or object-only references. No effect on Kling/Veo. A REAL person\'s photo is rejected on this route — the failure message contains [REAL_FACE_DETECTED]; see seedanceRealFace.'),
    seedanceRealFace: z.boolean().optional().describe('Seedance ONLY: the reference shows a REAL person (a photo of an actual human, not an AI character). Routes to the premium real-face provider (cost key seedance-2-realface-*, roughly 2x the AI-face price — quote it via slates_estimate_generation_cost first). REQUIRES realFaceConsent=true. Typical flow: a seedanceFace gen fails with [REAL_FACE_DETECTED] → ask the user to confirm consent + the higher price → retry with seedanceRealFace=true + realFaceConsent=true.'),
    realFaceConsent: z.boolean().optional().describe('MANDATORY with seedanceRealFace: set true ONLY after the user has explicitly confirmed they hold the rights/consent to this person\'s likeness and it doesn\'t impersonate or misrepresent them. The generation is refused without it. Public figures/celebrities fail on every route.'),
    negativePrompt: z.string().optional(),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
    confirm: z.boolean().optional().describe('Set true after explicit user OK to bypass the confirm gate (which fires for almost every video gen since they\'re expensive).'),
  }),
  async run(input, ctx) {
    // Resolve the model FIRST — forgiving normalization (cost keys, alias
    // spellings) with a teaching error, so a wrong id never costs the agent
    // a retry spiral. Anything the key encoded (duration/res/audio) fills
    // params the caller left blank; explicit params always win.
    const resolved = resolveVideoModel(input.model)
    if (!resolved) {
      throw new Error(
        `Unknown video model "${input.model}". Valid model ids: ${VIDEO_MODELS.join(' | ')}. ` +
          `Registry entries like "kling-v3-standard-8s" or "seedance-2-1080p-8s" are COST keys, not model ids — ` +
          `pass the base id and set duration / videoResolution as separate params.`
      )
    }
    input.model = resolved.model
    if (input.duration == null && resolved.duration != null) input.duration = resolved.duration
    if (input.videoResolution == null && resolved.videoResolution != null)
      input.videoResolution = resolved.videoResolution
    if (input.sound == null && resolved.sound != null) input.sound = resolved.sound
    if (input.seedanceFace == null && resolved.seedanceFace != null)
      input.seedanceFace = resolved.seedanceFace
    // projectId is required for video — without it there's no UI feedback,
    // no asset to reference later, and a failed gen leaves the user with
    // nothing. The MCP-only headless path that exists for image gen is
    // not reasonable for video given the cost.
    if (!input.projectId) {
      return ok({
        requires_clarification: true,
        missing: ['projectId'],
        message:
          'projectId is required for video generation. Use slates_list_projects to find one or slates_create_project to make a new one. Video gens cost tens to a few hundred credits per call — they need to land in a project so the user sees the progress card and the result.',
      })
    }
    if (!input.aspectRatio || !input.duration) {
      const missing: string[] = []
      if (!input.aspectRatio) missing.push('aspectRatio')
      if (!input.duration) missing.push('duration')
      return ok({
        requires_clarification: true,
        missing,
        message:
          `Missing required field(s): ${missing.join(', ')}. ` +
          `Read the slates-cost-discipline + ${promptingSkillFor(input.model)} skills, ` +
          `or ask the user. Veo locks to 16:9. Kling/Seedance support 1:1 16:9 9:16 4:3 3:4 21:9. Omni Flash: 16:9/9:16 only. ` +
          `Duration: Kling 5-15s, Veo 4/6/8s (4K only at 8s), Seedance 4-15s, Omni Flash 3-10s. Cost scales linearly with duration.`,
      })
    }

    // Omni Flash: 3-10s, 720p only — t2v, single-start-frame i2v, or ref2v
    // with up to 7 reference IMAGES. No last frame, no video/audio refs.
    // Validate up front so the agent gets an actionable message instead of
    // a registry throw.
    if (input.model === 'omni-flash') {
      if (input.duration < 3 || input.duration > 10) {
        return ok({
          requires_clarification: true,
          missing: ['duration'],
          message: `Omni Flash supports 3-10 seconds (you passed ${input.duration}s). Pick a duration in that range.`,
        })
      }
      if (input.lastFrameAssetId || input.videoReferenceAssetId || input.audioReferenceAssetId) {
        return ok({
          requires_clarification: true,
          missing: [],
          message:
            'Omni Flash takes a prompt, an optional start frame, and up to 7 reference IMAGES — last frames and video/audio references are not supported. Drop those, or switch to seedance-2 (video/audio refs, last frame) or veo (last frame).',
        })
      }
      const refCount =
        (input.ingredientAssetIds?.length ?? 0) +
        (input.characterAssetIds?.length ?? 0) +
        (input.environmentAssetIds?.length ?? 0) +
        (input.styleAssetIds?.length ?? 0)
      if (refCount > 7) {
        return ok({
          requires_clarification: true,
          missing: [],
          message: `Omni Flash takes at most 7 reference images combined (you passed ${refCount}). Trim the list.`,
        })
      }
    }

    // Veo exists only at discrete durations 4/6/8s, and 4K only at 8s.
    // Validate up front so the agent gets an actionable message instead of
    // a generic "Model variant not in registry" throw from the cost lookup.
    if (input.model.startsWith('veo')) {
      if (![4, 6, 8].includes(input.duration)) {
        return ok({
          requires_clarification: true,
          missing: ['duration'],
          message: `Veo 3.1 supports only 4s, 6s, or 8s (you passed ${input.duration}s). Pick one of those.`,
        })
      }
      if (input.videoResolution === '4k' && input.duration !== 8) {
        return ok({
          requires_clarification: true,
          missing: ['duration'],
          message: `Veo 3.1 4K renders only at 8s (you passed ${input.duration}s at 4k). Use duration=8 for 4K, or drop to 720p/1080p for 4s/6s.`,
        })
      }
    }

    // Resolve every asset reference (UUID or badge code) against the
    // project AT CALL TIME. Codes the user just spoke ("a8 is the one")
    // resolve to whatever exists NOW — including assets created in the UI
    // after the agent's last list call. Unknown codes throw before any
    // spend. The resolved code+label is echoed in every result so a wrong
    // start frame is visible immediately, not after $4 of render.
    const refInputs: Array<{ ref: string; role: string }> = []
    if (input.firstFrameAssetId) refInputs.push({ ref: input.firstFrameAssetId, role: 'first frame' })
    if (input.lastFrameAssetId) refInputs.push({ ref: input.lastFrameAssetId, role: 'last frame' })
    for (const r of input.ingredientAssetIds ?? []) refInputs.push({ ref: r, role: 'ingredient' })
    for (const r of input.characterAssetIds ?? []) refInputs.push({ ref: r, role: 'character' })
    for (const r of input.environmentAssetIds ?? []) refInputs.push({ ref: r, role: 'environment' })
    for (const r of input.styleAssetIds ?? []) refInputs.push({ ref: r, role: 'style' })
    if (input.videoReferenceAssetId) refInputs.push({ ref: input.videoReferenceAssetId, role: 'video reference' })
    if (input.audioReferenceAssetId) refInputs.push({ ref: input.audioReferenceAssetId, role: 'audio reference' })
    const resolvedRefs = await resolveAssetRefs(
      ctx,
      input.projectId,
      refInputs.map((r) => r.ref)
    )
    const rid = (v: string | undefined): string | undefined =>
      v ? (resolvedRefs.get(v)?.id ?? v) : v
    const rids = (a: string[] | undefined): string[] | undefined =>
      a?.map((v) => resolvedRefs.get(v)?.id ?? v)
    input.firstFrameAssetId = rid(input.firstFrameAssetId)
    input.lastFrameAssetId = rid(input.lastFrameAssetId)
    input.videoReferenceAssetId = rid(input.videoReferenceAssetId)
    input.audioReferenceAssetId = rid(input.audioReferenceAssetId)
    input.ingredientAssetIds = rids(input.ingredientAssetIds)
    input.characterAssetIds = rids(input.characterAssetIds)
    input.environmentAssetIds = rids(input.environmentAssetIds)
    input.styleAssetIds = rids(input.styleAssetIds)
    const refEcho = describeResolvedRefs(refInputs, resolvedRefs)

    // A video reference bills combined input+output seconds (the vref key) —
    // the quote needs the clip's length. The server probes the uploaded ref
    // and corrects the key anyway, so this only gates quote accuracy.
    if (input.videoReferenceAssetId && input.model.startsWith('seedance') && !input.videoReferenceSeconds) {
      return ok({
        requires_clarification: true,
        missing: ['videoReferenceSeconds'],
        message:
          'A Seedance video reference bills on combined input+output seconds. Pass videoReferenceSeconds (the reference clip\'s duration, shown in slates_list_assets) so the pre-flight quote matches the bill.',
      })
    }
    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const costKey = videoCostKey({
      model: input.model as VideoModel,
      duration: input.duration,
      videoResolution: input.videoResolution,
      sound: input.sound,
      seedanceFace: input.seedanceFace,
      seedanceRealFace: input.seedanceRealFace,
      videoRefSeconds: input.videoReferenceAssetId ? input.videoReferenceSeconds : 0,
    })
    // Hard consent gate, checked before any spend: the real-face route is
    // consent-attested by design (the desktop enforces it too).
    if (input.seedanceRealFace && !input.realFaceConsent) {
      return ok({
        requires_clarification: true,
        missing: ['realFaceConsent'],
        message:
          'Real-person generation needs consent: confirm with the user that they hold the rights/consent to this likeness, then retry with realFaceConsent=true.',
      })
    }
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) {
      throw new Error(
        `Model variant not in registry: ${costKey}. ` +
          `Available video models: ${registry.models.filter((m) => m.model.startsWith('kling') || m.model.startsWith('veo') || m.model.startsWith('seedance') || m.model.startsWith('omni-flash')).map((m) => m.model).slice(0, 20).join(', ')}`
      )
    }
    const totalCents = creditCost(entry)

    // Pre-flight confirm gate. Fires when:
    //   (a) cost > $0.50 (the cost gate), OR
    //   (b) any reference assets are involved (the look-first gate)
    // When references are present, the response inlines them as image
    // content blocks (and video keyframes for video refs) so the LLM
    // literally sees what it's about to use before committing spend.
    // The text steers the LLM to discuss the refs with the user by their
    // code+label so the conversation maps onto the gallery badges.
    const referenceRefs: Array<{ id: string; type: 'image' | 'video'; role: string }> = []
    if (input.firstFrameAssetId) {
      referenceRefs.push({ id: input.firstFrameAssetId, type: 'image', role: 'first frame' })
    }
    if (input.lastFrameAssetId) {
      referenceRefs.push({ id: input.lastFrameAssetId, type: 'image', role: 'last frame' })
    }
    for (const id of input.ingredientAssetIds ?? []) {
      referenceRefs.push({ id, type: 'image', role: 'ingredient' })
    }
    for (const id of input.characterAssetIds ?? []) {
      referenceRefs.push({ id, type: 'image', role: 'character' })
    }
    for (const id of input.environmentAssetIds ?? []) {
      referenceRefs.push({ id, type: 'image', role: 'environment' })
    }
    for (const id of input.styleAssetIds ?? []) {
      referenceRefs.push({ id, type: 'image', role: 'style' })
    }
    const hasReferences = referenceRefs.length > 0

    if ((totalCents > CONFIRM_CREDITS || hasReferences) && !input.confirm) {
      const previews = hasReferences ? await previewAssets(ctx, referenceRefs) : []
      const refLines = previews.map((p) => `  - ${p.role}: ${p.ref}`).join('\n')
      const refSummary = hasReferences
        ? `\n\nReferences attached above (in order — first frame, last frame, then ingredients):\n${refLines}\n\nReview them against your prompt. If the references suggest a different motion / framing / ` +
          `style than the current prompt captures, REVISE the prompt before confirming. When you talk to the user about this gen, refer to each reference by its code (e.g. "${previews[0]?.ref ?? 'IMG-A?'}") — they'll see the matching badge in the Slates gallery.`
        : ''
      const refImages = previews.flatMap((p) => p.images)
      return {
        text:
          `Pre-flight for ${input.duration}s ${input.model} (${costKey}): ` +
          `${fmtCredits(totalCents)}.` +
          refSummary +
          `\n\nWhen ready, re-call slates_generate_video with confirm=true and the (possibly revised) prompt.`,
        images: refImages,
        data: {
          requires_confirm: true,
          model: input.model,
          variant: costKey,
          estimated_cents: totalCents,
          estimated_credits: totalCents,
          references: previews.map((p) => ({
            role: p.role,
            ref: p.ref,
            asset_id: p.meta.asset_id,
            code: p.meta.code,
            label: p.meta.label,
            type: p.meta.type,
            frame_count: p.meta.frame_count,
          })),
        },
      }
    }

    const desktop = ctx.desktop()
    if (input.background) {
      await desktop.requireCapability('background-generation', 'background generation')
    }
    const result = await desktop.post<{
      success: boolean
      background?: boolean
      asset?: Record<string, unknown>
      generationId?: string
      generationIds?: string[]
      error?: string
    }>('/agent/generation/video', {
      projectId: input.projectId,
      model: input.model,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      videoResolution: input.videoResolution,
      firstFrameAssetId: input.firstFrameAssetId,
      lastFrameAssetId: input.lastFrameAssetId,
      ingredientAssetIds: input.ingredientAssetIds ?? [],
      characterAssetIds: input.characterAssetIds ?? [],
      environmentAssetIds: input.environmentAssetIds ?? [],
      styleAssetIds: input.styleAssetIds ?? [],
      videoReferenceAssetId: input.videoReferenceAssetId,
      audioReferenceAssetId: input.audioReferenceAssetId,
      sound: input.sound,
      audioLanguage: input.audioLanguage,
      generateMusic: input.generateMusic,
      seedanceFace: input.seedanceFace,
      seedanceRealFace: input.seedanceRealFace,
      realFaceConsent: input.realFaceConsent,
      negativePrompt: input.negativePrompt,
      background: input.background,
    })
    if (!result.success) {
      throw new Error(result.error ?? 'Generation failed')
    }
    if (result.background) {
      const ids = result.generationIds ?? (result.generationId ? [result.generationId] : [])
      return backgroundSubmitted(
        `${input.duration}s ${input.model} video generation`,
        ids,
        {
          model: input.model,
          variant: costKey,
          projectId: input.projectId,
          cost_cents: totalCents,
          cost_credits: totalCents,
          references: refInputs.map(({ ref, role }) => ({
            role,
            ...(resolvedRefs.get(ref) ?? { id: ref, code: null, label: null }),
          })),
        },
        refEcho
      )
    }
    return {
      text:
        `Generated ${input.duration}s ${input.model} video into project ${input.projectId} ` +
        `for ${fmtCredits(totalCents)}. ` +
        `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"` +
        (refEcho ? ` ${refEcho}` : ''),
      data: {
        model: input.model,
        variant: costKey,
        projectId: input.projectId,
        aspectRatio: input.aspectRatio,
        duration: input.duration,
        cost_cents: totalCents,
        cost_credits: totalCents,
        asset: result.asset,
        generationId: result.generationId,
      },
    }
  },
}

// ── Generate lip-sync ───────────────────────────────────────────

export const generateLipSync: Operation<{
  projectId: string
  sourceAssetId: string
  sourceType: 'image' | 'video'
  audioMethod: 'tts' | 'upload'
  ttsText?: string
  ttsVoice?: string
  ttsLanguage?: 'EN' | 'ZH' | 'JA' | 'KO' | 'ES'
  ttsSpeed?: number
  audioFilePath?: string
  avatarModel?: 'avatar-standard' | 'avatar-pro'
  klingProvider?: 'fal' | 'kling'
  engine?: 'kling' | 'seedance-2'
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  aspectRatio?: string
  seedanceFace?: boolean
  seedanceRealFace?: boolean
  realFaceConsent?: boolean
  sourceSeconds?: number
  audioSeconds?: number
  background?: boolean
  confirm?: boolean
}> = {
  id: 'slates_generate_lip_sync',
  description:
    'Lip-sync a still image (avatar) or a video clip to audio. Two engines — route per slates-model-selection: (1) engine=kling (default, cheap utility lane): sourceType=video re-syncs a clip (~$0.11 / 5s); sourceType=image animates a still avatar (avatar-standard ~$0.42 / 5s; avatar-pro ~$0.86 / 5s). Audio from TTS (ttsText + ttsVoice) or an uploaded file. Always 5 seconds. (2) engine=seedance-2 (premium single-pass): the speech is generated IN the video itself — natural delivery, a video source keeps its OWN voice (native voice clone), audio included; ttsText becomes the spoken line (no voice/speed params), or an uploaded ≤15s audio file drives the speech as a reference. Seedance sources must be 2-15s videos or images; bills seedance keys (video sources bill input+output seconds — pass sourceSeconds). Faces route via seedanceFace (default true) / seedanceRealFace+realFaceConsent for real people. REQUIRED before calling: slates-cost-discipline + slates-prompting-lip-sync skills. projectId is REQUIRED.',
  input: z.object({
    projectId: z.string().uuid().describe('Slates project the source asset lives in. The new lip-synced video lands here.'),
    sourceAssetId: z.string().uuid().describe('Asset id of the still image (avatar flow) or video clip (lip-sync flow). Must already exist in the project — use slates_upload_reference_image or slates_generate_image / slates_generate_video first if needed.'),
    sourceType: z.enum(['image', 'video']).describe('"image" = animate a still portrait (avatar). "video" = re-sync an existing talking-head clip. Determines pricing — be deliberate.'),
    audioMethod: z.enum(['tts', 'upload']).describe('"tts" = generate speech from ttsText (on Seedance the line is spoken natively in the generation). "upload" = use the file at audioFilePath (absolute path on the user\'s machine; ≤15s on Seedance).'),
    ttsText: z.string().min(1).max(2000).optional().describe('Required when audioMethod=tts. The exact words the avatar/clip will speak.'),
    ttsVoice: z.string().optional().describe('Kling engine only — voice id (e.g. "oversea_male1"). See slates-prompting-lip-sync skill for the voice catalog. Ignored on Seedance (a video source keeps its own voice; otherwise describe the voice in ttsText context).'),
    ttsLanguage: z.enum(['EN', 'ZH', 'JA', 'KO', 'ES']).optional().describe('Kling engine only — TTS language. Default EN.'),
    ttsSpeed: z.number().min(0.5).max(2).optional().describe('Kling engine only — TTS speech rate. Default 1.0. Range 0.5-2.0.'),
    audioFilePath: z.string().optional().describe('Required when audioMethod=upload. Absolute path to the audio file on the user\'s machine (mp3, wav, m4a).'),
    avatarModel: z.enum(['avatar-standard', 'avatar-pro']).optional().describe('Kling engine, image-source only. avatar-standard (~14 credits/5s) for general use. avatar-pro (~29 credits/5s) for sharper face fidelity.'),
    klingProvider: z.enum(['fal', 'kling']).optional().describe('Kling engine only — provider routing. Leave unset: all agent generations bill Slates credits (BYOK is retired).'),
    engine: z.enum(['kling', 'seedance-2']).optional().describe('Default kling (cheap utility). seedance-2 = premium single-pass: natural speech generated in the video, voice cloned from a video source, audio included. Credits only.'),
    videoResolution: z.enum(['480p', '720p', '1080p', '4k']).optional().describe('Seedance engine only. Default 1080p.'),
    aspectRatio: z.string().optional().describe('Seedance engine only. Default 16:9.'),
    seedanceFace: z.boolean().optional().describe('Seedance engine only — a character\'s face is in the source (default TRUE for lip-sync; the faceless route would reject it). Bills the -face key.'),
    seedanceRealFace: z.boolean().optional().describe('Seedance engine only — the source shows a REAL person. Premium -realface key; REQUIRES realFaceConsent=true.'),
    realFaceConsent: z.boolean().optional().describe('MANDATORY with seedanceRealFace — set true only after the user explicitly confirms they hold rights/consent to the likeness.'),
    sourceSeconds: z.number().optional().describe('Seedance engine + sourceType=video: the source clip\'s duration in seconds (from the asset listing). Feeds the vref cost key (input+output billing).'),
    audioSeconds: z.number().optional().describe('Seedance engine + audioMethod=upload: the audio file\'s duration in seconds — sets the output length (4-15s).'),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
    confirm: z.boolean().optional().describe('Set true to bypass the confirm gate. Required for avatar-pro.'),
  }),
  async run(input, ctx) {
    if (input.audioMethod === 'tts' && !input.ttsText) {
      return ok({
        requires_clarification: true,
        missing: ['ttsText'],
        message: 'audioMethod=tts requires ttsText. Pass the exact words the avatar/clip will speak.',
      })
    }
    if (input.audioMethod === 'upload' && !input.audioFilePath) {
      return ok({
        requires_clarification: true,
        missing: ['audioFilePath'],
        message: 'audioMethod=upload requires audioFilePath. Pass an absolute path to the audio file on the user\'s machine.',
      })
    }

    const isSeedance = input.engine === 'seedance-2'
    let costKey: string
    let seedanceDuration = 0
    if (isSeedance) {
      // Consent gate before any spend, mirroring slates_generate_video.
      if (input.seedanceRealFace && !input.realFaceConsent) {
        return ok({
          requires_clarification: true,
          missing: ['realFaceConsent'],
          message:
            'Real-person lip-sync needs consent: confirm with the user that they hold the rights/consent to this likeness, then retry with realFaceConsent=true.',
        })
      }
      if (input.sourceType === 'video' && !input.sourceSeconds) {
        return ok({
          requires_clarification: true,
          missing: ['sourceSeconds'],
          message:
            'Seedance lip-sync on a video source bills combined input+output seconds. Pass sourceSeconds (the clip\'s duration from slates_list_assets, must be 2-15s).',
        })
      }
      const clamp = (n: number): number => Math.min(15, Math.max(4, Math.ceil(n)))
      seedanceDuration = clamp(
        input.sourceType === 'video' && input.sourceSeconds
          ? input.sourceSeconds
          : input.audioSeconds ?? (input.ttsText ? input.ttsText.length / 13 : 5)
      )
      costKey = videoCostKey({
        model: 'seedance-2',
        duration: seedanceDuration,
        videoResolution: input.videoResolution ?? '1080p',
        // Lip-sync sources are faces by definition — face route unless
        // explicitly disabled or escalated to realface.
        seedanceFace: input.seedanceFace !== false && input.seedanceRealFace !== true,
        seedanceRealFace: input.seedanceRealFace === true,
        videoRefSeconds: input.sourceType === 'video' ? input.sourceSeconds ?? 0 : 0,
      })
    } else if (input.sourceType === 'video') {
      costKey = 'kling-lip-sync-video-5s'
    } else {
      costKey = input.avatarModel === 'avatar-pro'
        ? 'kling-lip-sync-avatar-pro-5s'
        : 'kling-lip-sync-avatar-5s'
    }

    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) throw new Error(`Model variant not in registry: ${costKey}`)
    const totalCents = creditCost(entry)

    // Cost confirm gate. Lip-sync is mechanical — the model re-syncs the
    // user-chosen source to the user-chosen audio. The agent doesn't
    // write a prompt that depends on what the source looks like, so we
    // skip the inline preview and just announce the source code in text.
    if (totalCents > CONFIRM_CREDITS && !input.confirm) {
      const sourceRef = await lookupAssetRef(ctx.desktop(), input.sourceAssetId)
      const audioPreview = input.audioMethod === 'tts'
        ? `Audio: TTS — "${(input.ttsText ?? '').slice(0, 120)}"`
        : `Audio: ${input.audioFilePath}`
      return ok({
        requires_confirm: true,
        variant: costKey,
        estimated_cents: totalCents,
        estimated_credits: totalCents,
        source_ref: sourceRef,
        message:
          `Cost: ${fmtCredits(totalCents)} for ${isSeedance ? `${seedanceDuration}s Seedance` : '5s'} lip-sync (${costKey}). ` +
          `Source: ${sourceRef}. ${audioPreview}. ` +
          `Re-call with confirm=true after the user explicitly OKs the spend. ` +
          `When discussing with the user, refer to the source by its code (matches the gallery badge).`,
      })
    }

    const desktop = ctx.desktop()
    if (input.background) {
      await desktop.requireCapability('background-generation', 'background generation')
    }
    const result = await desktop.post<{
      success: boolean
      background?: boolean
      asset?: Record<string, unknown>
      generationId?: string
      generationIds?: string[]
      error?: string
    }>('/agent/generation/lip-sync', {
      projectId: input.projectId,
      sourceAssetId: input.sourceAssetId,
      audioMethod: input.audioMethod,
      ttsText: input.ttsText,
      ttsVoice: input.ttsVoice,
      ttsLanguage: input.ttsLanguage,
      ttsSpeed: input.ttsSpeed,
      audioFilePath: input.audioFilePath,
      avatarModel: input.avatarModel,
      klingProvider: input.klingProvider,
      estimatedCost: totalCents,
      background: input.background,
      // Seedance engine passthrough — the desktop delegates to the seedance
      // ref-to-video path (vref billing, face cascade, consent gate). The
      // durations ride along so the desktop bills exactly what was quoted.
      ...(isSeedance
        ? {
            lipSyncEngine: 'seedance-2',
            duration: seedanceDuration,
            videoResolution: input.videoResolution,
            aspectRatio: input.aspectRatio,
            seedanceFace: input.seedanceFace !== false && input.seedanceRealFace !== true,
            seedanceRealFace: input.seedanceRealFace === true,
            realFaceConsent: input.realFaceConsent === true,
            sourceDurationSeconds: input.sourceSeconds,
            audioDurationSeconds: input.audioSeconds,
          }
        : {}),
    })
    if (!result.success) throw new Error(result.error ?? 'Lip-sync generation failed')
    if (result.background) {
      const ids = result.generationIds ?? (result.generationId ? [result.generationId] : [])
      return backgroundSubmitted(`${isSeedance ? `${seedanceDuration}s` : '5s'} lip-sync (${costKey})`, ids, {
        variant: costKey,
        projectId: input.projectId,
        sourceAssetId: input.sourceAssetId,
        cost_cents: totalCents,
        cost_credits: totalCents,
      })
    }

    return {
      text:
        `Generated ${isSeedance ? `${seedanceDuration}s` : '5s'} lip-sync (${costKey}) into project ${input.projectId} ` +
        `for ${fmtCredits(totalCents)}. ` +
        (input.audioMethod === 'tts'
          ? `Spoken: "${(input.ttsText ?? '').slice(0, 60)}${(input.ttsText ?? '').length > 60 ? '...' : ''}"`
          : `Audio: ${input.audioFilePath}`),
      data: {
        variant: costKey,
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceAssetId: input.sourceAssetId,
        cost_cents: totalCents,
        cost_credits: totalCents,
        asset: result.asset,
        generationId: result.generationId,
      },
    }
  },
}

// ── Generate motion transfer ────────────────────────────────────

export const generateMotionTransfer: Operation<{
  projectId: string
  sourceVideoAssetId: string
  targetImageAssetId: string
  motionModel?: 'kling-mc-std' | 'kling-mc-pro' | 'seedance-2'
  characterOrientation?: 'video' | 'image'
  prompt?: string
  klingProvider?: 'fal' | 'kling'
  duration?: number
  videoResolution?: '480p' | '720p' | '1080p' | '4k'
  aspectRatio?: string
  seedanceFace?: boolean
  seedanceRealFace?: boolean
  realFaceConsent?: boolean
  sourceVideoSeconds?: number
  background?: boolean
  confirm?: boolean
}> = {
  id: 'slates_generate_motion_transfer',
  description:
    'Transfer the motion from a reference video onto a target image character. Two engines — route per slates-model-selection: (1) kling-mc-std ($0.95 / 5s) / kling-mc-pro ($1.26 / 5s) — the cheap utility lane, structured skeleton/depth retargeting, always 5s. (2) motionModel=seedance-2 — the PREMIUM lane: single-pass generation with the driving clip as a native conditioning signal (better motion fidelity + native audio), prompt-driven (write what the character does, e.g. "the character from image 1 performs the exact motion from video 1"), bills input+output seconds on seedance vref keys (pass sourceVideoSeconds; driving clip must be 2-15s). Faces: seedanceFace defaults true; a REAL person needs seedanceRealFace+realFaceConsent (premium route). REQUIRED before calling: slates-cost-discipline + slates-prompting-motion-transfer skills. projectId is REQUIRED — both assets must exist in the project. All tiers hit the >$0.50 confirm gate.',
  input: z.object({
    projectId: z.string().uuid().describe('Slates project. Both source and target assets must live here.'),
    sourceVideoAssetId: z.string().uuid().describe('Asset id of the reference video — its motion will be retargeted onto the target image. Must already exist in the project. Seedance engine: 2-15s clips only.'),
    targetImageAssetId: z.string().uuid().describe('Asset id of the target image (the character that will perform the motion). Must already exist in the project.'),
    motionModel: z.enum(['kling-mc-std', 'kling-mc-pro', 'seedance-2']).optional().describe('kling-mc-std (~32 credits) general motion; kling-mc-pro (~42 credits) cleaner anatomy — default. seedance-2 = premium single-pass lane (prompt-driven, native audio, input+output-second billing) — pick when motion fidelity or audio matters.'),
    characterOrientation: z.enum(['video', 'image']).optional().describe('Kling only. "video" = use the source video\'s framing. "image" = use the target image\'s framing. Default video.'),
    prompt: z.string().optional().describe('Kling: optional refinement. Seedance: THE driver — describe what the character does with the motion from the clip (ordinal references: "the character from image 1 performs the motion from video 1"). A sensible default recipe is used if omitted. Read slates-prompting-motion-transfer.'),
    klingProvider: z.enum(['fal', 'kling']).optional().describe('Kling engine only — provider routing. "fal" (default) uses Slates credits.'),
    duration: z.number().int().min(4).max(15).optional().describe('Seedance engine only — output duration in seconds (4-15). Defaults to the driving clip\'s length.'),
    videoResolution: z.enum(['480p', '720p', '1080p', '4k']).optional().describe('Seedance engine only. Default 1080p.'),
    aspectRatio: z.string().optional().describe('Seedance engine only. Default 16:9.'),
    seedanceFace: z.boolean().optional().describe('Seedance engine only — a character\'s face is in the clip/image (default TRUE for motion transfer). Bills the -face key.'),
    seedanceRealFace: z.boolean().optional().describe('Seedance engine only — the driving clip/subject shows a REAL person. Premium -realface key; REQUIRES realFaceConsent=true.'),
    realFaceConsent: z.boolean().optional().describe('MANDATORY with seedanceRealFace — set true only after the user explicitly confirms they hold rights/consent to the likeness.'),
    sourceVideoSeconds: z.number().optional().describe('Seedance engine: the driving clip\'s duration in seconds (from the asset listing, 2-15s). Feeds the vref cost key (input+output billing).'),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
    confirm: z.boolean().optional().describe('Set true to bypass the confirm gate. Required — both tiers exceed.'),
  }),
  async run(input, ctx) {
    const motionModel = input.motionModel ?? 'kling-mc-pro'
    const isSeedance = motionModel === 'seedance-2'
    let costKey: string
    let seedanceDuration = 0
    if (isSeedance) {
      if (input.seedanceRealFace && !input.realFaceConsent) {
        return ok({
          requires_clarification: true,
          missing: ['realFaceConsent'],
          message:
            'Real-person motion transfer needs consent: confirm with the user that they hold the rights/consent to this likeness, then retry with realFaceConsent=true.',
        })
      }
      if (!input.sourceVideoSeconds) {
        return ok({
          requires_clarification: true,
          missing: ['sourceVideoSeconds'],
          message:
            'Seedance motion transfer bills combined input+output seconds. Pass sourceVideoSeconds (the driving clip\'s duration from slates_list_assets, must be 2-15s).',
        })
      }
      seedanceDuration = input.duration ?? Math.min(15, Math.max(4, Math.ceil(input.sourceVideoSeconds)))
      costKey = videoCostKey({
        model: 'seedance-2',
        duration: seedanceDuration,
        videoResolution: input.videoResolution ?? '1080p',
        seedanceFace: input.seedanceFace !== false && input.seedanceRealFace !== true,
        seedanceRealFace: input.seedanceRealFace === true,
        videoRefSeconds: input.sourceVideoSeconds,
      })
    } else {
      costKey = motionModel === 'kling-mc-std' ? 'kling-mc-std-5s' : 'kling-mc-pro-5s'
    }

    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) throw new Error(`Model variant not in registry: ${costKey}`)
    const totalCents = creditCost(entry)

    // Cost confirm gate. Motion transfer is mechanical — the model
    // applies source motion to target image deterministically. We don't
    // burn tokens previewing assets the user already chose; codes in the
    // text are enough to keep the chat unambiguous.
    if (totalCents > CONFIRM_CREDITS && !input.confirm) {
      const desktop = ctx.desktop()
      const [source, target] = await Promise.all([
        lookupAssetRef(desktop, input.sourceVideoAssetId),
        lookupAssetRef(desktop, input.targetImageAssetId),
      ])
      return ok({
        requires_confirm: true,
        variant: costKey,
        estimated_cents: totalCents,
        estimated_credits: totalCents,
        source_ref: source,
        target_ref: target,
        message:
          `Cost: ${fmtCredits(totalCents)} for ${isSeedance ? `${seedanceDuration}s Seedance motion transfer` : `5s ${motionModel}`} (${costKey}). ` +
          `Transferring motion from ${source} onto ${target}. ` +
          `Re-call with confirm=true after the user explicitly OKs the spend${isSeedance ? '' : ', or pick kling-mc-std to save ~10 credits'}. ` +
          `When discussing with the user, refer to the assets by those codes — they'll match the gallery badges.`,
      })
    }

    const desktop = ctx.desktop()
    if (input.background) {
      await desktop.requireCapability('background-generation', 'background generation')
    }
    const result = await desktop.post<{
      success: boolean
      background?: boolean
      asset?: Record<string, unknown>
      generationId?: string
      generationIds?: string[]
      error?: string
    }>('/agent/generation/motion-transfer', {
      projectId: input.projectId,
      sourceVideoAssetId: input.sourceVideoAssetId,
      targetImageAssetId: input.targetImageAssetId,
      motionModel,
      characterOrientation: input.characterOrientation ?? 'video',
      prompt: input.prompt,
      klingProvider: input.klingProvider,
      estimatedCost: totalCents,
      background: input.background,
      // Seedance engine passthrough — the desktop delegates to the seedance
      // ref-to-video path (vref billing, face cascade, consent gate).
      ...(isSeedance
        ? {
            duration: seedanceDuration,
            videoResolution: input.videoResolution,
            aspectRatio: input.aspectRatio,
            seedanceFace: input.seedanceFace !== false && input.seedanceRealFace !== true,
            seedanceRealFace: input.seedanceRealFace === true,
            realFaceConsent: input.realFaceConsent === true,
            // Ride the caller-supplied clip duration through — the asset row's
            // duration can be null for imported clips.
            sourceVideoDurationSeconds: input.sourceVideoSeconds,
          }
        : {}),
    })
    if (!result.success) throw new Error(result.error ?? 'Motion transfer generation failed')
    if (result.background) {
      const ids = result.generationIds ?? (result.generationId ? [result.generationId] : [])
      return backgroundSubmitted(`${isSeedance ? `${seedanceDuration}s` : '5s'} motion transfer (${motionModel})`, ids, {
        variant: costKey,
        motionModel,
        projectId: input.projectId,
        sourceVideoAssetId: input.sourceVideoAssetId,
        targetImageAssetId: input.targetImageAssetId,
        cost_cents: totalCents,
        cost_credits: totalCents,
      })
    }

    return {
      text:
        `Generated ${isSeedance ? `${seedanceDuration}s` : '5s'} motion transfer (${motionModel}) into project ${input.projectId} ` +
        `for ${fmtCredits(totalCents)}.` +
        (input.prompt ? ` Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"` : ''),
      data: {
        variant: costKey,
        motionModel,
        projectId: input.projectId,
        sourceVideoAssetId: input.sourceVideoAssetId,
        targetImageAssetId: input.targetImageAssetId,
        cost_cents: totalCents,
        cost_credits: totalCents,
        asset: result.asset,
        generationId: result.generationId,
      },
    }
  },
}

// ── Edit video (Kling O3 video-to-video) ────────────────────────

export const editVideo: Operation<{
  projectId: string
  sourceVideoAssetId: string
  prompt: string
  model?: 'kling-v3.0-omni-edit' | 'kling-v3.0-omni-pro-edit' | 'omni-flash-edit'
  characterAssetIds?: string[]
  styleAssetIds?: string[]
  keepAudio?: boolean
  background?: boolean
  confirm?: boolean
}> = {
  id: 'slates_edit_video',
  description:
    'Edit an EXISTING video clip with one instruction — character swap, environment change, style transfer — in one pass, no masking. Original motion, camera, and audio are preserved; only what the prompt names changes. Use when a clip is ~90% right (fix it, don\'t re-roll it) or to AI-edit the user\'s own footage. Engines: Kling O3 edit (default; 3–15s clips, 720–3840px, subject/style refs via elements) or omni-flash-edit (Gemini Omni Flash; 3–10s clips, 720p output, PROMPT-ONLY — no refs, cheapest seat). Cost = per second of OUTPUT (≈ clip length, rounded UP to the next second): omni-flash-edit ≈ 19¢/s ≈ kling-v3.0-omni-edit ≈ 19¢/s, kling-v3.0-omni-pro-edit ≈ 25¢/s. Subjects to swap IN go as characterAssetIds (frontal + angle images become Kling elements — Kling models only); style refs as styleAssetIds; max 4 combined. The edited clip saves as a NEW asset linked to its parent (chain edits freely). Routing: Kling edit is the default edit tool (element lock + audio intact); omni-flash-edit for cheap prompt-only footage-synced swaps; prefer Seedance edit/relocate only for style-transfer-heavy jobs — see slates-model-selection. Prompting: slates-prompting-kling-v3 §Edit / slates-prompting-omni-flash.',
  input: z.object({
    projectId: z.string().uuid().describe('Project the source clip lives in.'),
    sourceVideoAssetId: z.string().describe('The VIDEO asset to edit — UUID or badge code ("VID-V3", bare "V3"); codes resolve against the project at call time. Kling: 3–15s clips; omni-flash-edit: 3–10s.'),
    prompt: z.string().min(1).max(2500).describe('The change, not the whole scene — e.g. "replace the man with @marcus", "make it a rainy night", "turn the street into a neon Tokyo alley". Mention subjects with @name; the transport compiles them to Kling\'s @ElementN notation (Kling models). For omni-flash-edit keep it simple and add "Keep everything else the same."'),
    model: z.enum(['kling-v3.0-omni-edit', 'kling-v3.0-omni-pro-edit', 'omni-flash-edit']).optional().describe('Default kling-v3.0-omni-edit. Pro (~25¢/s vs ~19¢/s) only for hero shots where fidelity matters. omni-flash-edit (~19¢/s, 720p, 3–10s) for prompt-only edits — it takes NO character/style refs.'),
    characterAssetIds: z.array(z.string()).max(4).optional().describe('Subject/element image assets to swap IN (UUIDs or badge codes). Each becomes a Kling element (@ElementN). KLING MODELS ONLY — rejected on omni-flash-edit.'),
    styleAssetIds: z.array(z.string()).max(4).optional().describe('Style/appearance reference images (@ImageN). Max 4 combined with characterAssetIds. KLING MODELS ONLY — rejected on omni-flash-edit.'),
    keepAudio: z.boolean().optional().describe('Preserve the original audio track (default true; Kling models only — omni-flash-edit output carries its own audio).'),
    background: z.boolean().optional().describe(BACKGROUND_DESCRIBE),
    confirm: z.boolean().optional().describe('Set true to bypass the cost confirm gate after the user OKs the spend.'),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('edit-video', 'video editing (Kling O3 edit)')
    if (input.background) {
      await desktop.requireCapability('background-generation', 'background generation')
    }
    const model = input.model ?? 'kling-v3.0-omni-edit'
    const isOmniFlashEdit = model === 'omni-flash-edit'
    // Kling edit: 3–15s source clips; Omni Flash edit: 3–10s.
    const maxClipSeconds = isOmniFlashEdit ? 10 : 15

    if (isOmniFlashEdit && ((input.characterAssetIds?.length ?? 0) > 0 || (input.styleAssetIds?.length ?? 0) > 0)) {
      throw new Error(
        'omni-flash-edit is prompt-only — it takes no character/style reference images. Drop the refs, or switch to kling-v3.0-omni-edit which supports elements.'
      )
    }

    // Resolve refs (UUIDs or badge codes) against the project AT CALL TIME.
    const refInputs = [
      { ref: input.sourceVideoAssetId, role: 'source clip' },
      ...(input.characterAssetIds ?? []).map((ref) => ({ ref, role: 'subject element' })),
      ...(input.styleAssetIds ?? []).map((ref) => ({ ref, role: 'style' })),
    ]
    const resolved = await resolveAssetRefs(ctx, input.projectId, refInputs.map((r) => r.ref))
    const rid = (ref: string): string => resolved.get(ref)?.id ?? ref
    const sourceId = rid(input.sourceVideoAssetId)
    const characterAssetIds = (input.characterAssetIds ?? []).map(rid)
    const styleAssetIds = (input.styleAssetIds ?? []).map(rid)
    const refEcho = describeResolvedRefs(refInputs, resolved)

    if (characterAssetIds.length + styleAssetIds.length > 4) {
      throw new Error('Kling O3 edit takes max 4 combined subject + style references.')
    }

    // The billed key needs the clip's duration (ceiled). Read it from the
    // project's asset records — the desktop route independently re-validates.
    const { assets } = await desktop.get<{ assets: Array<{ id?: string; type?: string; duration?: number }> }>(
      '/agent/assets',
      { projectId: input.projectId }
    )
    const sourceRow = (assets ?? []).find((a) => String(a.id).toLowerCase() === sourceId.toLowerCase())
    if (!sourceRow) throw new Error(`Source asset not found in project: ${input.sourceVideoAssetId}`)
    if (sourceRow.type !== 'video') throw new Error('sourceVideoAssetId must reference a VIDEO asset.')
    const clipSeconds = Number(sourceRow.duration)
    if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) {
      throw new Error('Source clip has no recorded duration — cannot quote the edit. Re-import the clip or pick another.')
    }
    if (clipSeconds > maxClipSeconds + 0.05 || clipSeconds < 2.95) {
      throw new Error(
        `Source clip is ${clipSeconds.toFixed(1)}s — ${model} accepts 3–${maxClipSeconds}s. ` +
          `Trim it first with slates_trim_video (e.g. inSec 0, outSec ${maxClipSeconds}), then edit the trimmed clip.`
      )
    }
    const billedSeconds = Math.min(maxClipSeconds, Math.max(3, Math.ceil(clipSeconds - 0.05)))
    const costKey = isOmniFlashEdit ? omniFlashEditCostKey(billedSeconds) : klingEditCostKey(model, billedSeconds)

    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) throw new Error(`Model variant not in registry: ${costKey}`)
    const totalCents = creditCost(entry)

    // Confirm gate — look-first: preview the source clip + refs so the LLM
    // sees what it's editing before committing spend (mirrors generateVideo).
    if ((totalCents > CONFIRM_CREDITS || refInputs.length > 1) && !input.confirm) {
      const previews = await previewAssets(ctx, [
        { id: sourceId, type: 'video' as const, role: 'source clip' },
        ...characterAssetIds.map((id) => ({ id, type: 'image' as const, role: 'subject element' })),
        ...styleAssetIds.map((id) => ({ id, type: 'image' as const, role: 'style' })),
      ])
      return {
        text:
          `Cost: ${fmtCredits(totalCents)} to edit a ${billedSeconds}s clip with ${model} (${costKey}). ` +
          `${refEcho} Re-call with confirm=true after the user explicitly OKs the spend.`,
        images: previews.flatMap((p) => p.images),
        data: {
          requires_confirm: true,
          model,
          variant: costKey,
          billed_seconds: billedSeconds,
          clip_seconds: clipSeconds,
          estimated_cents: totalCents,
          estimated_credits: totalCents,
          references: previews.map((p) => ({ ref: p.ref, role: p.role, ...p.meta })),
        },
      }
    }

    const result = await desktop.post<{
      success: boolean
      background?: boolean
      asset?: Record<string, unknown>
      generationId?: string
      error?: string
    }>('/agent/generation/edit-video', {
      projectId: input.projectId,
      model,
      prompt: input.prompt,
      sourceVideoAssetId: sourceId,
      characterAssetIds,
      styleAssetIds,
      keepAudio: input.keepAudio !== false,
      background: input.background,
    })
    if (!result.success) throw new Error(result.error ?? 'Video edit failed')
    if (result.background) {
      const ids = result.generationId ? [result.generationId] : []
      return backgroundSubmitted(`${billedSeconds}s video edit (${model})`, ids, {
        model,
        variant: costKey,
        projectId: input.projectId,
        sourceVideoAssetId: sourceId,
        cost_cents: totalCents,
        cost_credits: totalCents,
      }, refEcho)
    }

    return {
      text:
        `Edited ${billedSeconds}s clip saved as a new asset in project ${input.projectId} ` +
        `for ${fmtCredits(totalCents)} via ${model}. ` +
        `Edit: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"` +
        (refEcho ? ` ${refEcho}` : ''),
      data: {
        model,
        variant: costKey,
        projectId: input.projectId,
        sourceVideoAssetId: sourceId,
        billed_seconds: billedSeconds,
        cost_cents: totalCents,
        cost_credits: totalCents,
        asset: result.asset,
        generationId: result.generationId,
      },
    }
  },
}

// ── Trim a video to an exact window (fit-to-model primitive) ────

export const trimVideo: Operation<{
  projectId: string
  assetId: string
  inSec?: number
  outSec: number
}> = {
  id: 'slates_trim_video',
  description:
    'Trim a video asset to an exact [inSec, outSec] window and save the result as a NEW clip linked to the original (the original is untouched). This is the fit-to-model primitive: an 11s clip will not run on omni-flash-edit (3–10s) or Kling edit (3–15s), and a Seedance video reference must be 2–15s — trim it first, then edit/relocate the trimmed clip. EXACT re-encode (not a keyframe-snapped cut) so the result honors hard duration caps to the frame; any phone rotation flag is baked into the pixels in the same pass. The new clip lands with correct duration/width/height immediately. inSec defaults to 0.',
  input: z.object({
    projectId: z.string().uuid().describe('Project the clip lives in.'),
    assetId: z
      .string()
      .describe('The VIDEO asset to trim — UUID or badge code ("VID-V3", bare "V3"); resolves against the project at call time.'),
    inSec: z.number().min(0).optional().describe('Trim start in seconds (default 0).'),
    outSec: z.number().positive().describe('Trim end in seconds. Must be greater than inSec.'),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    const resolved = await resolveAssetRefs(ctx, input.projectId, [input.assetId])
    const assetId = resolved.get(input.assetId)?.id ?? input.assetId
    const inSec = input.inSec ?? 0
    if (input.outSec - inSec < 0.05) {
      throw new Error('outSec must be at least ~0.1s after inSec.')
    }
    const r = await desktop.post<{ asset?: Record<string, unknown> }>('/agent/assets/trim-video', {
      assetId,
      inSec,
      outSec: input.outSec,
    })
    const a = r.asset as { id?: string; code?: string | null; label?: string | null } | undefined
    const name = a?.code ?? a?.id ?? 'new clip'
    return {
      text:
        `Trimmed clip saved as ${name}${a?.label ? ` — ${a.label}` : ''} ` +
        `(${(input.outSec - inSec).toFixed(1)}s, ${inSec.toFixed(1)}–${input.outSec.toFixed(1)}s). ` +
        `Edit or generate from it by its new id/code.`,
      data: { asset: r.asset },
    }
  },
}

// ── Generation status (background mode) ─────────────────────────

export const getGenerationStatus: Operation<{ generationId: string; waitSeconds?: number }> = {
  id: 'slates_get_generation_status',
  description:
    'Poll one generation by id. Returns status (pending/processing/completed/failed/cancelled), the error message on failure, and the finished asset record (with id, code, filePath) on completion. Use after submitting any generate_* op with background=true. ALWAYS pass waitSeconds (use 45) — the call long-polls internally and returns early the moment the generation reaches a terminal state, so ONE call replaces a dozen rapid polls (each poll turn re-reads your whole context; rapid polling is the #1 orchestration-cost leak). Video generations commonly take 1-5 minutes: expect 1-4 long-poll calls, never a tight loop. Generations survive app restarts (the desktop resumes in-flight provider jobs on boot).',
  input: z.object({
    generationId: z.string().uuid(),
    waitSeconds: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe('Long-poll: block up to N seconds, returning early on completion/failure. Use 45.'),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('background-generation', 'background generation')
    const deadline = Date.now() + Math.min(Math.max(input.waitSeconds ?? 0, 0), 50) * 1000
    for (;;) {
      const r = await desktop.get<{
        found?: boolean
        status?: string
        note?: string
        generation?: Record<string, unknown>
        asset?: Record<string, unknown> | null
      }>('/agent/generation/status', { id: input.generationId })
      const g = r.generation
      const status = (g?.status as string | undefined) ?? r.status
      const terminal = status === 'completed' || status === 'failed' || status === 'cancelled'
      if (terminal || Date.now() >= deadline) {
        if (!g) return ok(r)
        // Slim the payload: the raw generation row (full prompt/settings)
        // and full asset row are context bloat — return the fields the
        // agent acts on, with the EXACT billed cost front and center.
        return ok({
          status,
          cost_credits: g.cost != null ? creditsFromDollars(g.cost as number) : null,
          error: g.error ?? null,
          model: g.model,
          completed_at: g.completedAt ?? null,
          asset: r.asset
            ? { ...compactAsset(r.asset), file_path: (r.asset as { filePath?: string }).filePath }
            : null,
        })
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(3000, deadline - Date.now())))
    }
  },
}

export const listGenerations: Operation<{
  projectId?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  limit?: number
}> = {
  id: 'slates_list_generations',
  description:
    "List recent and in-flight generations (newest first), optionally filtered by project and/or status. Use status='processing' to see everything still running, or no filter to review the recent history with costs and errors.",
  input: z.object({
    projectId: z.string().uuid().optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('background-generation', 'background generation')
    return ok(
      await desktop.get('/agent/generation/list', {
        projectId: input.projectId,
        status: input.status,
        // Default cap — an unbounded history dump is a context leak.
        limit: input.limit ?? 20,
      })
    )
  },
}

// ── Timeline ────────────────────────────────────────────────────

// Loose view over the timeline payload — enough to write the one-line
// summaries without over-coupling to the desktop's exact shape.
interface TimelineView {
  timeline?: {
    id?: string
    frameRate?: number
    width?: number
    height?: number
    durationSec?: number
    tracks?: Array<{ id?: string; clips?: unknown[] }>
  }
  clipIndex?: Array<{
    clipId?: string
    trackId?: string
    assetId?: string
    code?: string | null
    label?: string | null
  }>
  durationSec?: number
}

export const getTimeline: Operation<{ projectId: string }> = {
  id: 'slates_get_timeline',
  description:
    'Get (or lazily create) the single editing timeline for a Slates project, with all tracks, clips, markers, and a flat clipIndex mapping every clip back to its source asset (assetId + code + label). Frames are the unit of time; durationSec is provided. Call this before adding, reordering, or removing clips, and before exporting — it tells you the timeline id, frame rate, resolution, and current end frame.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline', 'timeline editing')
    const r = await desktop.get<TimelineView & { success: boolean }>('/agent/timeline', {
      projectId: input.projectId,
    })
    const t = r.timeline ?? {}
    const clipCount =
      r.clipIndex?.length ??
      (t.tracks ?? []).reduce((n, tr) => n + (tr.clips?.length ?? 0), 0)
    const durationSec = t.durationSec ?? r.durationSec
    const dims = t.width && t.height ? `${t.width}x${t.height}` : '?'
    return ok(
      r,
      `Timeline for project ${input.projectId}: ${clipCount} clip(s) on ${t.tracks?.length ?? '?'} track(s), ` +
        `${durationSec ?? '?'}s at ${t.frameRate ?? '?'} fps, ${dims}.\n\n` +
        JSON.stringify(r, null, 2)
    )
  },
}

export const addClipToTimeline: Operation<{
  projectId: string
  assetId: string
  trackId?: string
  startFrame?: number
  sourceInFrame?: number
  sourceOutFrame?: number
}> = {
  id: 'slates_add_clip_to_timeline',
  description:
    "Append a video or audio asset from the project to the project's timeline (or place it at an explicit startFrame). Defaults match the desktop UI: video clips go to the end of the first video track; audio clips (music, voiceover, AI audio) go after the last clip on the first AUDIO track and are mixed under the video on export. An empty timeline auto-adopts the first video clip's resolution and frame rate; later higher-resolution clips raise the canvas. Overlapping video clips resolve top-track-wins. Optionally trim with sourceInFrame/sourceOutFrame (frames at the SOURCE fps). Use slates_get_timeline first to see current clips and pick positions.",
  input: z.object({
    projectId: z.string().uuid(),
    assetId: z.string().uuid().describe('Video or audio asset already in the project.'),
    trackId: z.string().uuid().optional().describe('Target track (type must match the asset: video asset → video track, audio asset → audio track). Default: the first track of the matching type.'),
    startFrame: z.number().int().min(0).optional().describe('Timeline frame to place the clip at. Default: append after the last clip.'),
    sourceInFrame: z.number().int().min(0).optional(),
    sourceOutFrame: z.number().int().min(1).optional(),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline', 'timeline editing')
    const r = await desktop.post<
      TimelineView & {
        success: boolean
        clip?: {
          id?: string
          assetId?: string
          startFrame?: number
          durationFrames?: number
          endFrame?: number
          code?: string | null
          label?: string | null
        }
      }
    >('/agent/timeline/add-clip', {
      projectId: input.projectId,
      assetId: input.assetId,
      trackId: input.trackId,
      startFrame: input.startFrame,
      sourceInFrame: input.sourceInFrame,
      sourceOutFrame: input.sourceOutFrame,
    })
    const clip = r.clip ?? {}
    // Code + label for the chat reference: prefer fields on the clip, fall
    // back to the clipIndex entry for this clip / its source asset.
    const idx = (r.clipIndex ?? []).find(
      (c) => (clip.id && c.clipId === clip.id) || (!clip.id && clip.assetId && c.assetId === clip.assetId)
    )
    const code = clip.code ?? idx?.code ?? null
    const label = clip.label ?? idx?.label ?? null
    const ref = code ? (label ? `${code} — ${label}` : code) : input.assetId
    const frames =
      clip.durationFrames ??
      (clip.endFrame != null && clip.startFrame != null ? clip.endFrame - clip.startFrame : '?')
    return ok(r, `Added ${ref} to timeline at frame ${clip.startFrame ?? '?'} (${frames} frames long).`)
  },
}

export const reorderClips: Operation<{ trackId: string; clipIds: string[] }> = {
  id: 'slates_reorder_clips',
  description:
    "Reorder the clips on one timeline track. Pass the COMPLETE list of the track's clip ids in the desired playback order; clips are repacked back-to-back from frame 0 (existing gaps are removed). Get current clip ids from slates_get_timeline.",
  input: z.object({
    trackId: z.string().uuid(),
    clipIds: z.array(z.string().uuid()).min(1),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline', 'timeline editing')
    return ok(await desktop.post('/agent/timeline/reorder-clips', input))
  },
}

export const removeClip: Operation<{ clipId: string }> = {
  id: 'slates_remove_clip',
  description:
    "Remove a clip from the timeline (the source asset is untouched). Leaves a gap at the clip's old position — MP4 export renders gaps as black; call slates_reorder_clips afterwards to close gaps.",
  input: z.object({ clipId: z.string().uuid() }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline', 'timeline editing')
    return ok(await desktop.post('/agent/timeline/remove-clip', input))
  },
}

export const addTimelineTrack: Operation<{
  projectId: string
  type?: 'video' | 'audio'
  name?: string
}> = {
  id: 'slates_add_timeline_track',
  description:
    "Add a track to the project's timeline (default: an audio track, for layering voiceover + music + AI audio). The new track is appended below existing tracks. Returns the new track and the full timeline.",
  input: z.object({
    projectId: z.string().uuid(),
    type: z.enum(['video', 'audio']).optional().describe('Default: audio.'),
    name: z.string().optional().describe("Default: 'Audio N' / 'Video N'."),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline-tracks', 'timeline tracks + audio mixing')
    return ok(await desktop.post('/agent/timeline/add-track', input))
  },
}

export const updateTimelineTrack: Operation<{
  projectId: string
  trackId: string
  name?: string
  muted?: boolean
  locked?: boolean
  volume?: number
}> = {
  id: 'slates_update_timeline_track',
  description:
    'Update a timeline track: rename, mute/unmute, lock/unlock, or set its volume fader (linear gain, -∞ to +12 dB). Track volume applies to both preview and MP4 export — audio-track clips are mixed at this gain; a muted video track still shows video but its embedded audio is silenced.',
  input: z.object({
    projectId: z.string().uuid(),
    trackId: z.string().uuid(),
    name: z.string().optional(),
    muted: z.boolean().optional(),
    locked: z.boolean().optional(),
    volume: z.number().min(0).max(4).optional().describe('Track fader as LINEAR gain: 0 = -∞ (silent), 1 = 0 dB (unity), ~3.98 = +12 dB (max boost).'),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline-tracks', 'timeline tracks + audio mixing')
    return ok(await desktop.post('/agent/timeline/update-track', input))
  },
}

export const removeTimelineTrack: Operation<{ projectId: string; trackId: string }> = {
  id: 'slates_remove_timeline_track',
  description:
    'Remove an EMPTY timeline track (fails if it still has clips, or if it is the last track of its type).',
  input: z.object({
    projectId: z.string().uuid(),
    trackId: z.string().uuid(),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline-tracks', 'timeline tracks + audio mixing')
    return ok(await desktop.post('/agent/timeline/remove-track', input))
  },
}

export const updateTimelineSettings: Operation<{
  projectId: string
  width?: number
  height?: number
  frameRate?: 24 | 30 | 60
  masterVolume?: number
}> = {
  id: 'slates_update_timeline_settings',
  description:
    "Update the project timeline's output settings: resolution, frame rate (24/30/60 — all clips are conformed to it on export), and masterVolume, the output fader (linear gain, -∞ to +12 dB) applied to the final mix in both preview and MP4 export (use it to prevent clipping when stacking loud tracks). Note these are normally auto-managed: the first video clip sets fps + resolution, and higher-res clips raise the canvas. Changing frameRate after clips are placed retimes them — avoid unless the timeline is empty.",
  input: z.object({
    projectId: z.string().uuid(),
    width: z.number().int().min(16).optional(),
    height: z.number().int().min(16).optional(),
    frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
    masterVolume: z.number().min(0).max(4).optional().describe('Output fader as LINEAR gain: 0 = -∞ (silent), 1 = 0 dB (unity), ~3.98 = +12 dB (max boost).'),
  }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('timeline-tracks', 'timeline tracks + audio mixing')
    return ok(await desktop.post('/agent/timeline/update-settings', input))
  },
}

// ── Export ──────────────────────────────────────────────────────

const ABSOLUTE_PATH_RE = /^([A-Za-z]:[\\/]|\/)/

export const exportVideo: Operation<{
  projectId?: string
  timelineId?: string
  outputPath: string
  overwrite?: boolean
}> = {
  id: 'slates_export_video',
  description:
    "Render the project's timeline to an MP4 file on disk via the desktop app's ffmpeg pipeline (H.264 + AAC, gaps rendered as black). No dialogs — pass an absolute outputPath ending in .mp4. Fails if the file exists unless overwrite=true. Blocks until encoding finishes (can take minutes for long timelines) and returns the real file size and probed duration. After success, consider slates_reveal_file to show the file to the user. Requires at least one video clip on the timeline.",
  input: z
    .object({
      projectId: z.string().uuid().optional(),
      timelineId: z.string().uuid().optional(),
      outputPath: z
        .string()
        .min(5)
        .refine((p) => ABSOLUTE_PATH_RE.test(p), { message: 'outputPath must be absolute' })
        .describe('Absolute path for the rendered file, ending in .mp4 (e.g. C:\\Users\\you\\Videos\\ad.mp4 or /Users/you/ad.mp4). slates_get_project_directory gives a sensible default folder.'),
      overwrite: z.boolean().optional(),
    })
    .refine((d) => !!d.projectId !== !!d.timelineId, {
      message: 'Pass exactly one of projectId or timelineId',
    }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('export', 'video export')
    const r = await desktop.post<{
      success: boolean
      outputPath?: string
      durationSec?: number
      fileSizeBytes?: number
      width?: number
      height?: number
      frameRate?: number
      clipCount?: number
    }>('/agent/timeline/export-video', {
      projectId: input.projectId,
      timelineId: input.timelineId,
      outputPath: input.outputPath,
      overwrite: input.overwrite,
    })
    const mb = r.fileSizeBytes != null ? (r.fileSizeBytes / (1024 * 1024)).toFixed(1) : '?'
    return ok(
      r,
      `Exported ${r.durationSec ?? '?'}s MP4 (${mb} MB) to ${r.outputPath ?? input.outputPath}.`
    )
  },
}

export const exportTimelineXml: Operation<{
  projectId?: string
  timelineId?: string
  outputPath: string
  overwrite?: boolean
}> = {
  id: 'slates_export_timeline_xml',
  description:
    "Export the project's timeline as FCP7/XMEML XML — the file DaVinci Resolve imports directly (File → Import → Timeline) to recreate the edit with references to the original clip media on disk. This is the 'open in DaVinci' handoff path. Pass an absolute outputPath ending in .xml; fails if the file exists unless overwrite=true.",
  input: z
    .object({
      projectId: z.string().uuid().optional(),
      timelineId: z.string().uuid().optional(),
      outputPath: z
        .string()
        .min(5)
        .refine((p) => ABSOLUTE_PATH_RE.test(p), { message: 'outputPath must be absolute' })
        .describe('Absolute path for the XML file, ending in .xml (e.g. C:\\Users\\you\\Videos\\ad.xml or /Users/you/ad.xml).'),
      overwrite: z.boolean().optional(),
    })
    .refine((d) => !!d.projectId !== !!d.timelineId, {
      message: 'Pass exactly one of projectId or timelineId',
    }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('export', 'timeline XML export')
    const r = await desktop.post<{ success: boolean; outputPath?: string }>(
      '/agent/timeline/export-xml',
      {
        projectId: input.projectId,
        timelineId: input.timelineId,
        outputPath: input.outputPath,
        overwrite: input.overwrite,
      }
    )
    return ok(r, `Exported timeline XML to ${r.outputPath ?? input.outputPath}. Import in DaVinci Resolve via File → Import → Timeline.`)
  },
}

export const revealFile: Operation<{ path: string }> = {
  id: 'slates_reveal_file',
  description:
    'Open the OS file manager (Explorer/Finder) with the given file selected — use after slates_export_video / slates_export_timeline_xml so the user can see the file you wrote. Absolute path required; the file must exist.',
  input: z.object({ path: z.string().min(3) }),
  async run(input, ctx) {
    const desktop = ctx.desktop()
    await desktop.requireCapability('export', 'revealing files in the file manager')
    return ok(await desktop.post('/agent/reveal-file', input))
  },
}

// ── CRUD completion (agent API v1 routes — no capability check) ─

export const updateProject: Operation<{ id: string; name?: string; description?: string }> = {
  id: 'slates_update_project',
  description: 'Update a Slates project\'s name and/or description.',
  input: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/projects/update', {
        id: input.id,
        data: { name: input.name, description: input.description },
      })
    )
  },
}

export const deleteProject: Operation<{ id: string; confirm?: boolean }> = {
  id: 'slates_delete_project',
  description:
    'Delete a Slates project. DESTRUCTIVE — permanently removes the project with all its assets, storyboards, and media files. Requires confirm=true after explicit user OK.',
  input: z.object({
    id: z.string().uuid(),
    confirm: z.boolean().optional().describe('Set true only after the user explicitly OKs the deletion.'),
  }),
  async run(input, ctx) {
    if (!input.confirm) {
      return ok({
        requires_confirm: true,
        message:
          'Deleting a project permanently removes all its assets, storyboards, and media files. Re-call with confirm=true after explicit user OK.',
      })
    }
    return ok(await ctx.desktop().post('/agent/projects/delete', { id: input.id }))
  },
}

export const getProjectDirectory: Operation<{ id: string }> = {
  id: 'slates_get_project_directory',
  description:
    'Get the absolute on-disk folder of a Slates project — useful for choosing an export outputPath default (e.g. <dir>/exports/final.mp4).',
  input: z.object({ id: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/projects/location', { id: input.id }))
  },
}

export const deleteAsset: Operation<{ id: string }> = {
  id: 'slates_delete_asset',
  description:
    'Delete an asset from its project. Permanent — also deletes the media file from disk.',
  input: z.object({ id: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/assets/delete', { id: input.id }))
  },
}

export const renameFolder: Operation<{ folderId: string; name: string }> = {
  id: 'slates_rename_folder',
  description: 'Rename an asset folder.',
  input: z.object({
    folderId: z.string().uuid(),
    name: z.string().min(1).max(120),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/folders/rename', { id: input.folderId, name: input.name }))
  },
}

export const deleteFolder: Operation<{ folderId: string }> = {
  id: 'slates_delete_folder',
  description: 'Delete an asset folder.',
  input: z.object({ folderId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/folders/delete', { id: input.folderId }))
  },
}

export const setFolderCover: Operation<{ folderId: string; assetId: string | null }> = {
  id: 'slates_set_folder_cover',
  description: 'Set the cover image of an asset folder (or clear it with assetId=null).',
  input: z.object({
    folderId: z.string().uuid(),
    assetId: z.string().uuid().nullable(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/folders/set-cover', input))
  },
}

export const updateCharacter: Operation<{
  characterId: string
  name?: string
  description?: string
  style?: string
}> = {
  id: 'slates_update_character',
  description:
    'Update a character\'s name, description, or style. Use slates_set_character_identity_asset for its canonical image.',
  input: z.object({
    characterId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().optional(),
    style: z.string().max(200).optional().describe("Art style. Omit to inherit the reference's style (the default). Canonical styles: photoreal, anime, painterly, 3d-render, comic. Or pass any free-text instruction, e.g. 'turn this into a real person'."),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/characters/update', {
        id: input.characterId,
        data: { name: input.name, description: input.description, style: input.style },
      })
    )
  },
}

export const deleteCharacter: Operation<{ characterId: string }> = {
  id: 'slates_delete_character',
  description: 'Delete a character from its project.',
  input: z.object({ characterId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/characters/delete', { id: input.characterId }))
  },
}

export const updateEnvironment: Operation<{
  environmentId: string
  name?: string
  description?: string
  style?: string
  referenceAssetId?: string | null
}> = {
  id: 'slates_update_environment',
  description:
    'Update an environment\'s name, description, style, or bound reference image (referenceAssetId=null clears it).',
  input: z.object({
    environmentId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().optional(),
    style: z.string().max(200).optional().describe("Art style. Omit to inherit the reference's style (the default). Canonical styles: photoreal, anime, painterly, 3d-render, comic. Or pass any free-text instruction, e.g. 'turn this into a real person'."),
    referenceAssetId: z.string().uuid().nullable().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/environments/update', {
        id: input.environmentId,
        data: {
          name: input.name,
          description: input.description,
          style: input.style,
          referenceAssetId: input.referenceAssetId,
        },
      })
    )
  },
}

export const deleteEnvironment: Operation<{ environmentId: string }> = {
  id: 'slates_delete_environment',
  description: 'Delete an environment from its project.',
  input: z.object({ environmentId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/environments/delete', { id: input.environmentId }))
  },
}

export const listStyles: Operation<{ projectId: string }> = {
  id: 'slates_list_styles',
  description: 'List visual styles in a Slates project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().get('/agent/styles', { projectId: input.projectId }))
  },
}

export const createStyle: Operation<{ projectId: string; name: string; description?: string }> = {
  id: 'slates_create_style',
  description: 'Create a new visual style in a Slates project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/styles', input))
  },
}

export const updateStyle: Operation<{
  styleId: string
  name?: string
  description?: string
  imageAssetId?: string | null
}> = {
  id: 'slates_update_style',
  description:
    'Update a style\'s name, description, or bound reference image (imageAssetId=null clears it).',
  input: z.object({
    styleId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().optional(),
    imageAssetId: z.string().uuid().nullable().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/styles/update', {
        id: input.styleId,
        data: { name: input.name, description: input.description, imageAssetId: input.imageAssetId },
      })
    )
  },
}

export const deleteStyle: Operation<{ styleId: string }> = {
  id: 'slates_delete_style',
  description: 'Delete a visual style from its project.',
  input: z.object({ styleId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/styles/delete', { id: input.styleId }))
  },
}

export const updateStoryboard: Operation<{
  storyboardId: string
  name?: string
  description?: string
}> = {
  id: 'slates_update_storyboard',
  description: 'Update a storyboard\'s name and/or description.',
  input: z.object({
    storyboardId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/storyboards/update', {
        id: input.storyboardId,
        data: { name: input.name, description: input.description },
      })
    )
  },
}

export const deleteStoryboard: Operation<{ storyboardId: string }> = {
  id: 'slates_delete_storyboard',
  description: 'Delete a storyboard with all its scenes and frames (the referenced assets are untouched).',
  input: z.object({ storyboardId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/storyboards/delete', { id: input.storyboardId }))
  },
}

export const updateScene: Operation<{ sceneId: string; name?: string; position?: number }> = {
  id: 'slates_update_scene',
  description: 'Update a scene\'s name and/or position within its storyboard.',
  input: z.object({
    sceneId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    position: z.number().int().min(0).optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/scenes/update', {
        id: input.sceneId,
        data: { name: input.name, position: input.position },
      })
    )
  },
}

export const deleteScene: Operation<{ sceneId: string }> = {
  id: 'slates_delete_scene',
  description: 'Delete a scene (and its frames) from a storyboard.',
  input: z.object({ sceneId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/scenes/delete', { id: input.sceneId }))
  },
}

export const reorderScenes: Operation<{ storyboardId: string; sceneIds: string[] }> = {
  id: 'slates_reorder_scenes',
  description:
    'Reorder the scenes of a storyboard. Pass the COMPLETE list of the storyboard\'s scene ids in the desired order.',
  input: z.object({
    storyboardId: z.string().uuid(),
    sceneIds: z.array(z.string().uuid()).min(1),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/scenes/reorder', input))
  },
}

export const updateFrame: Operation<{
  frameId: string
  shotLabel?: string
  notes?: string
  assetId?: string | null
  sceneId?: string | null
  position?: number
  frameType?: 'first' | 'last' | 'ingredient' | null
  motionPrompt?: string | null
}> = {
  id: 'slates_update_frame',
  description:
    'Update a frame: shot label, notes, bound asset (assetId=null unbinds), scene, position, frameType (first/last/ingredient, null clears), or motion prompt (null clears).',
  input: z.object({
    frameId: z.string().uuid(),
    shotLabel: z.string().optional(),
    notes: z.string().optional(),
    assetId: z.string().uuid().nullable().optional(),
    sceneId: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
    frameType: z.enum(['first', 'last', 'ingredient']).nullable().optional(),
    motionPrompt: z.string().nullable().optional(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/frames/update', {
        id: input.frameId,
        data: {
          shotLabel: input.shotLabel,
          notes: input.notes,
          assetId: input.assetId,
          sceneId: input.sceneId,
          position: input.position,
          frameType: input.frameType,
          motionPrompt: input.motionPrompt,
        },
      })
    )
  },
}

export const deleteFrame: Operation<{ frameId: string }> = {
  id: 'slates_delete_frame',
  description: 'Delete a frame from its scene (the referenced asset is untouched).',
  input: z.object({ frameId: z.string().uuid() }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/frames/delete', { id: input.frameId }))
  },
}

// ── Prompting guides (local lookup — no transport) ──────────────

// Model-id → guide-name aliasing. Order matters: kling-mc-* (motion
// transfer) must match before the generic kling-v3* check.
function resolveGuideTopic(topic: string): string | null {
  const t = topic.trim().toLowerCase()
  if (SKILLS[t]) return t
  if (t === 'slates-character-turnaround' || t === 'character-turnaround') {
    return 'slates-character-identity'
  }
  if (
    t === 'model-selection' ||
    t === 'model selection' ||
    t === 'which-model' ||
    t === 'which model' ||
    t === 'routing' ||
    t === 'model-routing'
  ) {
    return 'slates-model-selection'
  }
  if (t.startsWith('nano-banana')) return 'slates-prompting-nano-banana-2'
  if (t.startsWith('gpt-image') || t.startsWith('gpt image')) return 'slates-prompting-gpt-image-2'
  if (t.startsWith('flux')) return 'slates-prompting-flux-2-max'
  if (t.startsWith('seedream')) return 'slates-prompting-seedream-5-lite'
  if (t.startsWith('veo')) return 'slates-prompting-veo-3'
  if (t.startsWith('omni-flash') || t.startsWith('gemini-omni') || t === 'omni flash') return 'slates-prompting-omni-flash'
  if (t.startsWith('kling-mc')) return 'slates-prompting-motion-transfer'
  if (t === 'edit-video' || t === 'video-edit' || t === 'edit video' || t === 'video edit') return 'slates-prompting-kling-v3'
  if (t.startsWith('kling-v3')) return 'slates-prompting-kling-v3'
  if (t.startsWith('seedance')) return 'slates-prompting-seedance'
  if (t.startsWith('avatar-') || t.includes('lip-sync')) return 'slates-prompting-lip-sync'
  // Style names → the per-style prompting guide (photoreal/anime/painterly/
  // 3d-render across Seedance/Kling/NB2). Matches the style-library ids plus
  // the obvious spellings users type.
  if (
    t === 'style' ||
    t === 'styles' ||
    t.startsWith('photoreal') ||
    t.startsWith('anime') ||
    t.startsWith('painterly') ||
    t === '3d-render' ||
    t === '3d render' ||
    t === 'comic'
  ) {
    return 'slates-style-prompting'
  }
  return null
}

export const getPromptingGuide: Operation<{ topic: string }> = {
  id: 'slates_get_prompting_guide',
  description:
    "Return the full markdown of a bundled Slates prompting/workflow guide. MCP-only clients (Claude Desktop, Smithery) don't get the CLI-installed skill files — call this instead. Accepts a guide name or a model id (e.g. 'veo-3.1-fast', 'kling-v3.0-pro', 'seedance-2', 'nano-banana-2') which maps to the right guide. ALWAYS read 'slates-cost-discipline' plus the relevant model guide before your first generation in a session.",
  input: z.object({
    topic: z
      .string()
      .min(1)
      .describe(
        'Guide name, model id, or style name. Guides: slates-model-selection (which model for which job — read before choosing any model), slates-cost-discipline, slates-content-policy, slates-style-prompting, slates-prompting-nano-banana-2, slates-prompting-veo-3, slates-prompting-kling-v3, slates-prompting-seedance, slates-prompting-lip-sync, slates-prompting-motion-transfer, slates-prompting-flux-2-max, slates-prompting-seedream-5-lite, slates-edit-and-iterate, slates-vision-feedback-loop, slates-character-identity, slates-storyboard-from-script, slates-direct-response-ad, slates-one-prompt-film. Style names (photoreal, anime, painterly, 3d-render) resolve to slates-style-prompting.'
      ),
  }),
  async run(input) {
    const resolved = resolveGuideTopic(input.topic)
    const content = resolved ? SKILLS[resolved] : undefined
    if (!resolved || content === undefined) {
      throw new Error(
        `Unknown guide topic: ${input.topic}. Valid topics: ${Object.keys(SKILLS).sort().join(', ')}`
      )
    }
    return {
      text: content,
      data: { topic: resolved, bytes: Buffer.byteLength(content, 'utf8') },
    }
  },
}

// ── Aggregation ─────────────────────────────────────────────────

export const ALL_OPERATIONS: ReadonlyArray<Operation<unknown>> = [
  getWorkspaceState as unknown as Operation<unknown>,
  getMe as unknown as Operation<unknown>,
  getCreditBalance as unknown as Operation<unknown>,
  listAvailableModels as unknown as Operation<unknown>,
  estimateGenerationCost as unknown as Operation<unknown>,
  listProjects as unknown as Operation<unknown>,
  createProject as unknown as Operation<unknown>,
  getProject as unknown as Operation<unknown>,
  listAssets as unknown as Operation<unknown>,
  getAssetImage as unknown as Operation<unknown>,
  getAssetsBatch as unknown as Operation<unknown>,
  getAssetVideoFrames as unknown as Operation<unknown>,
  uploadReferenceImage as unknown as Operation<unknown>,
  listFolders as unknown as Operation<unknown>,
  createFolder as unknown as Operation<unknown>,
  moveAssetsToFolder as unknown as Operation<unknown>,
  listCharacters as unknown as Operation<unknown>,
  createCharacter as unknown as Operation<unknown>,
  setCharacterIdentity as unknown as Operation<unknown>,
  listEnvironments as unknown as Operation<unknown>,
  createEnvironment as unknown as Operation<unknown>,
  generateCharacterIdentity as unknown as Operation<unknown>,
  generateEnvironmentPlate as unknown as Operation<unknown>,
  listStoryboards as unknown as Operation<unknown>,
  createStoryboard as unknown as Operation<unknown>,
  getStoryboardWithFrames as unknown as Operation<unknown>,
  addScene as unknown as Operation<unknown>,
  addFrame as unknown as Operation<unknown>,
  generateImage as unknown as Operation<unknown>,
  generateVideo as unknown as Operation<unknown>,
  generateLipSync as unknown as Operation<unknown>,
  generateMotionTransfer as unknown as Operation<unknown>,
  editVideo as unknown as Operation<unknown>,
  trimVideo as unknown as Operation<unknown>,
  editImage as unknown as Operation<unknown>,
  getGenerationStatus as unknown as Operation<unknown>,
  listGenerations as unknown as Operation<unknown>,
  getTimeline as unknown as Operation<unknown>,
  addClipToTimeline as unknown as Operation<unknown>,
  reorderClips as unknown as Operation<unknown>,
  removeClip as unknown as Operation<unknown>,
  addTimelineTrack as unknown as Operation<unknown>,
  updateTimelineTrack as unknown as Operation<unknown>,
  removeTimelineTrack as unknown as Operation<unknown>,
  updateTimelineSettings as unknown as Operation<unknown>,
  exportVideo as unknown as Operation<unknown>,
  exportTimelineXml as unknown as Operation<unknown>,
  revealFile as unknown as Operation<unknown>,
  updateProject as unknown as Operation<unknown>,
  deleteProject as unknown as Operation<unknown>,
  getProjectDirectory as unknown as Operation<unknown>,
  deleteAsset as unknown as Operation<unknown>,
  renameFolder as unknown as Operation<unknown>,
  deleteFolder as unknown as Operation<unknown>,
  setFolderCover as unknown as Operation<unknown>,
  updateCharacter as unknown as Operation<unknown>,
  deleteCharacter as unknown as Operation<unknown>,
  updateEnvironment as unknown as Operation<unknown>,
  deleteEnvironment as unknown as Operation<unknown>,
  listStyles as unknown as Operation<unknown>,
  createStyle as unknown as Operation<unknown>,
  updateStyle as unknown as Operation<unknown>,
  deleteStyle as unknown as Operation<unknown>,
  updateStoryboard as unknown as Operation<unknown>,
  deleteStoryboard as unknown as Operation<unknown>,
  updateScene as unknown as Operation<unknown>,
  deleteScene as unknown as Operation<unknown>,
  reorderScenes as unknown as Operation<unknown>,
  updateFrame as unknown as Operation<unknown>,
  deleteFrame as unknown as Operation<unknown>,
  getPromptingGuide as unknown as Operation<unknown>,
]
