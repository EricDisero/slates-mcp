# Slates MCP — Testing Runbook

Ordered checklist to verify the entire slates-api → slate desktop → slates-mcp pipeline before any deploy or publish. Work top-to-bottom; don't skip steps.

**Prerequisites:**
- Slates desktop running locally in `npm run dev` (NOT the packaged release).
- slates-api running locally on `localhost:3000` per the three-terminal setup in `slates-api/CLAUDE.md`.
- Logged in to slates-api with a magic-link session (i.e., the local Slates desktop has a session token already).

If those aren't true, get them true first.

---

## Phase 0 — Run the migration locally

```bash
cd "C:\Coding Projects\slates\slates-api"
# Make sure Terminal 1 has fly proxy 15432:5432 -a slates-db running.
npm run db:migrate
```

**Expected:** No errors. Migrations 0018 applies. To verify the table:

```bash
# Connect to the production-staging DB through the fly proxy tunnel.
psql postgresql://postgres:$DB_PASSWORD@localhost:15432/postgres -c "\d slates_api_keys"
```

Should print the columns: `id`, `user_id`, `key_hash`, `name`, `scopes`, `last_used_at`, `created_at`, `revoked_at`.

If you don't want to apply the migration to staging yet, that's fine — every local test below will still work. Just be aware that `/auth/agent/poll` will 503 until the table exists, because the magic-link callback inserts a row.

---

## Phase 1 — Boot slates-api and verify routes

In Terminal 2 (slates-api):

```bash
cd "C:\Coding Projects\slates\slates-api"
npm run dev
```

Wait for `slates-api running on 0.0.0.0:3000`.

**Hit the new routes from Terminal 4:**

```bash
# Health check (no auth) — confirms server up
curl http://localhost:3000/health

# Agent OAuth start (sends a magic link to your email)
curl -X POST http://localhost:3000/auth/agent/request \
  -H "Content-Type: application/json" \
  -d '{"email":"ericdisero@gmail.com","client_name":"local-test"}'
# Expect: {"success":true,"challengeId":"<uuid>"}
```

**Save the `challengeId`. Click the magic link in your email.** Then:

```bash
curl "http://localhost:3000/auth/agent/poll?challengeId=<paste-id-here>"
# Expect: {"status":"completed","token":"slates_sk_<hex>"}
```

**Save the token as `$SLATES_TOKEN` (or paste it manually in the next steps).**

Test the agent namespace:

```bash
curl http://localhost:3000/api/agent/me \
  -H "Authorization: Bearer $SLATES_TOKEN"
# Expect: {"success":true,"user":{...},"scopes":["mcp:full"]}

curl http://localhost:3000/api/agent/credits/balance \
  -H "Authorization: Bearer $SLATES_TOKEN"
# Expect: {"success":true,"credit_balance_cents":NNN,"credit_balance_dollars":"X.XX"}

curl http://localhost:3000/api/agent/models \
  -H "Authorization: Bearer $SLATES_TOKEN"
# Expect: {"success":true,"credit_markup":1.5,"models":[...]}
```

**If all three pass: cloud side is good.**

---

## Phase 2 — Slate desktop agent server

Open Slate desktop (running via `npm run dev` in Terminal 3). Settings → **Agent Control** accordion.

1. Toggle **Local HTTP server** ON. Status indicator should say "Listening on 127.0.0.1:27272". Last request: never.
2. Confirm `~/.slates/agent-connection.json` exists. On Windows: `%USERPROFILE%\.slates\agent-connection.json`.
   ```bash
   cat ~/.slates/agent-connection.json
   ```
   Expected fields: `desktop.enabled=true`, `desktop.port=27272` (or scanned fallback), `desktop.token="<hex>"`, `cloud.token=null` (until next step).
3. In the same Settings panel, **Connect Claude Code:** enter your email and click **Send link**. Click the link in your email.
4. Status flips to **Connected**. Re-read the connection file — `cloud.token` is now `slates_sk_...`.

Test the local server with the desktop token:

```bash
# Replace PORT and TOKEN with values from agent-connection.json
curl http://127.0.0.1:27272/agent/healthz
# Expect: {"ok":true,"service":"slates-agent"}

curl http://127.0.0.1:27272/agent/projects \
  -H "Authorization: Bearer <DESKTOP_TOKEN>"
# Expect: {"success":true,"projects":[...]}

# Confirm Origin/Host gate — this should be REJECTED (403)
curl http://127.0.0.1:27272/agent/projects \
  -H "Authorization: Bearer <DESKTOP_TOKEN>" \
  -H "Origin: https://example.com"
# Expect: 403 with "Cross-origin requests rejected"
```

If a project list returns and the Origin gate trips: desktop side is good.

---

## Phase 3 — Run the smoke-test script

The script at [`scripts/smoke-test.ps1`](scripts/smoke-test.ps1) runs the full sequence end-to-end against your live local setup. From the `slates-mcp` directory:

