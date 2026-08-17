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
// Per-model prompting tips — the SSOT for the desktop "See prompting tips"
// modals. The desktop renders these; it never hand-writes tips content.
export { PROMPTING_TIPS, getPromptingTips, type PromptingTipsEntry, type PromptingTipCard, type PromptingTipsKey } from './prompts/prompting-tips.js'
