When you surface the plan, include a short **decision log** — one line per decision *you* made that the user did not specify:

```
source phrase or declared default → what you wrote → what it resolves
"in a diner"        → chrome-and-vinyl booth, 3/4 on the counter   → fixes the anchor so blocking is repeatable
(no time of day)    → late afternoon, low warm key                 → default; say the word and it changes
(no camera)         → slow push-in, single move                    → one move per shot; stacking increases instability
```

**Hard rule: never silently add weather, props, style, or camera movement.** If it wasn't in the brief and you added it, it goes in the log. This is the "why did you add that?" affordance — for an agent that writes prompts on the user's behalf and spends their credits, it is what keeps the model in assembly and the user in the director's chair.

> ❌ **Do NOT turn this into a question gate.** Clarifying questions before optimizing directly fight the locked fast-path rule: *if intent is clear, generate immediately with sane defaults, don't ask questions; only ask for production intent, and batch every question into one message.* Log the decisions, then go. The log is an **output**, not an interrogation — surfaced alongside the plan, never as a separate ceremony, and never as a reason to wait.
