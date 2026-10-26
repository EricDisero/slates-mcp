# Brain evals

The skills are one layered brain (second-brain `plans/2026-10-25-slates-brain.md`): the Director card and the router in `slates-start-here`, a playbook per job, the rules and model guides they link. These evals check that the layers route a job, teach the craft and stay small; `brain-lint.mjs` (in the build) holds the shape.

**When to run them (Eric, 2026-10-25: a full batch is heavy plan usage, so only before a brain release).** The full batch (routing, every craft case, the behaviour A/B, both arms) runs once, right before a brain change reaches users, because `--approve` needs it. While fixing, rerun only the cases the change touches (`--cases id,id`). The weekly review job runs no evals when no brain change waits. `tokens.mjs` and the lint are free and run in every build.

| File | What it does | Cost |
|---|---|---|
| `tokens.mjs` | Per playbook: the Director card, the router, the playbook whole, the summary of every guide it names and one model guide's card, as tokens (characters / 4), against the 15,000 target; also every linked guide whole. Fails over the target. In `npm run check:brain` and the build | free, no model |
| `routing-cases.json`, `routing.mjs` | Asks in users' words, each with the playbooks a good agent opens first. Each goes to a no-tools `claude -p` session holding the card and the router, in two arms interleaved: the candidate (this checkout) and the baseline (`--root`, a build of the approved commit). Scored by code | one short session per ask, per arm, per run |
| `craft-cases.json`, `craft.mjs` | Briefs run as real sessions by `behaviour-ab/run.mjs --cases-file` against its fixture project, billable tools removed, in a baseline arm (the approved brain's build) and a candidate arm. Scored by code (router opened, playbook loaded, router or playbook read before the first build call, nothing forbidden, brain tokens read) and by a Sonnet judge against each case's rubric, 0 to 2 a line | one Opus session and one judge call per brief, per arm, per run |
| `gate.mjs` | The gate: each result's candidate arm against its baseline arm, the approved brain in the same batch. What it refuses is under [The gate](#the-gate). It writes nothing | free, reads results |
| `scoreboard.json` | The approved brain: `approvedCommit`, `approvedBrainHash` and the last approval's record. Only `brain-review.mjs --approve` moves it | |
| `brain-hash.mjs` | The hash of what a build hands an agent (the skills, both surfaces' doctrine, the MCP instructions, the router notice). `run.mjs` records it per arm, `routing.mjs` and `craft.mjs` copy it into their results, and the gate refuses an arm from any other brain. `node scripts/brain-eval/brain-hash.mjs [<checkout>]` prints a build's | free, reads the build |
| `results/` | Committed results: `<date>-routing-<model>.json`, `<date>-craft/` (traces, `craft.json`, `craft.md`) | |

## Running it

The baseline is a build of the approved commit, exported outside the repo (an export, not a second clone or worktree: one working copy per repo):

```bash
npm run build                                   # the candidate; routing reads the built card and router
mkdir <dir> && git archive $(node -p "require('./scripts/brain-eval/scoreboard.json').approvedCommit") | tar -x -C <dir>
(cd <dir> && npm install && npm run build -w packages/shared && npm run build -w packages/mcp)
node scripts/brain-eval/tokens.mjs
node scripts/brain-eval/routing.mjs --root <dir> --model sonnet --runs 2
SLATES_DESKTOP_DIR=<slate checkout> node scripts/behaviour-ab/run.mjs --cases-file scripts/brain-eval/craft-cases.json   --baseline <dir> --arms baseline,candidate --out scripts/brain-eval/results/<date>-craft --runs 1
node scripts/brain-eval/craft.mjs --out scripts/brain-eval/results/<date>-craft
```

Run the craft batch through the vault's `heavy_lock.py`, as for the behaviour A/B; `CLAUDE_BIN` names the Claude Code executable when `claude` is an npm shim. A routing miss seen in a real session becomes a case. The behaviour A/B (`../behaviour-ab/`) still gates any reorganization of the instructions or skills against the commit before it.

When `scoreboard.json` has no `approvedBrainHash` (the first time), record it once from that export: `node scripts/brain-review.mjs --pin-approved-hash <dir>`. It refuses unless every source under `packages/shared` matches `approvedCommit` byte for byte and the build there is current.

## The gate

No change reaches the shared brain on a lower score, and none reaches it without Eric (second-brain plan § Keeping it from turning into chaos). The bar is the approved brain run beside the candidate in the same batch, never a score on file: the same day, model, price list and judge, so the difference is the brain.

```bash
node scripts/brain-eval/gate.mjs --routing scripts/brain-eval/results/<date>-routing-sonnet.json --craft scripts/brain-eval/results/<date>-craft/craft.json
```

It rejects, naming why:

- **no results**: run with neither `--routing` nor `--craft`, it prints its usage and exits 1;
- **another brain's results**: an arm with no `brainHash`, a candidate whose hash is not the working tree build's, a baseline whose hash is not `approvedBrainHash` (or none on file), a file without both arms, and any run while the build is older than the skills on disk;
- **routing**: candidate accuracy more than one ask below the baseline's, any ask that errored in either arm, or none answered. A baseline from before the router (`noRouter`) routes nothing and counts as 0;
- **craft**: the candidate loses more cases than it wins (per case, its judged mean against the baseline's; a sign test, ties count for neither), a craft mean more than 0.1 below the baseline's (so a few big losses cannot hide behind many small wins; the 0.1 is chosen, not yet measured), any candidate run with a forbidden action, any unfinished or unjudged run in either arm, a case only one arm ran, or the candidate more than one run below the baseline on the rate of runs that read the router or the case's playbook before their first build call (`readFirst`), or on the rate that loaded the playbook at all.

A rejection names what fell; fix the brain, never the results. A pass puts the change on the review page.

The best-ever scores and `gate.mjs --record` are gone: a bar that only rose was a noise peak the next good change had to beat, and with no bests on file it gated nothing.

## Eric's decisions

The page is built by `brain-review.mjs --spec <spec.json> --notes <notes.json>` (a recommendation for every item, or it refuses) and the vault's `tools/review_page.py`, published as an Artifact with a database. The spec records the head commit and brain hash it was built from (`brain`). Eric's answers land in that database as `review_page.py` and its template store them: one document per item in the `review` collection, its id the item's `id` (the commit's short hash), holding `choice` (`"approve"` or `"hold"`, the spec's choice ids), `note` and `updatedAt`, plus one `notes/general` document. The main session exports them with the ArtifactData tool: list the `review` collection of the page's artifact and write `decisions.json` as `{"<document id>": <its choice>}`, one entry per document that has a `choice`, nothing else. An item with no document or no choice stays out of the file, so `--approve` refuses it as undecided. Read the notes too: a note on an approved item asks for a change, and that change is a new commit and a new page.

Then revert each held commit (`git revert <hash>`, one commit each; its brain files alone will do) and

```bash
node scripts/brain-review.mjs --approve --spec <spec.json> --decisions decisions.json --craft <craft.json> --routing <routing.json> [--routing …]
```

refuses unless every waiting commit is on the page with a decision, every held one is reverted, the only commits after the page's head are those reverts, nothing under `packages/shared` is uncommitted, and the gate passes on this build. It then sets `approvedCommit` to the page's head (plus the reverts), `approvedBrainHash` to this build's hash and `lastApproval` to what it took. Rebuild the plugins (`npm run build:plugins`, which reads the skills from `approvedCommit`) and commit them with `scoreboard.json`.
