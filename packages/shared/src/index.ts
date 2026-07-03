export * from './auth.js'
export { SlatesCloudClient, type SlatesUserInfo, type CreditsBalance, type ModelRegistryResponse } from './clients/cloud.js'
export { SlatesDesktopClient, type DesktopHealth } from './clients/desktop.js'
export { SKILLS } from './skills/content.js'
export * as operations from './operations/index.js'
export { ALL_OPERATIONS, VIDEO_MODELS, defaultContext, type Operation, type OperationContext, type OperationResult } from './operations/index.js'
// Model routing/prompting facts — the SSOT the desktop Studio Agent system
// prompt derives its MODEL ROUTING doctrine from (kind: image vs video,
// default/premium/niche notes). Edit model-facts.ts, never prose copies.
export { MODEL_FACTS, getModelFact, type ModelFact } from './prompts/model-facts.js'
