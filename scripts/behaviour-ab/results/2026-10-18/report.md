# Behaviour A/B, claude-opus-5-5, up to 4 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\4edd80a7-07fd-4c27-8ec5-7d99138048a8\scratchpad\ab-baseline. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| dr-ad | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 8.0 | 263k → 307k | yes |
| ugc-ad | 2/2 / 2/2 | 100% → 100% | none | 8.0 → 7.5 | 179k → 108k | no: judge |
| storyboard-from-script | 4/4 / 4/4 | 33% → 33% | none | 7.8 → 7.3 | 60k → 66k | no: judge |
| edit-iterate | 4/4 / 4/4 | 75% → 67% | none | 7.0 → 7.5 | 113k → 127k | no: musts (call slates_estimate_generation_cost|slates_get_board_quote) |
| one-prompt-film | 4/4 / 4/4 | 100% → 100% | none (base: forbidden tool slates_create_project; forbidden tool slates_create_project) | 6.5 → 6.5 | 122k → 128k | yes |
| shot-variety | 2/2 / 2/2 | 75% → 100% | none | 6.5 → 7.0 | 61k → 97k | yes |
| script-craft | 4/4 / 4/4 | 63% → 88% | none | 7.0 → 7.5 | 76k → 106k | yes |
| project-organization | 2/2 / 2/2 | 75% → 75% | none | 6.5 → 7.0 | 34k → 44k | yes |
| connect | 4/4 / 4/4 | 100% → 100% | none | 8.3 → 7.8 | 23k → 24k | no: judge |
| howto-aspect | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.5 | 44k → 52k | yes |
| howto-credits | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.5 | 20k → 20k | yes |
| howto-resolve | 2/2 / 2/2 | 100% → 100% | none | 8.5 → 9.0 | 22k → 23k | yes |
| howto-same-face | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.0 | 22k → 23k | no: judge |
| model-cost | 4/4 / 4/4 | 100% → 100% | none | 7.5 → 7.0 | 94k → 95k | no: judge |
| vague-brief | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 7.5 | 55k → 46k | yes |
| board-to-videos | 4/4 / 4/4 | 100% → 100% | none | 7.8 → 6.3 | 63k → 89k | no: judge |

9 of 16 cases pass.

Fixture reads that failed (the harness, not the model): dr-ad: GET /members/manifest.json 402; ugc-ad: GET /members/manifest.json 402; one-prompt-film: GET /members/manifest.json 402; shot-variety: GET /members/manifest.json 402; script-craft: GET /members/manifest.json 402; model-cost: GET /members/manifest.json 402; vague-brief: GET /members/manifest.json 402
