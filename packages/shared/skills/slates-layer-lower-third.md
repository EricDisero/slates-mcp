---
name: slates-layer-lower-third
description: "Layer preset: a lower third naming who is speaking, a name over a role beside an accent bar, sliding in and out. Use when someone asks for a lower third, a name tag, a speaker label or a credit; adapt its values to the footage."
---

# Lower third (a layer preset)

<!-- @operative:start -->
**Operative summary.**
- Use this preset when someone asks for a lower third, a name tag, a speaker label or a credit. (§ Use it)
- Ask for the name and role when you do not know them; never invent one. (§ Use it)
- Add it with `slates_add_html_clip`, `html` set to the composition and `variables` for `name`, `role` and anything else you change, shortly after the person first speaks. (§ Use it; § The composition)
- Change values with `slates_update_html_clip`: set `side` away from the face and `height` above captions or the platform's buttons. (§ Values it declares)
- Look at a frame with `slates-vision-feedback-loop` to confirm it sits inside the safe area and above captions. (§ Use it)
<!-- @operative:end -->

Who is on screen: a name over their role, beside an accent bar, sliding in from the side and out before the layer ends. In Slates every caption, title and graphic is one kind of layer: a composition with declared values (`docs/layer-contract.md` in the desktop repo). This preset is that composition. The app's **Add a layer** gallery applies it in one click with the defaults below; you adapt it to the footage.

## Use it

1. Get the name and the role right; ask when you do not know them rather than inventing one.
2. Add it with `slates_add_html_clip`, `html` set to the composition below and `variables` for `name`, `role` and anything else you change, a second or two after the person first speaks (`startFrame`), holding four to six seconds (`durationSec`).
3. Look at a frame (`slates-vision-feedback-loop`): it sits on the side away from the face and inside the safe area, above captions when both show.

## Values it declares

| Value | Type | Default | What to change it for |
|---|---|---|---|
| `name` | string | `Name Surname` | Who it is |
| `role` | string | `Role or company` | What they do; empty draws the name alone |
| `textColor` | color | `#ffffff` | The name |
| `accent` | color | `#c8ff00` | The bar |
| `size` | number, 3–10 (vmin) | `5.5` | Name size; the role is two thirds of it |
| `side` | enum `left` / `right` | `left` | Away from the face |
| `height` | number, 50–90 (% from the top) | `72` | Above captions or the platform's buttons |

People change these in the Inspector; you change them with `slates_update_html_clip` (`variables`).

## The composition

```html
<!doctype html>
<html data-composition-variables='[
  {"id":"name","type":"string","label":"Name","default":"Name Surname","maxLength":80},
  {"id":"role","type":"string","label":"Role","default":"Role or company","maxLength":120},
  {"id":"textColor","type":"color","label":"Text colour","default":"#ffffff"},
  {"id":"accent","type":"color","label":"Accent","default":"#c8ff00"},
  {"id":"size","type":"number","label":"Size","default":5.5,"min":3,"max":10,"step":0.25,"unit":"vmin"},
  {"id":"side","type":"enum","label":"Side","default":"left","options":[{"value":"left","label":"Left"},{"value":"right","label":"Right"}]},
  {"id":"height","type":"number","label":"Height","default":72,"min":50,"max":90,"step":1,"unit":"%"}
]'>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .tag { position: absolute; display: flex; align-items: stretch; gap: calc(var(--size) * 0.4vmin); }
  .bar { width: calc(var(--size) * 0.14vmin); background: var(--accent); border-radius: calc(var(--size) * 0.07vmin); }
  .text { display: flex; flex-direction: column; justify-content: center; padding: calc(var(--size) * 0.18vmin) 0; }
  .name { font-family: system-ui, sans-serif; font-weight: 800; font-size: calc(var(--size) * 1vmin); line-height: 1.05; color: var(--textColor); text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.55); }
  .role { font-family: system-ui, sans-serif; font-weight: 500; font-size: calc(var(--size) * 0.66vmin); line-height: 1.2; color: var(--textColor); opacity: 0.82; text-shadow: 0 0.05em 0.25em rgba(0, 0, 0, 0.55); }
</style>
</head>
<body>
<div id="root" data-composition-id="lower-third" data-start="0" data-width="1080" data-height="1920" data-duration="5">
  <div class="tag" id="tag">
    <div class="bar" id="bar"></div>
    <div class="text">
      <div class="name" id="name" data-var-text="name">Name Surname</div>
      <div class="role" id="role" data-var-text="role">Role or company</div>
    </div>
  </div>
</div>
<script>
  var vars = window.__hfVariables || {};
  var root = document.getElementById('root');
  var tag = document.getElementById('tag');
  var length = Number(root.getAttribute('data-duration')) || 5;
  var right = vars.side === 'right';
  tag.style.top = (Number(vars.height) || 72) + '%';
  tag.style[right ? 'right' : 'left'] = '7%';
  if (right) { tag.style.flexDirection = 'row-reverse'; tag.style.textAlign = 'right'; }
  if (vars.role === '') document.getElementById('role').style.display = 'none';
  var from = right ? '1.2em' : '-1.2em';
  var tl = gsap.timeline({ paused: true });
  tl.fromTo('#bar', { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'power3.out' }, 0.05);
  tl.fromTo(['#name', '#role'], { opacity: 0, x: from }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out', stagger: 0.08 }, 0.15);
  tl.to(['#name', '#role'], { opacity: 0, x: from, duration: 0.3, ease: 'power2.in', stagger: 0.05 }, Math.max(1, length - 0.45));
  tl.to('#bar', { scaleY: 0, duration: 0.25, ease: 'power2.in' }, Math.max(1.1, length - 0.3));
  window.__timelines['lower-third'] = tl;
</script>
</body>
</html>
```
