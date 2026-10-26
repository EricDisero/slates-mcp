---
name: spring-pop-entrance
description: The canonical entrance pop — an element (or staggered group) arrives by scaling 0 → 1, passes its mark and springs back into place (overshoot and settle); opacity never overshoots. fromTo so it's correct at t=0 under seek.
metadata:
  tags: spring, entrance, pop, scale, power3, settle, stagger, reveal, arrival
---

# Spring-Pop Entrance

> **Arrivals overshoot and settle.** This entrance passes its mark and springs back into place: `back.out` near 1.2–1.4, or the baked spring at ζ 0.7–0.85 (`../adapters/gsap-easing-and-stagger.md` → Spring Eases). Scale and position may overshoot; opacity and colour never do. What reads cheap is bounce sprayed on every element at once, so give each element its role and let the camera or the next element carry the motion after the landing.

THE entrance primitive: an element (or staggered group) arrives by springing from nothing — `scale: 0 → 1`, optional small `y` rise — and settles with a spring. This is **arrival**, not reaction: distinct from [press-release-spring.md](press-release-spring.md) (a click/press → release feedback chain on an element that already rests on screen). Many blueprints used to borrow that rule to fake an entrance; reach for this instead.

## How It Works

One `fromTo` carries the arrival: `scale` from `{ scale: 0 }` (explicit, so t=0 is correct under seek) to `{ scale: 1, ease: "back.out(1.3)" }`, with `opacity` on its own short `fromTo` at the same position, because opacity must not overshoot. For a **group**, the same pair runs per element at `i * STAGGER`, capped so the group reads as one arriving beat. The `scale` grow is load-bearing; the `y` rise is garnish — drop everything else and it must still read as a clean entrance. Let the ease produce the overshoot: never hand-key a `scale: 1.1` mid-state (it double-bounces against the curve).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="pop-hero" id="hero">{heroLabel}</div>

<div class="pop-grid">
  <div class="pop-item">{itemA}</div>
  <div class="pop-item">{itemB}</div>
  <div class="pop-item">{itemC}</div>
</div>
```

```css
.pop-hero,
.pop-item {
  transform-origin: 50% 50%; /* in-place pop; move to the source point for the anchored variation */
  will-change: transform;
}
.pop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: GRID_GAP;
  place-items: center;
}
```

```js
// Single hero pop — overshoot and settle; opacity lands on its own ease.
tl.fromTo("#hero", { scale: 0 }, { scale: 1, duration: POP_DUR, ease: "back.out(1.3)" }, ENTRY_AT);
tl.fromTo("#hero", { opacity: 0 }, { opacity: 1, duration: POP_DUR * 0.4, ease: "power2.out" }, ENTRY_AT);

// Staggered group pop — one arriving beat.
gsap.utils.toArray(".pop-item").forEach((el, i) => {
  const at = GROUP_ENTRY_AT + i * STAGGER;
  tl.fromTo(el, { scale: 0, y: Y_RISE }, { scale: 1, y: 0, duration: POP_DUR, ease: "back.out(1.3)" }, at);
  tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: POP_DUR * 0.4, ease: "power2.out" }, at);
});
```

## Variations

- **Calm landing** (premium / enterprise): `back.out(1.2)`, no rotation, `Y_RISE` 0–12px — a weighted, confident landing with a small overshoot for a hero wordmark or product shot.
- **Firm landing** (everyday default): `back.out(1.3–1.4)`, `Y_RISE` ~24px — cards, icons, callouts.
- **Exact-physics settle**: when the settle IS the shot, swap the ease for `springEase({ response: 0.4, dampingFraction: 0.8 })` from `../adapters/gsap-easing-and-stagger.md` → Spring Eases; take `duration` from the helper.
- **Origin-anchored pop**: a callout growing out of a specific point (marker, pointer tip) sets `transform-origin` to that point (e.g. `0% 100%`) so `scale: 0 → 1` reads as "emerging from the source", not "inflating in place".
- **Pop into a held slot**: land the pop and hold still — no idle loop baked into the entrance. If the held frame genuinely needs life, hand off to [sine-wave-loop.md](sine-wave-loop.md) for subtle jitter on a separate later tween; prefer revealing the next element on its VO cue.
- **Playful slam**: swap the ease for a larger `back.out(OVERSHOOT)` and optionally settle a small `rotation: ROT_FROM → 0` so elements look hand-placed — a logo hit, a sticker, a consumer register. Use it deliberately on one element, not on everything at once:

```js
tl.fromTo(
  el,
  { scale: 0, opacity: 0, rotation: ROT_FROM },
  { scale: 1, opacity: 1, rotation: 0, duration: POP_DUR, ease: `back.out(${OVERSHOOT})` },
  GROUP_ENTRY_AT + i * STAGGER,
);
```

Keep `OVERSHOOT ≤ ~2` — past that it reads as cartoon wobble. Better still: the baked spring at `dampingFraction: 0.6–0.7` (same adapters doc) gives ~5–10% overshoot that reads physical where `back.out` reads cartoon.

## Values

| token      | range                                     | notes                                                            |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| EASE       | `back.out(1.2–1.4)` default; `springEase` ζ 0.7–0.85 | `power3.out` for the no-overshoot settle (opacity, colour, readouts); larger `back.out(OVERSHOOT)` for the slam |
| POP_DUR    | 0.4–0.7s                                  | shorter = tight snap; hero must be visible by **t ≤ 0.5s**       |
| STAGGER    | 0.04–0.08s                                | `min(0.06, 0.5 / ITEM_COUNT)` — self-caps the window             |
| ITEM_COUNT | 3–9                                       | >9 makes the stagger vanish — switch to a wipe/sweep reveal      |
| Y_RISE     | 0–32px                                    | small; never large enough to read as a slide-up                  |
| ROT_FROM   | −10°–+10°                                 | slam only; alternate sign by index (`i % 2 ? 6 : -6`) |
| ENTRY_AT   | 0–0.4s                                    | a beat of quiet, but keep the subject landing by t ≤ 0.5s        |

## Critical Constraints

- Default ease `back.out(1.2–1.4)` on scale and position (or a spring at ζ 0.7–0.85); opacity and colour take `power2.out` and never overshoot; in the slam `OVERSHOOT ≤ ~2`.
- `ITEM_COUNT × STAGGER ≤ ~0.5s` — the group must land inside one beat.
- Entrances state the collapsed from-state in `fromTo` — never rely on a CSS-hidden start (it renders visible before the tween claims it under seek).
- `transform-origin: 50% 50%` for an in-place pop; the source point only for the anchored variation.
- This is a finite arrival — idle motion on a held element is a separate, later `sine-wave-loop` tween.

## See also

`center-outward-expansion` (pop while radiating to slots) · `press-release-spring` (the click-feedback counterpart) · `sine-wave-loop` (post-arrival jitter, sparingly).