```powershell
cd "C:\Coding Projects\slates\slates-mcp"
.\scripts\smoke-test.ps1
```

Reads the connection file, runs cloud + desktop probes, runs the built CLI, prints pass/fail per check. Should be all-green if Phases 1 and 2 worked.

---

## Phase 4 — CLI sanity from a fresh shell

In a NEW terminal (so `~/.slates/agent-connection.json` is the only auth source):

```bash
cd "C:\Coding Projects\slates\slates-mcp"
node packages/cli/dist/index.js status
# Expect: cloud token present, desktop server enabled, license active, balance > 0

node packages/cli/dist/index.js run --list
# Expect: 26 operations listed

node packages/cli/dist/index.js run slates_list_projects
# Expect: {"projects":[...]} — should match what Slates UI shows

node packages/cli/dist/index.js run slates_get_credit_balance
# Expect: {"credit_balance_cents":NNN,...}

# Round-trip: create a test project, then verify it appears in Slates UI
node packages/cli/dist/index.js run slates_create_project --name "MCP smoke test"
# In Slates desktop, the new project should appear LIVE in the project list.
```

Delete the test project either via the desktop UI or:

```bash
node packages/cli/dist/index.js run slates_get_project --id <uuid-from-create>
```

---

## Phase 5 — MCP server in Claude Desktop

Add this to your Claude Desktop MCP config (typically `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "slates-video": {
      "command": "node",
      "args": ["C:\\Coding Projects\\slates\\slates-mcp\\packages\\mcp\\dist\\server.js"]
    }
  }
}
```

Restart Claude Desktop. Open a new chat. The hammer icon should show 26 Slates tools (`slates_list_projects`, `slates_create_project`, ..., `slates_generate_image`).

Test in chat:
> "List my Slates projects."

Claude should call `slates_list_projects`, return results, and you should see them inline.

> "Create a Slates project called 'Claude desktop smoke test'."

Claude calls `slates_create_project`. The project appears live in the Slates desktop app.

> "What's my credit balance?"

Claude calls `slates_get_credit_balance`. Returns dollars.

**If those three work in Claude Desktop: the full pipeline is verified.**

---

## Phase 6 — Pre-publish checks (do NOT publish yet)

Before any `npm publish`:

```bash
cd "C:\Coding Projects\slates\slates-mcp"

# Verify scope ownership
npm whoami                 # should show your npm username
npm org ls slatesvideo     # if you own the scope, lists members; otherwise errors

# Dry-run publishes — confirm no auth/scope issues
npm publish --dry-run -w packages/shared
npm publish --dry-run -w packages/mcp
npm publish --dry-run -w packages/cli
```

If `npm org ls slatesvideo` errors with "scope not found", create the org first:

```bash
npm org create slatesvideo
```

Or publish with `--access public` flag on the first publish (creates the scope for you on free accounts only if no existing org).

**Do NOT actually publish until every test above is green.**

---

## Phase 7 — Pre-deploy checks (slates-api → Fly)

The slates-api changes are additive (new routes, new table, no schema changes to existing tables). Before `fly deploy`:

```bash
cd "C:\Coding Projects\slates\slates-api"

# Apply the migration to PRODUCTION DB
# (still through the local fly proxy tunnel — same as local migration)
npm run db:migrate
# Expect: 0018_slates_api_keys applied. Other migrations idempotent.

# Verify production has the table (one-off psql)
psql postgresql://postgres:$DB_PASSWORD@localhost:15432/postgres -c "SELECT count(*) FROM slates_api_keys;"
# Expect: 0

# Deploy
fly deploy
```

After deploy:

```bash
# Hit production agent routes — should work without code changes once migration is applied
curl https://slates-api.fly.dev/auth/agent/request \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"ericdisero@gmail.com"}'
# Expect: {"success":true,"challengeId":"..."}
```

---

## Phase 8 — Pre-release checks (slate desktop)

Only after Phases 1-7 are green, you've used the agent flow against production for at least a day, and nothing about existing Slates UX regressed:

1. Bump `slate/package.json` version (e.g., 1.1.4 → 1.2.0 for the agent-control feature).
2. Commit (manually).
3. `gh workflow run release.yml -f version=1.2.0` — both platforms.
4. Wait for the draft GitHub Release. Smoke-test the installers on a clean machine. Publish.

---

## Rollback notes

- **slates-api:** `fly deploy --image-label vNNN` to a pre-agent-control image. Migrations are non-destructive, no rollback needed for schema.
- **slate desktop:** existing released version doesn't talk to the new agent endpoints. If the new release has issues, users can downgrade by reinstalling the previous DMG/EXE; the auto-updater takes them back up next launch unless you remove the new release first.
- **slates-mcp:** `npm unpublish` within 72 hours of publish; after that, `npm deprecate` is the only option. Don't publish to npm until you're confident.
