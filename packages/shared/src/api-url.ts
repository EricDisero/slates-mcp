/**
 * The production API host. The one literal in the portfolio: the MCP cloud
 * client and the CLI login import it. The desktop CANNOT — its
 * `src/shared/constants.ts` is bundled into the renderer, which must not reach
 * the barrel (it re-exports `auth.js` → `node:fs`) — so it carries a byte-equal
 * mirror, asserted by `scripts/agent-surface-lockstep-check.mjs` § 10.
 * Kept in its own module so `clients/cloud.ts` can import it without a cycle
 * through the barrel.
 */
export const SLATES_API_URL = 'https://slates-api.fly.dev'
