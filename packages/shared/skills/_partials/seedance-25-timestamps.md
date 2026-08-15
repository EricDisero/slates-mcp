**2.0 does not respond to timestamps and answers only to shot numbers. 2.5 responds to
integer-second timestamps.** That is ByteDance's own first line under "Differences from Seedance
2.0", and it is why a 30-second take is usable at all: the length is only worth buying if you can
say *when* things happen inside it.

Both formats are valid on 2.5, and you can mix them — `Shot N` blocks for a storyboard whose
pacing you are happy to leave to the model, timestamps when a beat has to land at a moment.

**Three ways to control time, all first-party:**

| Form | Write it like |
|---|---|
| **Interval** | `0-3 seconds… 3-7 seconds… 7-15 seconds` or `[1s-4s]… [4s-8s]… [8s-12s]` |
| **Time point** | *"Quick left sideways transition at the 5-second mark."* |
| **Relative** | *"After 3 seconds, everyone around him shakes their head."* · *"The frame freezes for 1 second after he presses the shutter."* |

**The rules that come with them:**

- **One second is the smallest unit.** Integers only — no `2.5s`, no frames.
- **No gaps in the timeline.** `0-3s… 5-6s…` leaves 3-5s unspecified and the model fills it however
  it likes. Intervals must abut: `0-3s`, `3-7s`, `7-15s`.
- **Budget the plot to the seconds.** Too little content in a range and the model improvises to
  fill it; too much and you get extra cuts or dropped beats. This is the actual craft of a 30s take.
- **Never time-code a high-frequency action.** *"Shake your head three times per second"* is
  explicitly called out as a misuse — timestamps schedule beats, they don't choreograph frames.
- **Transitions want both halves:** the moment AND the method — *"At the 5-second mark, the camera
  transitions leftward with a left wipe into a natural dissolve."*
- **Timestamps work on an EDIT too**, and that is where they earn the most: they scope a change in
  time as well as in content — *"Change the man's action from drinking coffee to mopping the floor
  from 4-6 seconds in Video 1, and leave the rest of the content unchanged."* Without a range, a
  whole-clip instruction is applied to the whole clip.

Do **not** carry this back to 2.0, and do not carry Veo's `[00:00-00:02]` bracket syntax into
either — 2.0 ignores time entirely, and the cross-model syntax swap is its own known failure.
