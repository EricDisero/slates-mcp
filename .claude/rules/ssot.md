---
paths:
  - "packages/shared/src/prompts/**"
  - "packages/shared/src/operations/index.ts"
  - "packages/shared/exports/**"
  - "scripts/agent-surface-lockstep-check.mjs"
  - "packages/shared/scripts/build-prompt-builder.mjs"
  - "packages/mcp/src/server.ts"
---

# The SSOT locks this package owns

Each one moved a fact to a single home and left a rebuild-and-publish obligation behind it.

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
    byte-stable prefix (measured 97.4% cache hit). Down from 37,976 at the cut below. **The current
    figure is PRINTED by `npm run check:agent-surface` on every build — read it there, never from
    this sentence.** A number written into prose is a number that goes stale silently; this one had,
    by 11%, within three days. Raise the ceiling deliberately, never to green a red build.
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
  - **⚠️ AND THE INSTRUCTIONS WERE NEVER THE BIG NUMBER.** The doctrine is a tenth of what a turn
    sends; the TOOL SURFACE is the rest — every op's description and JSON schema, on every turn. Two
    mechanisms now hold that line, and both PRINT their figure rather than stating it in prose:
    `check:agent-surface` § 7 pins a ceiling on the CORE surface and reports the per-turn total, and
    `Operation.tier` defers the `library` / `timeline` / `admin` / `blender` groups behind
    `slates_load_tools` so a session pays only for what it uses. **If someone comes here to shrink
    the agent's context, read § 7's output first — the doctrine is not where the bytes are.**
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
- **🚨 SHOT SHAPE + ATTACHMENT-ROLE SSOT = `packages/shared/src/prompts/shot-spec.ts` (added 2026-08-31).**
  `ShotSpec` is the prompt bar serialized — the recipe a Shot row stores — and it carries THE
  attachment-role union (`AttachmentRole` / `OrderedAttachmentRole` / `ORDERED_ROLE_EMISSION`). It is
  mirrored into `slate/src/shared/shotSpec.ts` under the same rule as `reference-composer.ts`: two
  repos, one shape, a header pointing here, and **no second sync mechanism** —
  `slate`'s `npm run check:composer-mirror` asserts the role list, its ORDER (order is send order, so
  a drift renumbers every image), and that both `normalizeShotSpec` implementations read the same
  hostile input identically. Mutation-tested: swap two role positions and 5 assertions go red.
  - **The op surface DERIVES its per-role params from `ORDERED_ATTACHMENT_ROLES`**, and their prose
    from `ATTACHMENT_ROLE_DESCRIPTION` (`satisfies Record<AttachmentRole, string>`). Never hand-type a
    role name in an op — that is precisely what the desktop's `attachmentRoles.ts` was created to kill.
  - **Keep it a dependency-free LEAF.** The desktop's renderer bundles the mirror, the desktop's MAIN
    process reads it, and the schemas here are built from it at module load.
  - **The shot ops enforce exactly what their lane's generate op enforces, no more.** Video goes
    through `assertVideoCapabilities`; image does not, because `slates_generate_image`'s own per-model
    ratio check is still the named open follow-up. A Shot that refused what `slates_generate_image`
    accepts would be a THIRD opinion about the same model, which is worse than the gap.
  - **MEASURED PREFIX COST, 2026-08-31: the six shot ops are 12,454 of 95,000 bytes — 13.1% of the
    whole tool surface** (descriptions + JSON schemas), for 6.8% of the ops. Almost all of it is the
    `params` and `refs` shapes repeated across create / update / duplicate, which is inherent to
    three ops taking the same recipe. It was 15.3% until the per-model aspect-ratio, duration and
    resolution TABLES were stripped out of `shotParamsSchema`: `slates_generate_video` already
    carries them and is always in context, so three more copies would have been four copies of a
    table that grows on every model addition — trap 4 of the plan, walked into. The vocabulary is
    still ENFORCED by a Zod enum built from `MODEL_CAPABILITIES`, and the per-model narrowing by
    `assertShotCapabilities`, which is stronger than prose rather than weaker.
  - **`slates_generate_from_shots` is SEQUENTIAL and BLOCKING in v1**, and its description says so
    plus what to do when it outlasts the HTTP timeout (poll `slates_get_shot` for `generationIds`;
    re-firing double-spends). Real concurrent batching needs a queue — concurrency limiting against
    fal's ceiling, per-item failure isolation, partial-billing semantics — and is deliberately not
    built.
  - **THE SCRIPT LAYER RIDES `ShotSpec` TOO (added 2026-08-31).** `speaker` · `line` · `delivery` ·
    `action` · `prop` · `shotSize` · `camera` · `continues`, all nullable except the flag, with
    `SCRIPT_FIELD_DESCRIPTION` (`satisfies Record<ScriptField, string>`) as the ONE source for what
    each one means — the op schemas are GENERATED from it, so a ninth field cannot ship undescribed.
    - **🚨 THEY ARE A PLANNING AND COUNTING SURFACE. THE PROMPT IS THE ONLY THING SENT.** None of
      them reaches a model. The one exception is pre-existing and unchanged: a `multiShotSegment`
      still prepends its own `camera` / `shotSize` to its own segment prompt. Folding them into the
      composed prompt is a COMPOSER change and belongs with the `audioRefSpokenText` defect, not
      here — which is why in v1 an author states dialogue twice (as `line` for reading and the fit
      check, and inside the prompt where the model receives it) and the skill says so.
    - **🚨 A ROW OWNS ITS TEXT. NOTHING POINTS INTO A SIBLING ROW'S CONTENT.** No script blob, no
      offsets, no spans — "the full script" is the rows rendered in order. The obvious
      implementation (one blob, cut points as character offsets) is the one design that cannot be
      made safe, and every proposed feature needing a range into another row is that design in
      disguise. `continues` carries "these two rows are one sentence" with one boolean and no
      pointer. The desktop's `main/storage/shotCuts.ts` header is the long form.
    - **`audioRefSpokenText` IS NOT `line` and must not be merged into it.** It is keyed by asset id
      and means *"what this reference recording contains"* — asset binding for a clip you attached,
      not a line you wrote. It is separately misfiled and separately owned.
