# Behaviour A/B, claude-opus-5-5, up to 6 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\4edd80a7-07fd-4c27-8ec5-7d99138048a8\scratchpad\ab-baseline. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| ugc-ad | 3/3 / 3/3 | 100% → 100% | none | 6.7 → 7.0 | 150k → 136k | yes |
| storyboard-from-script | 3/3 / 3/3 | 33% → 33% | none | 7.0 → 6.7 | 55k → 70k | no: judge |
| edit-iterate | 6/6 / 6/6 | 83% → 78% | none | 7.0 → 7.5 | 122k → 129k | no: musts (call slates_estimate_generation_cost|slates_get_board_quote) |
| connect | 3/3 / 3/3 | 100% → 100% | none | 7.7 → 7.7 | 23k → 24k | yes |
| howto-same-face | 3/3 / 3/3 | 100% → 100% | none | 6.7 → 7.0 | 28k → 31k | yes |
| model-cost | 3/3 / 3/3 | 100% → 100% | none | 7.3 → 6.3 | 105k → 103k | no: judge |
| board-to-videos | 3/3 / 3/3 | 100% → 100% | none | 6.3 → 6.0 | 69k → 84k | no: judge |

3 of 7 cases pass.

Fixture reads that failed (the harness, not the model): ugc-ad: GET /members/manifest.json 402; edit-iterate: GET /members/manifest.json 402; howto-same-face: GET /members/manifest.json 402; model-cost: GET /members/manifest.json 402
