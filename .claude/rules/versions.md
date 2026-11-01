---
paths:
  - "packages/mcp/src/server.ts"
  - "packages/shared/src/update-check.ts"
  - "packages/shared/src/auth.ts"
  - "packages/shared/src/clients/desktop.ts"
---

# Which server version a tool runs

How a tool's Slates MCP server learns it is behind, and why it is never behind the desktop app.

## The version handshake (2026-09-13)

`packages/shared/src/update-check.ts` is the one place either published entry point learns it is behind: one registry GET an hour, cached in `~/.slates/update-check.json`,
fail-silent everywhere. The MCP server reads the cache SYNCHRONOUSLY at construction and opens its
`instructions` with `Slates MCP server vX.Y.Z` (so an agent can answer "what version") plus an
`UPDATE AVAILABLE` notice when behind; the refresh runs after connect, for the next launch. The CLI awaits the
bounded refresh in a `preAction` hook and prints to STDERR; `slates doctor` has a `CLI version` row. Why: a
user's agent said "H3 isn't exposed" from a server older than 0.5.10, and nothing had told either of them.
Lockstep check 2 pins the composed `instructions` array by member name; the shared build runs
`scripts/update-check-check.mjs`; `mcp-instructions-smoke.mjs` spawns a second server with a temp HOME whose
cache claims 99.0.0 and reads the notice back. The app's own copy shows no notice: the app's update is its update.

## The app's own copy, and the handoff (2026-10-31)

Since slate 1.6.5 the app bundles `@slatesvideo/mcp-server` (exact devDependency; `slate/scripts/bundle-mcp-server.mjs`)
and runs it with its own binary as Node, so a tool's server is always the app's version: updating the app is the
update. The app writes `~/.slates/mcp-server.json` (`readMcpLauncher()` in `auth.ts`; its own file because older
CLIs rewrite the connection file and drop fields), and `handOffToApp()` in `server.ts` makes any copy with no
`src/` beside its `dist/` (npm global or npx, the `.mcpb`, a pinned plugin) start that launcher on the same stdio.
`SLATES_MCP_BUNDLED=1` marks the app's copy: no update notice, and the version line reads "(inside the Slates
app)". Every desktop request carries `X-Slates-Client` (`setDesktopClientIdentity`), which is how the app flags a
tool on an older server. Why: a customer's Claude Code ran a stale global install that lacked the transition
tools while his app had them (2026-10-31); unpinned npx alone could not stop a global or local install winning.
