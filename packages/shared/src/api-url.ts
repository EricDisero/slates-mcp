/**
 * The production API host. The one literal in the portfolio; every client
 * imports it (the MCP cloud client, the CLI login, and the desktop once its
 * `@slatesvideo/shared` dependency is bumped to a version carrying it).
 * Kept in its own module so `clients/cloud.ts` can import it without a cycle
 * through the barrel.
 */
export const SLATES_API_URL = 'https://slates-api.fly.dev'