- **🚨 FRAMING GRAMMAR SSOT = `packages/shared/src/prompts/shot-grammar.ts` (added 2026-08-31).**
  Shot-size and camera-move BUCKETS, the bucketing functions, and the measured `SPEECH_RATE`.
  Exported from the leaf subpath `@slatesvideo/shared/shot-grammar` for the two reasons
  `model-capabilities` is a leaf; the desktop imports it directly rather than mirroring it.
  - **Buckets exist to COUNT, never to constrain.** `shotSize` and `camera` are FREE TEXT —
    `cinematic-storyboard.md` §4e reconciled against ByteDance's own ModelArk docs: *"camera
    vocabulary is open standard language … not a closed list of eight moves."* A value matching no
    bucket counts as `other` and is never rejected, rewritten or warned about. **Never hand-type a
    bucket name downstream**, and `satisfies Record<Exclude<Bucket, 'other'>, string[]>` makes a
    seventh bucket a compile error rather than a name nothing matches.
  - **No two-letter abbreviations in the vocabulary** — no `CU`, `MS`, `WS`. They collide with
    ordinary words and with each other across conventions, and a value bucketed WRONG is worse than
    one bucketed `other`: the whole claim of the check is that it is arithmetic you can verify by
    eye. `long-lens CU, other head blurred` is deliberately `other`.
  - **🚨 `SPEECH_RATE` IS MEASURED, NOT CITED, AND IT DECAYS.** Each register carries its `n`,
    the measurement date and the query. `slate`'s `npm run check:shot-list` RE-DERIVES it from
    `second-brain/.../ad-research.db` — a constant whose query no longer reproduces it is STALE, not
    wrong; update the number and the `n` together. The register split is real (performed 133 ·
    conversational 159 · direct-response 169), which is why a single point value would have been
    worse than none. **Read the numbers off `shot-grammar.ts`, never off this line** — it went stale
    once already.
  - **🚨 THE SAMPLE IS OPT-IN: only ads whose `speech_rate` column names a register count
    (2026-09-04, Eric).** The query used to take every row carrying a transcript, which meant
    **researching a new ad turned a Slates RELEASE BUILD red** — `predist` → `check:all` →
    `check:shot-list` reads the vault, so two ads landing in the corpus blocked `npm run dist` on
    work unrelated to the desktop app. Marketing research and shipping the app are now decoupled:
    growth changes nothing until it is marked, so a red check is a deliberate act again. **The
    checker SKIPS (loudly, never fails) when the column or the marks are absent** — a fresh clone
    and an older vault must never be able to block a build. It also fixed three defects the
    unfiltered query carried: wpm is words ÷ TOTAL runtime so silence read as slow speech (a 179s
    row at 55 wpm, a 16s row at 26), `has_voiceover` was SELECTed and never filtered on (9 of 74
    rows had none), and the register was a creator-name regex over free text with `conversational`
    spanning the other two registers. Honest scale: the medians barely moved and the CEILING — the
    only number that ever flags a line — is 283 under every definition tried. The coupling was the
    bug, not the accuracy.
  - **The ceiling is the only number that ever FLAGS.** It is the fastest read in the marked corpus,
    and the fit check fires only ABOVE it — never "a bit long", because a check that nags gets
    ignored.
- **🔑 THE VARIETY COUNTS RIDE THE OP RESULT, NOT A SKILL.** `slates_list_shots` and
  `slates_get_storyboard_with_frames` return the distribution inline. Measured on the 2026-08-30
  eval harness: a rule inlined into an op moved compliance 0/8 → 30/32, while the same guidance
  behind `slates_get_prompting_guide` sat at 13% before and after. `slates-shot-variety` is the
  CRAFT; the numbers are the op's job, and one sentence in the doctrine says to read them.
