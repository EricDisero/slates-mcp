---
name: slates-layer-title
description: "Layer preset: a bold title with an optional line under it, rising or slamming in and fading out. Use when someone asks for a title, a hook card, a chapter card or big words on screen; adapt its values to the footage."
---

# Title (a layer preset)

<!-- @operative:start -->
**Operative summary.**
- Use this preset when someone asks for a title, a hook card, a chapter card or big words on screen. (§ Use it)
- Write a few words that carry the point, add a line under it only if it helps, and put no em dashes on screen. (§ Use it)
- Add it with `slates_add_html_clip`, `html` set to the composition and `variables` for what you change, at least `title`. (§ Use it; § The composition)
- Change values with `slates_update_html_clip`: slam for a hook, fade for a quiet card, and `position` to keep it off the face. (§ Values it declares)
- Look at a frame with `slates-vision-feedback-loop` to confirm it sits clear of faces and inside the safe area. (§ Use it)
<!-- @operative:end -->

A title over the picture: one bold line, an optional smaller line under it, in on a rise, a slam or a fade, and out before the layer ends. In Slates every caption, title and graphic is one kind of layer: a composition with declared values (`docs/layer-contract.md` in the desktop repo). This preset is that composition. The app's **Add a layer** gallery applies it in one click with the defaults below; you adapt it to the footage.

## Use it

1. Write the words. A title is a few words that carry the point; the line under it is optional context. No em dashes on screen.
2. Add it with `slates_add_html_clip`, `html` set to the composition below and `variables` for what you change (at least `title`), at the place it belongs (`startFrame`) and for as long as it should hold (`durationSec`; three to five seconds reads).
3. Look at a frame (`slates-vision-feedback-loop`): it sits clear of faces and inside the safe area. Move it with `position`, not by editing the HTML.

## Values it declares

| Value | Type | Default | What to change it for |
|---|---|---|---|
| `title` | string | `Your title` | The words |
| `subtitle` | string | empty | A line under it; empty draws none |
| `textColor` | color | `#ffffff` | The title |
| `accent` | color | `#c8ff00` | The rule above the subtitle and the subtitle |
| `size` | number, 4–20 (vmin) | `11` | Title size; the subtitle is a third of it |
| `position` | enum `top` / `center` / `bottom` | `center` | Off the face |
| `entrance` | enum `rise` / `slam` / `fade` | `rise` | Slam for a hook, fade for a quiet card |

People change these in the Inspector; you change them with `slates_update_html_clip` (`variables`).

## The composition

```html
<!doctype html>
<html data-composition-variables='[
  {"id":"title","type":"string","label":"Title","default":"Your title","maxLength":120},
  {"id":"subtitle","type":"string","label":"Line under it","default":"","maxLength":160},
  {"id":"textColor","type":"color","label":"Text colour","default":"#ffffff"},
  {"id":"accent","type":"color","label":"Accent","default":"#c8ff00"},
  {"id":"size","type":"number","label":"Size","default":11,"min":4,"max":20,"step":0.5,"unit":"vmin"},
  {"id":"position","type":"enum","label":"Position","default":"center","options":[{"value":"top","label":"Top"},{"value":"center","label":"Centre"},{"value":"bottom","label":"Bottom"}]},
  {"id":"entrance","type":"enum","label":"Entrance","default":"rise","options":[{"value":"rise","label":"Rise"},{"value":"slam","label":"Slam"},{"value":"fade","label":"Fade"}]}
]'>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .card { position: absolute; left: 8%; right: 8%; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .title { font-family: system-ui, sans-serif; font-weight: 900; font-size: calc(var(--size) * 1vmin); line-height: 1.02; letter-spacing: -0.02em; color: var(--textColor); text-shadow: 0 0.04em 0.3em rgba(0, 0, 0, 0.5); }
  .rule { width: calc(var(--size) * 1.6vmin); height: calc(var(--size) * 0.06vmin); margin: calc(var(--size) * 0.28vmin) 0; background: var(--accent); }
  .subtitle { font-family: system-ui, sans-serif; font-weight: 600; font-size: calc(var(--size) * 0.34vmin); line-height: 1.2; color: var(--accent); text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.5); }
</style>
</head>
<body>
<div id="root" data-composition-id="title" data-start="0" data-width="1080" data-height="1920" data-duration="4">
  <div class="card" id="card">
    <div class="title" id="title" data-var-text="title">Your title</div>
    <div class="rule" id="rule"></div>
    <div class="subtitle" id="subtitle" data-var-text="subtitle"></div>
  </div>
</div>
<script>
  var vars = window.__hfVariables || {};
  var root = document.getElementById('root');
  var card = document.getElementById('card');
  var length = Number(root.getAttribute('data-duration')) || 4;
  var place = { top: { top: '12%' }, center: { top: '50%', transform: 'translateY(-50%)' }, bottom: { bottom: '18%' } }[vars.position] || { top: '50%', transform: 'translateY(-50%)' };
  Object.keys(place).forEach(function (k) { card.style[k] = place[k]; });
  if (!vars.subtitle) { document.getElementById('rule').style.display = 'none'; document.getElementById('subtitle').style.display = 'none'; }
  var tl = gsap.timeline({ paused: true });
  var title = document.getElementById('title');
  var rest = [document.getElementById('rule'), document.getElementById('subtitle')];
  if (vars.entrance === 'slam') tl.fromTo(title, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'power4.out' }, 0.05);
  else if (vars.entrance === 'fade') tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.05);
  else tl.fromTo(title, { opacity: 0, y: '0.35em' }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 0.05);
  tl.fromTo(rest, { opacity: 0, y: '0.6em' }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.08 }, 0.3);
  tl.to([title].concat(rest), { opacity: 0, duration: 0.3, ease: 'power1.in' }, Math.max(0.8, length - 0.35));
  window.__timelines['title'] = tl;
</script>
</body>
</html>
```
