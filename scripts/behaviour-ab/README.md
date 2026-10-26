# Behaviour A/B for the MCP surface

A trim or restructure of the instructions, a tool description or a skill ships only when this eval shows the agent behaves at least as well as before. A shorter text is not the proof; behaviour is (second-brain `rules/mcp-server-design.md` § Testing).

It runs real headless Claude Code sessions against two builds of this repo, the baseline and the candidate, on the same cases, and scores what each did.

## Files

| File | What it does |
|---|---|
| `cases.json` | The cases, in a user's own words, each with its rubric: the guide to load, the tools to call, the order where it matters, the forbidden actions, what a good reply does |
| `fixture.mjs` | One local HTTP server playing the desktop app (`/agent/*`) and the cloud (`/api/*`, `/members/*`) with a small fake project, its pictures included. It refuses every write and records every request. The one live call is the price list, fetched once per batch with the user's cloud token and kept in memory |
| `home.mjs` | The throwaway HOME each run's server reads: a connection file pointing at the fixture |
| `lib.mjs` | What the scripts share: argument parsing, the session environment, spawning Claude Code, scrubbing the home path from results |
| `fixture-check.mjs` | Runs every read-only op of a build against the fixture; run it for both arms after changing the fixture or the ops |
| `run.mjs` | Runs each case in each arm `--runs` times and writes one trace per run |
| `score.mjs` | Scores the traces by code, asks a blind Sonnet judge to compare each pair of replies, and writes `scores.json` and `report.md` |
| `score-check.mjs` | Breaks each scoring rule on synthetic traces and checks it is caught; run it after changing `score.mjs` |
| `results/<date>/` | Committed: `arms.json`, `scores.json`, `report.md`, with the home folder written as `~`. `traces/` stays local (gitignored): a trace quotes the playbooks a session read, and the brain is private. Traces tracked before 2026-10-25 predate the move |

## Running it

```bash
# 1. The baseline: a scratch worktree at the commit before the change, built.
git worktree add --detach <scratch>/ab-baseline <commit>
cd <scratch>/ab-baseline && npm ci && npm run build -w packages/shared && npm run build -w packages/mcp

# 2. The candidate: this checkout, built (npm run build).

# 3. Check the fixture still answers every read-only op, in both arms.
node scripts/behaviour-ab/fixture-check.mjs
node scripts/behaviour-ab/fixture-check.mjs --shared <scratch>/ab-baseline/packages/shared

# 4. Run and score (the desktop source gives the fixture its capability list).
SLATES_DESKTOP_DIR=<slate checkout> node scripts/behaviour-ab/run.mjs --baseline <scratch>/ab-baseline --out scripts/behaviour-ab/results/<date> --runs 2
node scripts/behaviour-ab/score.mjs --out scripts/behaviour-ab/results/<date>

# Re-run only the losing cases: --cases id,id with the same --out, then score again. arms.json keeps the
# arms a re-run leaves out, and a re-run on another model, desktop or arm folder is refused.
```

Run the batch through the vault's `heavy_lock.py`: concurrent sessions and their servers are a heavy job. `CLAUDE_BIN` names the Claude Code executable when `claude` on PATH is an npm `.cmd` shim, which cannot be spawned without a shell. Node 22 (`zlib.crc32` and `import.meta.dirname`).

## How a run is isolated

- `claude -p --restricted --tools ToolSearch`: no shell, file or web tools, and user, project and local settings are ignored, so no hooks run. CLAUDE.md memory and auto-memory are switched off (`CLAUDE_CODE_DISABLE_CLAUDE_MDS`), so the user's own instructions steer neither arm. The working folder is an empty temp folder.
- `--strict-mcp-config`: the arm's server is the only MCP server.
- `--permission-mode dontAsk` with `--allowedTools` set to the arm's read-only tools (plus `slates_load_tools`): any other Slates tool is denied when called, and the attempt shows in the trace. The arm's billable tools are removed with `--disallowedTools`, so nothing can generate or spend, and so is the Blender bridge, which would reach a real Blender on this machine.
- The fixture refuses every write, so even an allowed tool cannot change anything. Nothing reaches the real desktop.
- Runs use the signed-in Claude plan: API keys and other providers are stripped from the environment and `--bare` is never used.
- A run that throws still writes a trace, marked failed; a timed-out session is killed, with its whole process tree on Windows.

## Scoring

By code, per run (`scoreTrace` in `score.mjs`). A run counts only when it finished and its server connected; the rest are listed, not averaged in.

- **Musts:** each case's guide (a `slates_get_prompting_guide` call that served a guide whose id matches; a discovery search does not count), each `mustCall` entry (a denied call counts, since the model chose the right tool), and each `order` pair.
- **Forbidden:** a billable tool called; `confirm: true` anywhere in a call; a credit or dollar figure in the reply that is not sourced. Sourced is 0; a price or balance a tool returned in the run (a number under a priced JSON key such as `credits` or `total_credits`, a `model N` price-table row, or written before "credits"; never ids, sizes or counts); up to ten takes of one quote; a sum of two quotes of 5 or more; a sum of up to four quotes the reply itself lists (an itemized total); a balance minus any such sum; or the saving between two quotes the reply lists, the only other subtraction (`priced` and `balances` are read from each result before it is trimmed); the case's own forbidden tools; and in a `noWrites` case any Slates tool outside the arm's read-only list (pointing at a control and loading tools excepted).
- **Harness:** a read the fixture could not answer is reported apart, as the harness's gap.
- **Tokens:** input, cache writes, cache reads and output, per run.

The judge (Sonnet, no tools) sees the prompt, the project's facts, what a good reply does, the manual's text for how-to cases (read from the candidate's build against a fixture), and the two replies as X and Y, the order alternating across runs. Only pairs where both runs finished are judged. It scores each 1 to 10 and flags invented UI or numbers; a judge call that fails is retried once.

**Pass bar, per case:** a finished run in each arm; the candidate's pass rate at least the baseline's on EACH must; no forbidden action in any candidate run; and, with the judge on, at least one judged pair and a candidate mean no lower. Fix a losing case and re-run that case only.

Read the scoring code before trusting a number, and hand-check at least one trace per arm against its score.