- **🚨 WHAT SPENDS THE USER'S MONEY IS DECLARED HERE: `Operation.billable` (added 2026-08-31).**
  The desktop's Studio Agent refuses a billable op until `present_plan` has been approved, and
  refreshes its spend ledger after each one. That list of op ids lived ONLY in
  `slate/src/main/studio-agent/ops.ts` — one repo away from the op it gated — and both
  `slates_generate_audio` and `slates_generate_from_shots` shipped without an entry, so the in-app
  agent could spend on either with no approved plan and nothing in the ledger. Set `billable: true`
  beside the description, including on an op that spends INDIRECTLY
  (`slates_generate_from_shots` fires N generations of its own). The desktop takes the UNION of this
  and its own hard-coded floor, so a stale published package can only ever gate MORE, never less.
  It is not part of the tool schema — it never reaches the model, so it costs no prefix bytes.

---

## What landed 2026-09-02 (the deep-review hardening)

Four new locks, each replacing a fact that was stated in prose with one the build prints or derives.

- **🚨 CRAFT CARDS — the POSITIVE half of "load the guide", made structural
  (`packages/shared/src/prompts/craft-cards.ts`).** The banned-token work moved `no_banned_tokens`
  from 0/8 to 30/32 and moved `guide_before_generate` **not at all** (13% before, 13% after): the
  skill's NEGATIVE half became enforced and its POSITIVE half — the named lens, the light direction,
  the stock, the composition — still only arrived if the model chose to fetch it, and it usually did
  not. Every per-model skill now carries a `<!-- @card:start -->` block of 250-400 words, extracted
  the same way the banned lists are, and **delivered on the result of
  `slates_estimate_generation_cost`** — which the doctrine already makes the agent call before
  generating.
  - **Why the estimate RESULT and not a param description.** Zero prefix bytes: the desktop's cached
    tool prefix is unchanged, and the card arrives at the one moment the model has just named the
    model it is about to use. Putting fifteen cards in the `model` param would have grown the largest
    op on the surface on every turn of every session, to be read once.
  - **The desktop de-dups; the MCP surface does not.** A documented asymmetry: `loop.ts` tracks
    which models' cards it has already sent this run and strips the repeats, because a ten-shot run
    estimates the same model ten times. The MCP op layer has no session concept and sends it every
    time.
  - `check:agent-surface` § 8 asserts every per-model skill has a card, that it is under 2,400
    characters, that it names at least five levers as backticked phrases (the eval scorer's
    `craft_levers_present` reads exactly those), that it LEADS the file, and that the estimate op
    still attaches it.
- **🚨 PER-MODEL BANNED LISTS.** `describeBannedTokens('image')` was Nano Banana's list and
  `('video')` was Seedance's — two skills of fifteen — so a Veo, Kling, LTX, MiniMax, FLUX, Seedream,
  GPT-Image or audio prompt was matched against another model's never-use list. Every per-model skill
  now carries its own `@banned` block; the cross-model lists STAY on the op descriptions (a
  description is one static string and cannot vary with the `model` argument) and the per-model list
  rides the estimate result beside the card.
- **🚨 THE TOOL SURFACE HAS A BUDGET, AND IT IS PRINTED
  (`packages/shared/src/operations/surface.ts`).** Measured 2026-09-02: 112,114 bytes on EVERY
  desktop turn, across 90 ops. `Operation.tier` defers four groups — `library`, `timeline`, `admin`,
  `blender` — behind `slates_load_tools`, which appends a group to the run's tool list for the rest
  of the run; `check:agent-surface` § 7 pins a ceiling on what is left and prints the per-turn total.
  **A GROUP IS A BUDGET, NOT A LAW:** if a task regresses because a tool arrives a turn late, move it
  back to core. The MCP server still registers everything — a stdio server has no run to append to.
- **🚨 THE PROTOCOL IS THE PRODUCT SURFACE.** `packages/mcp/src/server.ts` used exactly one MCP
  feature until 2026-09-02, so a host could not tell `slates_list_assets` from
  `slates_delete_project`. It now emits **annotations** (derived in `surface.ts`, re-derived
  independently by § 6 from each op's own transport verbs — a `readOnlyHint` on an op that POSTs is
  the one lie that lets a host auto-approve a mutation), **structured content** beside the prose,
  the 33 skills as **prompts**, the manual / capability table / live price list as **resources**,
  **progress notifications** during a status long-poll, and **elicitation** behind a capability check
  so the confirm gate can ask the USER instead of the model. `mcp-instructions-smoke.mjs` reads every
  one of those back off a real client.
- **🚨 ONE SCHEMA RENDERER.** The desktop rendered `$refStrategy: 'none'` and the server rendered
  `target: 'openApi3'`, so "the two surfaces expose the same tools" was true of the ID SET and
  unproven of the BYTES. `toolDefinitions()` in shared is the only renderer either one calls, and
  § 1 fails the build if either stops using it.
