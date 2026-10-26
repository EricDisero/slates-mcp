# Behaviour A/B, claude-opus-5-5, up to 2 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\84111b01-34c8-4c73-89f4-8b2ef9710d25\scratchpad\approved-14f9007. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| dr-ad | 2/2 / 2/2 | 100% → 100% | none (base: unsourced figure "100 credits"; unsourced figure "Total: 100") | 6.0 → 6.5 | 404k → 182k | yes |
| ugc-ad | 2/2 / 2/2 | 100% → 67% | none | 7.0 → 3.5 | 177k → 83k | no: musts (call slates_estimate_generation_cost|slates_get_board_quote), judge |
| storyboard-from-script | 2/2 / 2/2 | 33% → 67% | none | 6.5 → 7.0 | 59k → 111k | yes |
| edit-iterate | 2/2 / 2/2 | 100% → 100% | none | 7.5 → 6.5 | 127k → 184k | no: judge |
| one-prompt-film | 2/2 / 2/2 | 100% → 100% | forbidden tool slates_create_project; forbidden tool slates_create_project (base: forbidden tool slates_create_project) | 5.5 → 5.5 | 117k → 160k | no: forbidden |
| shot-variety | 2/2 / 2/2 | 75% → 100% | none | 7.5 → 6.0 | 88k → 82k | no: judge |
| script-craft | 2/2 / 2/2 | 50% → 100% | none | 6.5 → 8.0 | 63k → 143k | yes |
| project-organization | 2/2 / 2/2 | 75% → 100% | none | 8.0 → 6.0 | 35k → 44k | no: judge |
| connect | 2/2 / 2/2 | 100% → 0% | none | 9.0 → 4.0 | 25k → 26k | no: musts (guide /^app-manual$/), judge |
| howto-aspect | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 6.0 | 57k → 61k | no: judge |
| howto-credits | 2/2 / 2/2 | 100% → 100% | none | 7.5 → 7.5 | 22k → 25k | yes |
| howto-resolve | 2/2 / 2/2 | 100% → 100% | none | 7.5 → 7.5 | 24k → 30k | yes |
| howto-same-face | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 5.5 | 34k → 58k | no: judge |
| model-cost | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 7.0 | 107k → 152k | yes |
| vague-brief | 2/2 / 2/2 | 100% → 100% | none | 4.5 → 8.0 | 97k → 28k | yes |
| board-to-videos | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 7.0 | 142k → 117k | yes |

8 of 16 cases pass.

Fixture reads that failed (the harness, not the model): dr-ad: GET /members/manifest.json 402; ugc-ad: GET /members/manifest.json 402; shot-variety: GET /members/manifest.json 402; script-craft: GET /members/manifest.json 402; howto-same-face: GET /members/manifest.json 402; model-cost: GET /members/manifest.json 402; vague-brief: GET /members/manifest.json 402
