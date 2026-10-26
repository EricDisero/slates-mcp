# Behaviour A/B, claude-opus-5-5, up to 2 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\84111b01-34c8-4c73-89f4-8b2ef9710d25\scratchpad\approved-14f9007. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| dr-ad | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 7.0 | 369k → 215k | yes |
| ugc-ad | 2/2 / 2/2 | 100% → 100% | none | 5.0 → 6.5 | 176k → 111k | yes |
| storyboard-from-script | 2/2 / 2/2 | 33% → 67% | none | 5.5 → 7.5 | 59k → 107k | yes |
| edit-iterate | 2/2 / 2/2 | 83% → 83% | none | 8.0 → 6.5 | 132k → 170k | no: judge |
| one-prompt-film | 2/2 / 2/2 | 100% → 100% | none | 5.0 → 6.0 | 88k → 128k | yes |
| shot-variety | 2/2 / 2/2 | 50% → 100% | none | 7.0 → 6.5 | 73k → 83k | no: judge |
| script-craft | 2/2 / 2/2 | 50% → 100% | none | 6.0 → 8.0 | 61k → 130k | yes |
| project-organization | 2/2 / 2/2 | 50% → 100% | none | 7.0 → 6.0 | 33k → 55k | no: judge |
| connect | 2/2 / 2/2 | 100% → 100% | none | 8.0 → 7.5 | 25k → 28k | no: judge |
| howto-aspect | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.0 | 54k → 55k | no: judge |
| howto-credits | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 7.0 | 22k → 25k | yes |
| howto-resolve | 2/2 / 2/2 | 100% → 100% | none | 7.0 → 9.0 | 24k → 29k | yes |
| howto-same-face | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.0 | 29k → 27k | no: judge |
| model-cost | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 7.5 | 84k → 161k | yes |
| vague-brief | 2/2 / 2/2 | 100% → 100% | none | 4.5 → 8.0 | 67k → 28k | yes |
| board-to-videos | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 5.5 | 91k → 126k | no: judge |

9 of 16 cases pass.

Fixture reads that failed (the harness, not the model): dr-ad: GET /members/manifest.json 402, GET /agent/assets/transcript 404; ugc-ad: GET /members/manifest.json 402, GET /agent/assets/transcript 404; model-cost: GET /members/manifest.json 402; vague-brief: GET /members/manifest.json 402
