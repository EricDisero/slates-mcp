# Behaviour A/B, claude-opus-5-5, up to 2 run(s) per arm (each case's count is in Runs ok)

Baseline: ~\AppData\Local\Temp\claude\C--Coding-Projects\84111b01-34c8-4c73-89f4-8b2ef9710d25\scratchpad\approved-14f9007. Candidate: C:\Coding Projects\slates\slates-mcp. Runs counted are those that finished with the server connected.

| Case | Runs ok base / cand | Musts base → cand | Forbidden (cand) | Judge base → cand | Tokens base → cand | Pass |
|---|---|---|---|---|---|---|
| dr-ad | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 7.0 | 339k → 199k | yes |
| ugc-ad | 2/2 / 2/2 | 100% → 100% | none | 4.5 → 6.0 | 206k → 110k | yes |
| storyboard-from-script | 2/2 / 2/2 | 33% → 67% | none | 6.5 → 5.0 | 60k → 104k | no: judge |
| edit-iterate | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 8.0 | 130k → 177k | yes |
| one-prompt-film | 2/2 / 2/2 | 100% → 100% | none | 5.0 → 5.5 | 87k → 118k | yes |
| shot-variety | 2/2 / 2/2 | 50% → 100% | none | 8.0 → 7.0 | 68k → 94k | no: judge |
| script-craft | 2/2 / 2/2 | 50% → 100% | none | 6.0 → 7.5 | 68k → 132k | yes |
| project-organization | 2/2 / 2/2 | 75% → 100% | none | 7.0 → 7.0 | 40k → 44k | yes |
| connect | 2/2 / 2/2 | 100% → 100% | none | 8.0 → 7.0 | 25k → 28k | no: judge |
| howto-aspect | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 5.5 | 57k → 70k | no: judge |
| howto-credits | 2/2 / 2/2 | 100% → 100% | none | 7.5 → 7.5 | 22k → 25k | yes |
| howto-resolve | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 8.5 | 24k → 30k | yes |
| howto-same-face | 2/2 / 2/2 | 100% → 100% | none | 6.0 → 6.0 | 29k → 27k | yes |
| model-cost | 2/2 / 2/2 | 100% → 100% | none | 5.5 → 8.0 | 76k → 157k | yes |
| vague-brief | 2/2 / 2/2 | 100% → 100% | none | 5.5 → 8.0 | 39k → 28k | yes |
| board-to-videos | 2/2 / 2/2 | 100% → 100% | none | 6.5 → 6.0 | 116k → 104k | no: judge |

11 of 16 cases pass.

Fixture reads that failed (the harness, not the model): dr-ad: GET /members/manifest.json 402; ugc-ad: GET /members/manifest.json 402; edit-iterate: GET /agent/shots/get 404; script-craft: GET /members/manifest.json 402; model-cost: GET /members/manifest.json 402; vague-brief: GET /members/manifest.json 402
