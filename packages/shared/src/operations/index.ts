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
    text: text ?? JSON.stringify(data, null, 2),
    data,
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
  description: 'Current Slates credit balance, in cents and dollars. Call before any generation that costs credits.',
  input: z.object({}).strict(),
  async run(_input, ctx) {
    const r = await ctx.cloud().get<CreditsBalance>('/api/agent/credits/balance')
    return ok(r)
  },
}

export const listAvailableModels: Operation<Record<string, never>> = {
  id: 'slates_list_available_models',
  description: 'Full registry of generation models with their per-call credit cost. Use this for cost estimation.',
  input: z.object({}).strict(),
  async run(_input, ctx) {
    const r = await ctx.cloud().get<ModelRegistryResponse>('/api/agent/models')
    return ok(r)
  },
}

export const estimateGenerationCost: Operation<{ model: string; quantity?: number }> = {
  id: 'slates_estimate_generation_cost',
  description:
    'Pre-flight cost estimate. Call before any generate_* op so the user sees "this will cost N credits" up front. Pairs with the >$0.50 confirm gate.',
  input: z.object({
    model: z.string().describe('Model id, e.g. "nano-banana-2-2k" or "veo-3.1-fast-8s"'),
    quantity: z.number().int().min(1).max(10).optional().describe('Number of generations (default 1)'),
  }),
  async run(input, ctx) {
    const registry = await ctx.cloud().get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === input.model)
    if (!entry) {
      throw new Error(`Unknown model: ${input.model}. Use slates_list_available_models to see options.`)
    }
    const qty = input.quantity ?? 1
    const totalCents = entry.cost_cents * qty
    return ok({
      model: input.model,
      quantity: qty,
      cost_per_cents: entry.cost_cents,
      total_cents: totalCents,
      total_dollars: (totalCents / 100).toFixed(2),
      requires_confirm: totalCents > 50,
    })
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

export const listAssets: Operation<{ projectId: string }> = {
  id: 'slates_list_assets',
  description: 'List all assets (images + videos) in a Slates project.',
  input: z.object({ projectId: z.string().uuid() }),
  async run(input, ctx) {
    const r = await ctx.desktop().get<{ assets: unknown[] }>('/agent/assets', {
      projectId: input.projectId,
    })
    return ok(r)
  },
}

export const getAssetImage: Operation<{ id: string; fullRes?: boolean }> = {
  id: 'slates_get_asset_image',
  description:
    'Read an asset image off disk and return it inline as base64. Used for vision: the calling LLM sees the actual pixels. Default JPEG 85% ≤1024px long-edge for token economy. Pass fullRes=true for the original PNG.',
  input: z.object({
    id: z.string().uuid(),
    fullRes: z.boolean().optional(),
  }),
  async run(input, ctx) {
    const r = await ctx.desktop().get<{
      asset_id: string
      file_path: string
      data: string
      mimeType: string
      bytes: number
    }>('/agent/assets/image', { id: input.id, fullRes: input.fullRes ?? false })
    return {
      text: `Loaded asset ${r.asset_id} (${r.bytes} bytes, ${r.mimeType}) from ${r.file_path}`,
      images: [{ data: r.data, mimeType: r.mimeType }],
      data: { asset_id: r.asset_id, file_path: r.file_path, bytes: r.bytes, mimeType: r.mimeType },
    }
  },
}

export const uploadReferenceImage: Operation<{
  projectId: string
  filePath?: string
  dataUrl?: string
}> = {
  id: 'slates_upload_reference_image',
  description:
    'Add a reference image to a Slates project. Pass either filePath (absolute path to a local file) or dataUrl (base64 data: URL) — exactly one.',
  input: z
    .object({
      projectId: z.string().uuid(),
      filePath: z.string().optional(),
      dataUrl: z.string().optional(),
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
        type: 'image',
      })
      return ok(r)
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
  style?: 'realistic' | 'anime' | 'pixar' | 'comic-book'
}> = {
  id: 'slates_create_character',
  description: 'Create a new character in a Slates project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    style: z.enum(['realistic', 'anime', 'pixar', 'comic-book']).optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/characters', input))
  },
}

export const setCharacterTurnaround: Operation<{ characterId: string; assetId: string | null }> = {
  id: 'slates_set_character_turnaround_asset',
  description:
    'Bind an image asset to the character\'s turnaround slot (or clear with assetId=null). The user sees the character card update live.',
  input: z.object({
    characterId: z.string().uuid(),
    assetId: z.string().uuid().nullable(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/characters/update', {
        id: input.characterId,
        data: { turnaroundAssetId: input.assetId },
      })
    )
  },
}

