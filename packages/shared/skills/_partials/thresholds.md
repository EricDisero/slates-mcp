<!-- GENERATED from @slatesvideo/shared — do not edit between the markers.
     Source: CONFIRM_CREDITS, DEVIATION_FACTOR and the audio bounds in
     packages/shared/src/operations/index.ts. Every number here is REFUSED by an
     op when a prompt gets it wrong, which is why none of them is typed by hand
     any more: this block replaced four claims that contradicted the code. -->

**The thresholds, from the code that enforces them:**

- **Confirm gate:** above **17 credits** an op returns `requires_confirm` and will not
  proceed until you re-call with `confirm: true`. Below it, announce the cost once and go.
- **Deviation pause:** the desktop Studio Agent stops and re-asks when projected generation spend
  exceeds the approved plan by more than **20%**. You do not trigger this; the app does.
- **Seed Audio duration:** **3–120 seconds.** There is no duration
  parameter on the model — the number you pass is written into the prompt AND is what the user is
  billed. Outside that range the op refuses rather than clamping.
- **Sound Effects duration:** **1–22 seconds**, billed per second, never left for the
  model to pick.

Never quote a credit figure from memory: `slates_estimate_generation_cost` returns the real one.
