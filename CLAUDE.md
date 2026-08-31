# slates-mcp — Claude code notes

This is the MCP server + CLI + skills monorepo for Slates. Treat it as a thin transport layer over slates-api (cloud) and the slate desktop app's local HTTP server.

## Layout

```
slates-mcp/
├── package.json                ← npm workspaces root
├── tsconfig.json               ← shared compiler options
├── smithery.yaml               ← Smithery registry config (stdio via npx)
└── packages/
    ├── shared/                 ← @slatesvideo/shared
    │   skills/*.md             ← bundled agent recipes (single source)
    │   scripts/embed-skills.mjs← prebuild: skills/*.md → src/skills/content.ts (gitignored, generated)
    │   src/
    │     auth.ts               ← read/write ~/.slates/agent-connection.json
    │     clients/cloud.ts      ← slates-api HTTP client
    │     clients/desktop.ts    ← 127.0.0.1:PORT HTTP client (+ healthz capability handshake)
    │     clients/blender.ts    ← 127.0.0.1:9876-9879 TCP bridge into the slates-blender add-on
    │     operations/index.ts   ← single source of truth for the tool surface
    │     skills/content.ts     ← GENERATED — embedded SKILLS record, do not edit
    │     index.ts              ← public re-exports
    ├── mcp/                    ← @slatesvideo/mcp-server (stdio MCP, bin: slates-mcp-server)
    │   src/server.ts
    │   manifest.json           ← Claude Desktop .mcpb manifest
    │   scripts/stage-mcpb.mjs  ← stages dist-mcpb/ for `npm run build:mcpb`
    └── cli/                    ← @slatesvideo/cli (bin: slates)
        src/index.ts
        src/commands/{login,logout,status,op,install-skills,mcp}.ts
```

## Hard rules

- **Never duplicate operation logic.** Both surfaces register the same `ALL_OPERATIONS` array. Adding a new tool = one edit in `packages/shared/src/operations/index.ts`, then both surfaces ship it.
- **No native deps.** Pure TS + `@modelcontextprotocol/sdk` + `commander` + `zod` + `zod-to-json-schema`. No FFmpeg, no sharp, no canvas. The desktop side handles binary work.
- **Bearer tokens only flow to their intended hosts.** `slates_sk_` to `slates-api.fly.dev`; the desktop token to `127.0.0.1:PORT`. The clients enforce this — never bypass.
- **Connection file is the single source of truth.** Don't add a second config or env-var path. The CLI's `slates login` writes it, the desktop app writes the desktop side, both surfaces read it.
- **Cost-key builders must byte-match the desktop's.** `videoCostKey()` in `operations/index.ts` mirrors `klingCreditKey`/`seedanceCreditKey` in `slate/src/shared/pricing.ts` — every key dimension (resolution incl 4K, face/realface, audio) must be reflected here or agent pre-flight quotes diverge from what's billed (the Kling-4K quote gap shipped exactly this way, caught 2026-07-02). Any key-shape change in either repo updates both in the same pass. Full contract: `slate/.claude/pricing.md`.
- **Prompting-tips SSOT = `packages/shared/src/prompts/prompting-tips.ts`.** There is NO hand-written tips copy anywhere downstream, ever (a hand-mirrored modal is how Omni Flash shipped showing a Veo body under a Kling title, caught 2026-07-10). **Adding a new model = three entries in THIS repo, same pass: (1) `model-facts.ts` fact, (2) `skills/slates-prompting-{model}.md` skill, (3) `prompting-tips.ts` entry (the curated user-facing subset of the skill).** When a skill's rules change, update the tips entry in the same pass.
  - **🚨 THE DESKTOP NO LONGER RENDERS THE TIPS AT ALL (2026-08-10).** They render in exactly one place: the generated page **<https://slates.video/docs/prompting>**, emitted by `slates-web/scripts/build-llm-docs.mjs` via `scripts/llm-docs/extract-tips.ts`, which imports `PROMPTING_TIPS` from this file. The desktop links to it from the Help menu (`?` in the title bar). *(This bullet previously pointed at `slate/.../prompt/PromptingTipsRenderer.tsx`, which had already been deleted on 2026-08-01 — the tips then lived in a Settings accordion, and now they live on the web. Rationale and the standing rule: `slate/CLAUDE.md` → Prompting-tips SSOT.)*
  - **So a tips edit is not done until slates-web regenerates.** After changing this file run `npm run build:llm-docs` from `slates-web/`; `npm run build` there FAILS on stale docs (`check:llm-docs`). A new key also needs a reading group in `extract-tips.ts`, or it renders on no page — the generator warns by name.
  - Rebuild + copy to slate's node_modules (local) or publish (release) is still how the CLI/MCP side picks changes up. The desktop maps model ids → tips family keys with its MODEL_REGISTRY helpers; content lives only here.