export const setCharacterExpression: Operation<{ characterId: string; assetId: string | null }> = {
  id: 'slates_set_character_expression_asset',
  description:
    'Bind an image asset to the character\'s expression-sheet slot (or clear with assetId=null).',
  input: z.object({
    characterId: z.string().uuid(),
    assetId: z.string().uuid().nullable(),
  }),
  async run(input, ctx) {
    return ok(
      await ctx.desktop().post('/agent/characters/update', {
        id: input.characterId,
        data: { expressionAssetId: input.assetId },
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
  style?: 'realistic' | 'anime' | 'pixar' | 'comic-book'
}> = {
  id: 'slates_create_environment',
  description: 'Create a new environment in a Slates project.',
  input: z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    style: z.enum(['realistic', 'anime', 'pixar', 'comic-book']).optional(),
  }),
  async run(input, ctx) {
    return ok(await ctx.desktop().post('/agent/environments', input))
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

// ── Generation (cloud-routed, credits-default) ──────────────────

export const generateImage: Operation<{
  prompt: string
  projectId?: string
  resolution?: '1k' | '2k' | '4k'
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '4:5' | '5:4' | '2:3' | '3:2'
  count?: number
  referenceImageUrls?: string[]
  confirm?: boolean
}> = {
  id: 'slates_generate_image',
  description:
    'Generate an image via Slates credits using Nano Banana 2 (Google Gemini 3 Image). Pass projectId to save into a Slates project (recommended — asset appears live in the desktop UI). REQUIRED before calling: read the slates-cost-discipline and slates-prompting-nano-banana-2 skills. You MUST pass aspectRatio and resolution explicitly (the server returns requires_clarification when missing — defaults waste credits). Cost > $0.50 returns requires_confirm — pass confirm=true after explicit user OK. MCP/CLI generation always charges credits.',
  input: z.object({
    prompt: z.string().min(1).max(4000),
    projectId: z.string().uuid().optional().describe('Save into this Slates project. Renderer refreshes live.'),
    resolution: z.enum(['1k', '2k', '4k']).optional().describe('Pick deliberately: 1k drafts, 2k hero shots, 4k print/final. Same fal.ai price band — never default this.'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '4:5', '5:4', '2:3', '3:2']).optional().describe('Pick deliberately from the use case. Cinematic → 16:9. TikTok/Reels/Story → 9:16. IG square → 1:1. Ultra-wide → 21:9. Ask the user when ambiguous.'),
    count: z.number().int().min(1).max(4).optional(),
    referenceImageUrls: z.array(z.string().url()).max(14).optional().describe('Up to 14 ref URLs (10 object + 4 character split). Always label each image\'s role in the prompt text per slates-prompting-nano-banana-2 skill.'),
    confirm: z.boolean().optional().describe('Set true to bypass the >$0.50 cost confirm gate.'),
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
    const model = `nano-banana-2-${resolution}`
    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const entry = registry.models.find((m) => m.model === model)
    if (!entry) throw new Error(`Model not in registry: ${model}`)
    const totalCents = entry.cost_cents * (input.count ?? 1)
    if (totalCents > 50 && !input.confirm) {
      return ok({
        requires_confirm: true,
        model,
        estimated_cents: totalCents,
        estimated_dollars: (totalCents / 100).toFixed(2),
        message:
          'Cost exceeds $0.50. Re-call with confirm=true to proceed, or pick a smaller resolution / count.',
      })
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
        asset?: Record<string, unknown>
        assets?: Array<Record<string, unknown>>
        generationId?: string
        generationIds?: string[]
        error?: string
      }>('/agent/generation/image', {
        projectId: input.projectId,
        prompt: input.prompt,
        resolution,
        aspectRatio: input.aspectRatio ?? '1:1',
        count: input.count ?? 1,
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Generation failed')
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
      return {
        text:
          `Generated ${assetList.length} image(s) into project ${input.projectId} ` +
          `for $${(totalCents / 100).toFixed(2)} (${totalCents}¢). ` +
          `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
        images,
        data: {
          model,
          projectId: input.projectId,
          aspectRatio: input.aspectRatio,
          resolution,
          cost_cents: totalCents,
          cost_dollars: (totalCents / 100).toFixed(2),
          assets: assetList,
          generationIds: result.generationIds ?? (result.generationId ? [result.generationId] : []),
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
      model,
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
        `Generated ${urls.length} image(s) for $${(totalCents / 100).toFixed(2)} (${totalCents}¢). ` +
        `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
      images,
      data: {
        urls,
        model,
        aspectRatio: input.aspectRatio,
        resolution,
        cost_cents: totalCents,
        cost_dollars: (totalCents / 100).toFixed(2),
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

// ── Generate video ──────────────────────────────────────────────

const VIDEO_MODELS = [
  'kling-v3.0-std',
  'kling-v3.0-pro',
  'kling-v3.0-omni',
  'veo-3.1-fast',
  'veo-3.1-standard',
  'seedance-2-fast',
  'seedance-2-std',
] as const

type VideoModel = (typeof VIDEO_MODELS)[number]

// Model → registry cost-key. Each provider's keys ship with their own
// shape (verified against /api/agent/models):
//   Kling: kling-v3-{standard|pro|omni}-{N}s — note the user-facing
//     model id `kling-v3.0-std` maps to registry key `kling-v3-standard`.
//   Veo:   veo-3.1-{fast|standard}[-4k]-{N}s[-audio]
//   Seedance: seedance-2-{fast|std}-{N}s — no tier suffix in registry.
//     Economy vs Priority routes through different providers but the
//     credit-charged price is the same in the current registry.
const KLING_TIER_MAP: Record<string, string> = {
  'kling-v3.0-std': 'kling-v3-standard',
  'kling-v3.0-pro': 'kling-v3-pro',
  'kling-v3.0-omni': 'kling-v3-omni',
}

function videoCostKey(input: {
  model: VideoModel
  duration: number
  videoResolution?: '720p' | '1080p' | '4k'
  sound?: boolean
}): string {
  if (input.model.startsWith('seedance')) {
    return `${input.model}-${input.duration}s`
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
    const tier = KLING_TIER_MAP[input.model] ?? input.model
    return `${tier}-${input.duration}s`
  }
  throw new Error(`Unknown video model: ${input.model}`)
}

export const generateVideo: Operation<{
  prompt: string
  model: VideoModel
  projectId?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '4:5' | '5:4' | '2:3' | '3:2'
  duration?: number
  videoResolution?: '720p' | '1080p' | '4k'
  seedanceSpeed?: 'economy' | 'priority'
  firstFrameAssetId?: string
  lastFrameAssetId?: string
  ingredientAssetIds?: string[]
  sound?: boolean
  audioLanguage?: 'EN' | 'ZH' | 'JA' | 'KO' | 'ES'
  generateMusic?: boolean
  negativePrompt?: string
  confirm?: boolean
}> = {
  id: 'slates_generate_video',
  description:
    'Generate video via Slates credits. REQUIRED before calling: read the slates-cost-discipline skill plus the per-model prompting skill (slates-prompting-seedance / slates-prompting-kling-v3 / slates-prompting-veo-3.1) — video models prompt very differently. projectId is REQUIRED for UI integration (the user sees a progress card and the asset lands in the project — without it the call fails). aspectRatio + duration are required (server returns requires_clarification when missing). Cost > $0.50 returns requires_confirm — pass confirm=true after explicit user OK. Veo locks to 16:9. Image-to-video via firstFrameAssetId. Frames-to-video via firstFrameAssetId + lastFrameAssetId (Veo / Seedance only). Ingredients via ingredientAssetIds (Kling Omni / Seedance).',
  input: z.object({
    prompt: z.string().min(1).max(4000),
    model: z.enum(VIDEO_MODELS).describe('Pick deliberately. Kling V3.0 std = $0.05/s (cheapest, no audio). Pro = $0.08/s. Omni = $0.16/s (multi-char dialogue + audio). Veo 3.1 fast = $0.225/s, standard = higher. Seedance 2 = ByteDance, includes audio, supports first+last frame.'),
    projectId: z.string().uuid().optional().describe('Save into this Slates project. Strongly recommended — the desktop UI shows a progress card live and the asset appears when complete.'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '4:5', '5:4', '2:3', '3:2']).optional().describe('Veo locks to 16:9 — passing anything else will be ignored or fail. Kling/Seedance support all.'),
    duration: z.number().int().min(4).max(15).optional().describe('Seconds. Kling: 5-15. Veo: 6/8/10. Seedance: 4-15. Default 5 if omitted but always be explicit (cost scales linearly).'),
    videoResolution: z.enum(['720p', '1080p', '4k']).optional().describe('Veo only. 720p / 1080p same price. 4k more expensive.'),
    seedanceSpeed: z.enum(['economy', 'priority']).optional().describe('Seedance only. Economy via PiAPI (cheaper, slower). Priority via fal.ai (faster).'),
    firstFrameAssetId: z.string().uuid().optional().describe('Asset id from the project — used as the starting frame for image-to-video. Must already exist in the project.'),
    lastFrameAssetId: z.string().uuid().optional().describe('Asset id from the project — used as the ending frame. Veo and Seedance only. Pairs with firstFrameAssetId for guided transitions.'),
    ingredientAssetIds: z.array(z.string().uuid()).max(9).optional().describe('Asset ids used as visual reference / ingredients for Kling Omni or Seedance. Up to 9 (Seedance) or 4 (Kling).'),
    sound: z.boolean().optional().describe('Kling Omni / Veo / Seedance: enable audio generation. Default true.'),
    audioLanguage: z.enum(['EN', 'ZH', 'JA', 'KO', 'ES']).optional().describe('Kling Omni only — language for dialogue.'),
    generateMusic: z.boolean().optional().describe('Kling Omni only — auto-generate background music.'),
    negativePrompt: z.string().optional(),
    confirm: z.boolean().optional().describe('Set true after explicit user OK to bypass the >$0.50 cost confirm gate (which fires for almost every video gen since they\'re expensive).'),
  }),
  async run(input, ctx) {
    // projectId is required for video — without it there's no UI feedback,
    // no asset to reference later, and a failed gen leaves the user with
    // nothing. The MCP-only headless path that exists for image gen is
    // not reasonable for video given the cost.
    if (!input.projectId) {
      return ok({
        requires_clarification: true,
        missing: ['projectId'],
        message:
          'projectId is required for video generation. Use slates_list_projects to find one or slates_create_project to make a new one. Video gens cost $0.50-$2.00+ per call — they need to land in a project so the user sees the progress card and the result.',
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
          `Read the slates-cost-discipline + slates-prompting-${input.model.split('-')[0]} skills, ` +
          `or ask the user. Veo locks to 16:9. Kling/Seedance support 1:1 16:9 9:16 4:3 3:4 21:9. ` +
          `Duration: Kling 5-15s, Veo 6/8/10s, Seedance 4-15s. Cost scales linearly with duration.`,
      })
    }

    const cloud = ctx.cloud()
    const registry = await cloud.get<ModelRegistryResponse>('/api/agent/models')
    const costKey = videoCostKey({
      model: input.model,
      duration: input.duration,
      videoResolution: input.videoResolution,
      sound: input.sound,
    })
    const entry = registry.models.find((m) => m.model === costKey)
    if (!entry) {
      throw new Error(
        `Model variant not in registry: ${costKey}. ` +
          `Available video models: ${registry.models.filter((m) => m.model.startsWith('kling') || m.model.startsWith('veo') || m.model.startsWith('seedance')).map((m) => m.model).slice(0, 20).join(', ')}`
      )
    }
    const totalCents = entry.cost_cents
    if (totalCents > 50 && !input.confirm) {
      return ok({
        requires_confirm: true,
        model: input.model,
        variant: costKey,
        estimated_cents: totalCents,
        estimated_dollars: (totalCents / 100).toFixed(2),
        message:
          `Cost: $${(totalCents / 100).toFixed(2)} for ${input.duration}s of ${input.model}. ` +
          `Re-call with confirm=true after the user explicitly OKs the spend, or pick a cheaper model / shorter duration.`,
      })
    }

    const desktop = ctx.desktop()
    const result = await desktop.post<{
      success: boolean
      asset?: Record<string, unknown>
      generationId?: string
      error?: string
    }>('/agent/generation/video', {
      projectId: input.projectId,
      model: input.model,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      videoResolution: input.videoResolution,
      seedanceSpeed: input.seedanceSpeed,
      firstFrameAssetId: input.firstFrameAssetId,
      lastFrameAssetId: input.lastFrameAssetId,
      ingredientAssetIds: input.ingredientAssetIds ?? [],
      sound: input.sound,
      audioLanguage: input.audioLanguage,
      generateMusic: input.generateMusic,
      negativePrompt: input.negativePrompt,
    })
    if (!result.success) {
      throw new Error(result.error ?? 'Generation failed')
    }
    return {
      text:
        `Generated ${input.duration}s ${input.model} video into project ${input.projectId} ` +
        `for $${(totalCents / 100).toFixed(2)} (${totalCents}¢). ` +
        `Prompt: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
      data: {
        model: input.model,
        variant: costKey,
        projectId: input.projectId,
        aspectRatio: input.aspectRatio,
        duration: input.duration,
        cost_cents: totalCents,
        cost_dollars: (totalCents / 100).toFixed(2),
        asset: result.asset,
        generationId: result.generationId,
      },
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
  uploadReferenceImage as unknown as Operation<unknown>,
  listFolders as unknown as Operation<unknown>,
  createFolder as unknown as Operation<unknown>,
  moveAssetsToFolder as unknown as Operation<unknown>,
  listCharacters as unknown as Operation<unknown>,
  createCharacter as unknown as Operation<unknown>,
  setCharacterTurnaround as unknown as Operation<unknown>,
  setCharacterExpression as unknown as Operation<unknown>,
  listEnvironments as unknown as Operation<unknown>,
  createEnvironment as unknown as Operation<unknown>,
  listStoryboards as unknown as Operation<unknown>,
  createStoryboard as unknown as Operation<unknown>,
  getStoryboardWithFrames as unknown as Operation<unknown>,
  addScene as unknown as Operation<unknown>,
  addFrame as unknown as Operation<unknown>,
  generateImage as unknown as Operation<unknown>,
  generateVideo as unknown as Operation<unknown>,
]
