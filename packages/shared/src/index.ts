export * from './auth.js'
export { SlatesCloudClient, type SlatesUserInfo, type CreditsBalance, type ModelRegistryResponse } from './clients/cloud.js'
export { SlatesDesktopClient, type DesktopHealth } from './clients/desktop.js'
export { SKILLS } from './skills/content.js'
export * as operations from './operations/index.js'
export { ALL_OPERATIONS, VIDEO_MODELS, AUDIO_MODELS, defaultContext, type Operation, type OperationContext, type OperationResult } from './operations/index.js'
// Model routing/prompting facts — the SSOT the desktop Studio Agent system
// prompt derives its MODEL ROUTING doctrine from (kind: image | video | audio,
// default/premium/niche notes). Edit model-facts.ts, never prose copies.
export {
  MODEL_FACTS, getModelFact, multimodalRefSummary, multimodalRefModels,
  // THE routing renderer — the system prompt, the MCP instructions and the
  // generate ops all call this one function, so routing prose exists once.
  describeRouting,
  // Mirrored in slate/src/shared/pricing.ts — see the constant's own header for
  // why the mirror exists and why it must never drive a prompt rewrite.
  SEEDANCE_TASK_INTENT_WORDS, seedanceTaskIntentWords,
  type ModelFact,
} from './prompts/model-facts.js'
// Model CAPABILITY SSOT — what each model will ACCEPT (aspect ratios incl.
// per-provider overrides, video resolutions, duration windows, reference caps).
// `slate/src/shared/pricing.ts` spreads these into every MODEL_REGISTRY entry;
// the op surface validates against them and GENERATES its `.describe()` prose
// from them. Never hand-type a capability fact an LLM will read.
export {
  MODEL_CAPABILITIES, ALL_ASPECT_RATIOS, AGENT_ROUTE_PROVIDER,
  getModelCapability, aspectRatiosFor, videoResolutionsFor, defaultVideoResolutionFor,
  durationsFor, durationValuesFor, aspectRatioUnion, videoResolutionUnion, durationBounds,
  checkAspectRatio, checkVideoResolution, checkDuration,
  describeAspectRatios, describeVideoResolutions, describeDurations, describeReferenceImageCaps,
  type AspectRatio, type VideoResolution, type ModelCapability,
  type DurationCapability, type VideoResolutionCapability,
} from './prompts/model-capabilities.js'
// 🚨 AGENT GUIDANCE SSOT — the working method, the hard rules and the guide
// index, as ONE string both surfaces consume: the desktop Studio Agent's whole
// system prompt (slate/src/main/studio-agent/context.ts) and the MCP server's
// `instructions`. Neither may author doctrine prose of its own; the guidance
// layer drifted for exactly as long as it had no single home.
//
// Exported from the ROOT barrel only, never from ./prompts — that subpath is
// bundled by the desktop RENDERER and must stay small and Node-free, and this
// module pulls in the whole embedded SKILLS record.
// Only what a CONSUMER calls. `buildSkillIndex`, `WORKING_METHOD` and
// `HARD_RULES` are used inside agent-doctrine.ts and by nothing else, so they
// stay off the public surface — an export nothing calls is an export nothing
// keeps honest, which is why `buildModelRouting` was deleted rather than left
// here "in case".
export { buildAgentDoctrine, type AgentSurface } from './prompts/agent-doctrine.js'
// Banned prompt tokens — EXTRACTED from the skills' own never-use lists and
// inlined into the generate ops' descriptions. Enforcement of "load the guide"
// that the model cannot skip, because a description is always in context.
export {
  // BANNED_PROMPT_TOKENS + describeBannedTokens: the lockstep checker and the
  // ops. findBannedTokens: the eval harness scorer. bannedTokenWarning: the ops.
  // `bannedTokensFor` is internal to the module and stays there.
  BANNED_PROMPT_TOKENS, describeBannedTokens,
  findBannedTokens, bannedTokenWarning,
  type BannedToken, type BannedTokenScope,
} from './prompts/banned-tokens.js'
// Per-model prompting tips — the SSOT for the desktop "See prompting tips"
// modals. The desktop renders these; it never hand-writes tips content.
export { PROMPTING_TIPS, getPromptingTips, type PromptingTipsEntry, type PromptingTipCard, type PromptingTipsKey } from './prompts/prompting-tips.js'
