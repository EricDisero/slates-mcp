---
name: slates-layer-brand-captions
description: "Layer preset: bold word-by-word captions with the emphasis words sized up in a two-colour gradient. Use when someone asks for brand captions, punchy short-form captions or captions with big emphasis words; adapt its values to the footage."
---

# Brand captions (a layer preset)

Captions for talking-head shorts: one phrase at a time, each word popping in on the frame it is said, and the words that carry the line drawn larger, heavier and in a two-colour gradient. In Slates every caption, title and graphic is one kind of layer: a composition with declared values (`docs/layer-contract.md` in the desktop repo). This preset is that composition. The app's **Add a layer** gallery applies it in one click with the defaults below; you adapt it to the footage.

## Use it

1. Transcribe and phrase the speech the way `slates-captions` says (phrases at breaths and clause changes; never split a name or a number from what it counts).
2. Mark emphasis with `tiers`: about one word in eight, the brand or product name, the number that carries the claim, the payoff. `emphasis` and `slam` words are the ones this preset sizes up; everything else is regular.
3. Call `slates_add_captions` with `html` set to the composition below (its word list is fed from your phrases and tiers) and `variables` for any value you change.
4. Look at frames (`slates-vision-feedback-loop`): the phrase must sit clear of faces and of the platform's buttons (**Show safe area**). Move it with the `position` value, not by editing the HTML.

## Values it declares

| Value | Type | Default | What to change it for |
|---|---|---|---|
| `textColor` | color | `#ffffff` | Regular words; keep near white on busy footage |
| `accentA`, `accentB` | color | `#ff3b3b`, `#e6e6e6` | The emphasis gradient: the brand's two colours |
| `size` | number, 3–14 (vmin) | `7` | Regular word size; smaller for long talk, larger for hooks |
| `emphasisScale` | number, 1–2.5 | `1.5` | How much bigger an emphasis word draws |
| `position` | enum `low` / `middle` / `high` | `low` | Off the face and clear of the buttons |
| `uppercase` | boolean | `false` | All caps for a louder hook |

A person changes these in the Inspector, and you change them with `slates_update_html_clip` (`variables`). Change a value before you change the HTML: a value edit keeps the layer a preset the Inspector can still drive.

## The composition

```html
<!doctype html>
<html data-composition-variables='[
  {"id":"textColor","type":"color","label":"Text colour","default":"#ffffff"},
  {"id":"accentA","type":"color","label":"Emphasis colour 1","default":"#ff3b3b"},
  {"id":"accentB","type":"color","label":"Emphasis colour 2","default":"#e6e6e6"},
  {"id":"size","type":"number","label":"Size","default":7,"min":3,"max":14,"step":0.5,"unit":"vmin"},
  {"id":"emphasisScale","type":"number","label":"Emphasis size","default":1.5,"min":1,"max":2.5,"step":0.05},
  {"id":"position","type":"enum","label":"Position","default":"low","options":[{"value":"low","label":"Low"},{"value":"middle","label":"Middle"},{"value":"high","label":"High"}]},
  {"id":"uppercase","type":"boolean","label":"All caps","default":false}
]'>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .group { position: absolute; left: 6%; right: 6%; display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 0 0.28em; opacity: 0; }
  .word { display: inline-block; font-family: system-ui, sans-serif; font-weight: 800; font-size: calc(var(--size) * 1vmin); line-height: 1.12; color: var(--textColor); text-shadow: 0 0.06em 0.22em rgba(0, 0, 0, 0.55); opacity: 0; }
  .word.em { font-weight: 900; font-style: italic; font-size: calc(var(--size) * var(--emphasisScale) * 1vmin); padding-right: 0.08em; background: linear-gradient(100deg, var(--accentA), var(--accentB)); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 0.05em 0.18em rgba(0, 0, 0, 0.5)); }
</style>
</head>
<body>
<div id="root" data-composition-id="brand-captions" data-start="0" data-width="1080" data-height="1920" data-duration="8"></div>
<script>
  var WORDS = [{ text: "Captions", start: 0.2, end: 0.6 }, { text: "that", start: 0.6, end: 0.8 }, { text: "land", start: 0.8, end: 1.3 }, { text: "every", start: 1.6, end: 1.9 }, { text: "word", start: 1.9, end: 2.4 }];
  var RAW_GROUPS = [[0, 2], [3, 4]];
  var KEYWORDS = new Set([2]);
  var DURATION = 8;
  var vars = window.__hfVariables || {};
  var root = document.getElementById('root');
  var top = { low: '68%', middle: '44%', high: '16%' }[vars.position] || '68%';
  var tl = gsap.timeline({ paused: true });
  RAW_GROUPS.forEach(function (range, g) {
    var group = document.createElement('div');
    group.className = 'group';
    group.style.top = top;
    root.appendChild(group);
    var first = WORDS[range[0]];
    var last = WORDS[range[1]];
    var next = RAW_GROUPS[g + 1] ? WORDS[RAW_GROUPS[g + 1][0]].start : DURATION;
    var end = Math.min(last.end + 0.3, next - 0.05);
    tl.set(group, { opacity: 1 }, Math.max(0, first.start - 0.08));
    tl.set(group, { opacity: 0 }, Math.max(first.start, end));
    for (var i = range[0]; i <= range[1]; i++) {
      var span = document.createElement('span');
      span.className = KEYWORDS.has(i) ? 'word em' : 'word';
      span.textContent = vars.uppercase ? WORDS[i].text.toUpperCase() : WORDS[i].text;
      group.appendChild(span);
      tl.fromTo(span, { opacity: 0, scale: KEYWORDS.has(i) ? 0.55 : 0.8, y: '0.25em' }, { opacity: 1, scale: 1, y: 0, duration: KEYWORDS.has(i) ? 0.2 : 0.12, ease: 'back.out(2.2)' }, Math.max(0, WORDS[i].start - 0.04));
    }
  });
  window.__timelines['brand-captions'] = tl;
</script>
</body>
</html>
```