- **Portable Prompt Builder is generated, never authored downstream.** `packages/shared/exports/slates-prompt-builder/prompt-builder.md` owns portable scope/output behavior; its routing table derives from `MODEL_FACTS`, and its references copy the resolved production skills directly after stripping only discovery frontmatter. `npm run sync-prompt-builder` regenerates the Markdown, manifest, and deterministic `.skill`; build/typecheck/prepublish fail if any output is stale. Never edit `exports/slates-prompt-builder/generated/` or the Second Brain lead-magnet mirrors directly.
- **`MODEL_FACTS.kind` is `image | video | audio` (audio added 2026-07-31), and every kind needs a consumer block.** The desktop's `buildModelRouting()` FILTERS `MODEL_FACTS` by kind — a fact whose kind matches no filter compiles, sits in the registry, and is **silently invisible to the Studio Agent**. `AUDIO_MODELS` mirrors `VIDEO_MODELS` (both exported from `operations/index.ts`) as the exact `slates_generate_audio` model-id list. Audio cost keys go through `audioCostKey()`, which must byte-match the desktop's `audioCreditKey()` — asserted by `pricing-consistency-check.mjs` §4. **🚨 Seed Audio has NO duration parameter: the `durationSeconds` an agent passes is written into the prompt AND is what the user is billed**, so the op's clarification gate refuses to guess it.
- **Audio MIN / MAX / DEFAULT seconds live in THREE repos — a change is a three-site edit.** Here (`SEED_AUDIO_MIN_SECONDS` &co, feeding `audioCostKey`), `slate/src/shared/pricing.ts` (MODEL_REGISTRY `audio.durationSeconds`, feeding `clampAudioDuration` + `audioCreditKey`), and `slates-api/src/lib/audio-keys.ts` (the server's fail-closed bounds). `audioCostKey` must **mirror the desktop's clamping exactly, non-finite arm included** — `Math.max(min, NaN)` is NaN, so a missing arm yields the key `seed-audio-NaNs` while the desktop quotes the default. The MINs were absent and the floor was a hardcoded 1, which quoted a real `seed-audio-2s` price for a generation the proxy REJECTS. `pricing-consistency-check.mjs` §4 now sweeps **out-of-range values deliberately** — the property under test is not "is it in range" but "do the two clamp IDENTICALLY", so skipping the values where they can differ skips the whole test.
- **🚨 Model CAPABILITY SSOT = `packages/shared/src/prompts/model-capabilities.ts` (added 2026-08-16).** `MODEL_CAPABILITIES` owns what each model will ACCEPT: aspect ratios (incl. `providerAspectRatios`), video resolutions (incl. `fixed`/`default`), duration windows (incl. `resolutionOverrides`/`modeOverrides`) and reference caps. **Nothing downstream may hand-type one of these facts again.** `operations/index.ts` builds its Zod enums from `aspectRatioUnion` / `videoResolutionUnion` / `durationBounds`, generates every `.describe()` from `describeAspectRatios` / `describeVideoResolutions` / `describeDurations` / `describeReferenceImageCaps`, and gates `slates_generate_video` + `slates_estimate_generation_cost` through `assertVideoCapabilities`. `MODEL_FACTS` derives its reference caps via `caps()`. `slate/src/shared/pricing.ts` spreads the same rows into `MODEL_REGISTRY`.
  - **Why:** the op re-stated all of it by hand and had drifted on every axis — an invented `9:21` (in zero models), "Kling/Seedance support all" (Seedance has no `4:5`; Kling-on-fal takes three ratios), "Veo locks to 16:9" (two on fal), "Kling: 5-15" (min 3), a `videoResolution` line that never mentioned Kling, and 4s quoted for Veo at 1080p. A customer burned a round trip on `4:5` + Seedance: accepted client-side, queued, credits reserved, rejected asynchronously. `pricing-consistency-check` covers COST and `check:composer-mirror` covers PROMPT; CAPABILITY was the one class with no enforcement, which is why it rotted.
  - **Validate against `AGENT_ROUTE_PROVIDER` (`'fal'`), not the direct-API sets.** Agent generations are credits-only and the credits route carries Kling and Veo on fal, so an agent gets Kling's 3 ratios and Veo's 2. Validating against the 8/10 direct sets would accept a ratio fal rejects.
  - **Keep it a dependency-free LEAF.** It ships as its own exports subpath (`./model-capabilities`) with a `default` condition, because slate's renderer bundles it AND the slates-api checkers load it through tsx as CommonJS.
  - **Still open (plan §5):** the IMAGE param surface is unaudited — its ratio enum is now generated (so no phantom values) but is a union, not per-model, so `gpt-image-2`'s five ratios are unenforced. `checkAspectRatio` is ready; wire it the way `assertVideoCapabilities` does.
- **🚨 AGENT GUIDANCE SSOT = `packages/shared/src/prompts/agent-doctrine.ts` (added 2026-08-30).**
  `buildAgentDoctrine({ surface })` is the ONE working method, the ONE set of hard rules and the ONE
  guide index, consumed by BOTH surfaces: the desktop Studio Agent's entire system prompt
  (`slate/src/main/studio-agent/context.ts` is now composition and a cache, nothing else) and the MCP
  server's `instructions`. Neither consumer may author doctrine prose — `scripts/agent-surface-lockstep-check.mjs`
  fails the build if one does.
  - **Why:** capability has been SSOT since the ops registry was built and it HELD. Guidance never
    was, and it drifted the moment a second surface existed: 37,447 characters of working method,
    hard rules and routing reached only the desktop, while `new Server(...)` shipped
    `{ capabilities: { tools: {} } }` with no `instructions` at all. A Claude Code user got tool
    descriptions and nothing else — no REAL NUMBERS rule, no guide index, no working method. The MCP
    protocol has had the field the whole time.
  - **`both()` is the default; `fork()` needs a defensible reason.** Only four lines fork today, and
    each one names a mechanism that genuinely differs: `present_plan` is a desktop loop-level tool
    the MCP surface cannot see, and only the desktop loop auto-polls generation status and renders
    orchestration cost. Two hand-maintained copies is the drift this file deletes.
  - **The MCP instructions have a PINNED BYTE CEILING** (`MCP_INSTRUCTIONS_CEILING`, 14,000). They are
    injected into every client session with no prompt cache behind them, unlike the desktop's
    byte-stable prefix (measured 97.4% cache hit). Measured 2026-08-30 after the cut below: **9,613
    chars**, down from 37,976. Raise the ceiling deliberately, never to green a red build.
  - **🚨 EVERY FACT LIVES AT THE DECISION IT INFORMS. The doctrine says only what no single op can
    say.** The first version of this module was 37,976 characters, and **85% of it was two blocks
    that duplicated other SSOTs**: a 17,700-char MODEL ROUTING table (80 resolution tokens, 42
    duration claims and 23 hard-typed prices — all owned by `MODEL_CAPABILITIES` and the rate
    functions, and the prices flatly contradicted the prompt's own REAL NUMBERS ONLY rule) and a
    14,556-char guide index of Claude-Code-style discovery blurbs for a mapping `resolveGuideTopic()`
    already does in code. The rule now:

    | The fact is true… | It lives in | Because |
    |---|---|---|
    | every turn (REAL NUMBERS, credits-only, consent, token discipline) | the doctrine | there is no narrower moment |
    | at one call (routing, capabilities, banned tokens) | that op's `.describe()` | it is in context exactly when the decision happens, and a Zod enum ENFORCES what prose can only request |
    | as craft (how to write the prompt) | the skill, on demand | it is thousands of words that matter for one model |

    Routing now rides `describeRouting()` on the four ops that choose a model
    (`slates_generate_image`, `slates_generate_video`, `slates_edit_video`,
    `slates_generate_audio`); the doctrine keeps one line saying the three KINDS are disjoint, which
    is the only part no single op can say. **This was not a size exercise** — it is the same lesson
    the banned-token measurement produced (prose 13% → 13%, op description 0% → 94%): placement
    beats presence.
  - **⚠️ AND THE INSTRUCTIONS WERE NEVER THE BIG NUMBER.** Measured the same day, the always-in-context
    total is ~63K chars: instructions 9.6K, op descriptions 25K, op PARAM descriptions 28K. Roughly
    7K of the routing that left the doctrine landed in those param descriptions, so the honest cut is
    the guide index and the duplicated facts, not the relocation. **If someone comes here to shrink
    the agent's context, the doctrine is 15% of the problem and the tool surface is the rest.**
- **🚨 "LOAD THE GUIDE" AND "QUALITY-CHECK" ARE STRUCTURAL, NOT PROSE (added 2026-08-30).** Both rules
  were written in the system prompt and both were skipped in the first real session after the model
  swap: `slates_get_prompting_guide` zero times, no vision op, and a prompt that tripped the skill's
  own never-use list twice (`photorealistic`, `cinematic`). **A rule with no check is a suggestion,
  and an LLM is the least reliable enforcer you could pick.** So:
  - `packages/shared/src/prompts/banned-tokens.ts` EXTRACTS each never-use list from the skill file
    itself, between `<!-- @banned:start -->` / `<!-- @banned:end -->` markers, and
    `describeBannedTokens()` inlines it into `slates_generate_image` / `slates_generate_video`'s
    descriptions. **An op description is always in context on both surfaces — there is no call to
    skip and no discretion to exercise.** Never hand-type one of those tokens downstream; edit the
    skill and rebuild. (The marker note itself sits inside a `slates-only` fence, or
    `build-prompt-builder`'s portability check correctly refuses to ship an op name in the public
    lead magnet.)
  - `bannedTokenWarning()` reports what the submitted prompt actually contained, in the op RESULT,
    on the pre-spend gates as well as the success path. **Non-blocking** — the generation proceeds
    (PRODUCT_PHILOSOPHY → make state visible, never block).
  - Generation results name the review op. Three different pointers, because what the agent already
    HAS differs: a blocking image generation returns the pixels inline ("look at what you have"), a
    video generation returns none ("call `slates_get_asset_video_frames`"), a background submission
    has no asset yet. Telling the agent to re-fetch something already in its context buys a wasted
    turn and teaches the wrong habit.
  - **Measured A/B**, `cheap-image` at k=8, same brain, same day, same scorer: with enforcement OFF,
    `0/8` runs produced a clean prompt and every failure was the same two tokens as the production
    incident (`photorealistic`, `cinematic`). With it ON, `7/8`. Harness + full numbers:
    `slate/scripts/agent-eval/README.md`.
  - **🚨 MEASURED RESULT, 2026-08-30, 48 trials at k=8 — and it is HALF a win. Read it before
    "improving" any of this.** `no_banned_tokens` went **0/8 → 30/32 (94%)**: the never-use list
    rides an op description, the model cannot skip it, and it obeyed. `guide_before_generate` was
    **13% before and 13% after** — the same 4-in-32 either way. **Steps 2(a) and 2(b) changed the
    OUTPUT and did not change the BEHAVIOUR.** So the skill's NEGATIVE half is enforced and its
    POSITIVE half (named lens, film stock, physics-based lighting, composition — the levers that
    make a shot good rather than merely un-bad) still only reaches the model if it chooses to fetch
    it, and it usually does not.
    - **The lesson generalises: put the FACT where it cannot be skipped, not a POINTER to the fact.**
      An op description saying "read the guide first" has been ignored for months; an op description
      carrying the actual list is obeyed. Anything you want the agent to know belongs in the second
      shape.
    - **Step 2(c) — auto-attaching the matching skill to `slates_estimate_generation_cost` — was
      deliberately NOT built.** "Not yet loaded THIS SESSION" is session state, and the MCP op layer
      has no session concept at all; that is real architecture, not a tweak, and the plan's own
      falsification clause warns against reflexively adding a fourth mechanism. It is Eric's call,
      and now it has evidence behind it.
    - `pass^8` is 0 on five of six tasks almost entirely because of this one assertion, so **do not
      read these numbers as a verdict on the model.** Re-run against a candidate brain
      (`SLATES_EVAL_API_BASE`) before concluding anything about model choice.

- **The MCP surface has NO plan gate, and that is DELIBERATE (decided 2026-08-30).** The desktop
  rejects a billable op in code until a `present_plan` verdict is approved; MCP's consent is the
  per-op `requires_confirm` threshold plus the host client's own per-call tool approval. Adding a
  plan gate here would mean a new op and a stateful session concept on a stdio server, to duplicate
  a confirmation the Claude Code / Cursor user already sees. The doctrine string forks at step 4 to
  describe the mechanism each surface actually has. **Do not "fix" this asymmetry without re-deciding
  it** — and if you do, the doctrine fork is where it lands, not a second prompt.
- **Model routing doctrine SSOT = `packages/shared/src/prompts/model-facts.ts`.** `MODEL_FACTS` (kind: image vs video, default/premium/niche notes) and `VIDEO_MODELS` (the exact `slates_generate_video` model ids) are exported from the package and CONSUMED at runtime by `prompts/agent-doctrine.ts`, which derives the MODEL ROUTING block and model-id list from them for BOTH agent surfaces (added 2026-07-03 after the agent suggested Seedance, a video-only model, as an image generator from a hand-written prose copy; moved here from `slate/.../context.ts` on 2026-08-30 when guidance became SSOT). Editing routing = edit `model-facts.ts` (+ `skills/slates-model-selection.md` for the long-form table) and rebuild. NEVER restate model routing in op descriptions, skill files, or desktop prompt prose — point at `slates-model-selection` / derive from `MODEL_FACTS` instead. Op descriptions that duplicate the doctrine are a bug: they drift AND bloat the desktop's cached token prefix.
- **Asset params take UUIDs OR badge codes.** Generation ops resolve refs ("IMG-A8", bare "a8") against the project AT CALL TIME via `resolveAssetRefs()` and echo the resolved code+label in every result. New ops with asset-id params must use the same helper — stale-code guessing burned a real $4.44 render on the wrong start frame (2026-07-03).
- **The desktop consumes the PUBLISHED npm package, not this working tree.** Local iteration: `npm run build`, then copy `packages/shared/{dist,package.json,skills}` into `slate/node_modules/@slatesvideo/shared/` so the in-app Studio Agent picks changes up without a publish. `slate/scripts/check-shared-version.mjs` screams on version drift at dev startup. Shipping to users = publish + bump slate's dep + desktop release (publish BEFORE the release build, in that order).
- **🚨 The Blender bridge is a SEPARATE GPL-3.0 program — keep the boundary clean (added 2026-08-28).** `slates_blender_*` ops talk over a localhost TCP socket to the `slates-blender` add-on (its own repo, `C:\Coding Projects\slates\slates-blender`). That add-on links `bpy` and is therefore GPL, as every Blender add-on is; **this repo stays proprietary because the boundary is a socket, and GPL propagates through linkage, not across a process.** So: never vendor add-on code into this package, and never import from it. The wire protocol (`{type:"execute",code,strict_json}` → `{status,result,stdout,stderr}`, NUL-delimited JSON) is the whole contract, it is documented in `clients/blender.ts` and in the add-on's `CLAUDE.md`, and **changing it is a two-repo edit**.
  - **No camera-move library, ever.** Camera work is `bpy` written by the agent against the Blender docs the add-on ships, steered by the `slates-previs-blocking` / `slates-camera-language` skills. A fixed menu of moves caps the workflow at whatever we thought of; the skills are where this evolves, and they cost nothing to change.
  - **⛔ ONE THING LEFT BEFORE PUBLISHING THESE OPS: a real Blender.** The page and the download landed 2026-08-28 — `https://slates.video/blender` exists (`slates-web/src/app/blender/page.tsx`) and serves the add-on zip from the public Tigris bucket, so `BLENDER_SETUP_HINT` no longer promises a 404. What has NOT happened is `previs.py` / `scene.py` running inside an actual Blender; everything below `bpy` is proven (socket, prelude, `_mod` resolution, and the DEFERRED render round-trip, all driven end-to-end against `slates-blender/tests/serve_stub.py`), but the `bpy` calls themselves have only been checked against the bundled 5.1 reference and upstream's own tools. Publish after one real render. When you do, the ops stay LAST in `ALL_OPERATIONS` on purpose — `slate/src/main/studio-agent/ops.ts` maps that array straight into the desktop Studio Agent's prompt-cached tool prefix, so a niche third transport must not sit ahead of `slates_get_workspace_state`.
  - **The blocking clip is just a video asset.** `slates_blender_render_blocking` imports through the same `/agent/assets/upload` route as `slates_upload_reference_image`, and its asset id goes into `slates_generate_video`'s existing `videoReferenceAssetIds`. No bespoke generation path — if you find yourself adding one, the design has drifted.

## Build

```bash
npm install
npm run build       # shared → mcp → cli, then the agent-surface lockstep check
npm run typecheck   # whole-monorepo type check
npm run check:agent-surface   # just the lockstep check (needs a built dist)
```

`scripts/agent-surface-lockstep-check.mjs` runs at the end of `npm run build` and asserts four
things: both surfaces expose the same op id set with no surface-private capability (the desktop's
`present_plan` is the one documented exception), the MCP server passes non-empty `instructions` built
from `buildAgentDoctrine` within the byte ceiling, neither consumer contains doctrine prose of its
own, and every banned token inlined into an op description still appears in its source skill's
`@banned` block. **All four are mutation-tested** — break one, it goes red on that check. The desktop
half skips with a warning when `../slate` is not on disk, per the sibling-repo rule.

## Adding a new operation

1. Open `packages/shared/src/operations/index.ts`.
2. Define a `const newThing: Operation<{...}>` with id, description, Zod input schema, and `run`.
3. Add to `ALL_OPERATIONS`.
4. Rebuild. Both MCP and CLI now expose it.

If the op needs new desktop endpoints, add the route in `slate/src/main/agent/routes.ts` first, then call it from the desktop client.

## Adding a new skill

**⚠️ The bundled skills here are FREE product quality — they are NOT the paid "Agentic Skills Pack" ($29 funnel order bump).** The free/paid line is locked (Eric, 2026-07-09): *capability free, outcomes paid.* Everything in `packages/shared/skills/` ships free to every user (CLI `install-skills`, MCP prompting-guide op, desktop Studio Agent) — never gate any of it behind the bump. The paid pack's content is **campaign blueprints harvested from our real ads** (exact prompt stacks, shot lists, workflow runs per ad, replayable as "make this for my product") plus any pack-exclusive skills built specifically for the bump. Doctrine: `second-brain/business/projects/slates/strategy/funnel-architecture.md` → "Pack content doctrine".

**🚨 Paid skills live in `pack-skills/` at the repo root — NEVER in `packages/shared/skills/`.**
`packages/shared/package.json`'s `files` array includes `skills`, so **that folder ships inside the
public npm tarball**: anyone can `npm pack @slatesvideo/shared` and read every file in it. An
entitlement filter in `install-skills` protects nothing — it is security by omission over a public
artifact. **The only real gate is not shipping the file.** (`install-skills.ts` iterates
`Object.entries(SKILLS)` with no entitlement check of any kind, and that is fine *because* the
paid files never reach the record.)

`scripts/embed-skills.mjs` globs `packages/shared/skills/*.md` only, so moving a file into
`pack-skills/` automatically drops it from the `SKILLS` record — and therefore from npm, the
`/members` feed, the MCP prompting-guide op and the desktop Studio Agent, in one move.

Two ad skills were written straight into `packages/shared/skills/` on 2026-08-16 and swept into a
release commit by a `git add -A`. They never reached npm (the build ran before the files landed),
but the near-miss is why this rule is now explicit. **Use explicit paths in `git add`, never `-A`.**

Build the pack with `npm run build:skills-pack` (root). It assembles the free skills plus
everything in `pack-skills/` into a deterministic zip, refuses to build when `pack-skills/` is empty,
and generates the README so the inventory is never hand-typed. The zip's download URL is
hand-mirrored in **two** repos and gated by `slates-web/scripts/check-skills-pack-lockstep.mjs` —
**never move that URL before the object is uploaded**, or every paying customer gets a 404.

1. Drop a markdown file with frontmatter into `packages/shared/skills/`.
2. Frontmatter must include `name:` and `description:` for skill discovery.
3. Rebuild — `scripts/embed-skills.mjs` runs as shared's prebuild and regenerates `src/skills/content.ts` (the `SKILLS` record). The CLI's `install-skills` and the `slates_get_prompting_guide` op both read from that record; never edit the generated file by hand.
4. **🚨 A first-party prompt guide is authority on the MODEL; the ENDPOINT SCHEMA is authority on the
   REQUEST — and the skill has to serve the request** (learned on MiniMax H3, 2026-08-27). MiniMax's
   own guides document an angle-bracket tag block (`<Subject N>` / `<Picture N>` / `<Video N>` /
   `<Audio N>`) as the way to declare references. fal — the provider we actually call — exposes
   references as TYPED SLOTS and its `prompt` description instructs *"refer to reference assets by
   their modality and order: Image 1, Image 2, Video 1, Audio 1"*. Writing the skill from the
   first-party guide alone would have shipped a syntax that reaches the model as literal angle
   brackets. **Read the live OpenAPI before writing a per-model skill, not just the model card.**
   The same read found `prompt_expansion_mode` defaulting to `balanced` — a provider-side prompt
   rewrite that the desktop now disables on every request (prompt-transparency invariant), which is
   itself a fact the skill has to teach.
5. Three categories — keep them separate:
   - **Workflow skills** (`slates-one-prompt-film`, `slates-direct-response-ad`, `slates-storyboard-from-script`, etc.) compose multiple ops into a recipe. Cap ~6 — more than that and the LLM can't tell which one fires. Currently AT the cap (6).
   - **Per-model prompting skills** (`slates-prompting-nano-banana-2`, `slates-prompting-veo-3`, etc.) fire when calling the matching `slates_generate_*` op. Naming convention: `slates-prompting-{model}.md`. One per model variant family. The audio lane adds two: `slates-prompting-seed-audio` and `slates-prompting-elevenlabs` (Sound Effects v2 — the ElevenLabs TTS surface was removed 2026-08-01, so that skill is SFX-only and `tts`/`voiceover` alias to Seed Audio instead). ⚠️ In `resolveGuideTopic()` the `seed-audio` alias MUST be tested **before** `seedance` — "seed-audio" also starts with "seed", and falling through hands the video guide to an audio model.
   - **Per-style prompting** (`slates-style-prompting`) — cross-model style depth (photoreal/anime/painterly/3d-render on Seedance vs Kling vs NB2). Fires on style requests; style names alias to it in `resolveGuideTopic()`. SSOT: born in second-brain `research/style-prompting-research.md`, encoded here — never author style content directly in this file.
   - **Cross-cutting hygiene skills** (`slates-cost-discipline`) fire on every generation call regardless of model. Should be rare — only add when a discipline applies across many ops.
6. If the skill maps to a model id, extend the alias table in `resolveGuideTopic()` (operations/index.ts) so `slates_get_prompting_guide` resolves the model id to it.
