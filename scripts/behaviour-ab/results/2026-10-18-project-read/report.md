# Behaviour A/B, claude-opus-5-5, up to 3 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\4edd80a7-07fd-4c27-8ec5-7d99138048a8\scratchpad\ab-baseline. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| storyboard-from-script | 3/3 / 3/3 | 33% → 33% | none | 6.7 → 6.0 | 55k → 56k | no: judge |
| model-cost | 3/3 / 3/3 | 100% → 100% | none | 4.7 → 8.3 | 76k → 84k | yes |
| board-to-videos | 3/3 / 3/3 | 100% → 100% | none | 5.7 → 6.0 | 88k → 87k | yes |

2 of 3 cases pass.

Fixture reads that failed (the harness, not the model): model-cost: GET /members/manifest.json 402
