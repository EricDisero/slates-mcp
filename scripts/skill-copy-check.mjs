// Customers read the skills (through the MCP server, the skills pack and the Prompt
// Builder), so they follow the vault's pricing-in-copy rule: prices in credits, never a
// raw provider rate, and never the service that serves a model. Model makers are fine.
// Receipt: 2026-10-17, raw $/s rates in five skills shipped in shared 0.7.5.
//
// HTML comments are copy too: a `<!-- src: ... -->` line ships to every client verbatim in
// the brain bundle. Every line is scanned whole, comment or not, and the fixtures below
// fail the check if that ever stops being true (2026-11-10: `fal schema` sat in sixteen
// source comments of the brain).
import assert from 'node:assert/strict'
import { readAllSkills } from './brain-source.mjs'

// A provider's name ends where a letter would continue it (`fal_KEY` is fal, `false` is not).
const banned = [
  [/\$\d+(?:\.\d+)?(?:\s*(?:\/|per)\s*(?:s|sec|second|image|M)\b)?/, 'a raw dollar rate (quote credits)'],
  [/\bfal(?:\.ai)?(?![a-z])/i, 'the serving provider fal'],
  [/\bpiapi(?![a-z])/i, 'the serving provider PiAPI'],
  [/\bevolink(?![a-z])/i, 'the serving provider EvoLink'],
  [/\bbyteplus(?![a-z])/i, 'the serving provider BytePlus'],
  [/\b(?:kuaishou|google) direct\b/i, 'a serving route name'],
]

/** Every line of `text` that breaks the rule, comments included. */
function hitsIn(name, text) {
  const hits = []
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of banned) if (re.test(line)) hits.push(`${name}:${i + 1} names ${what}: ${line.trim().slice(0, 120)}`)
  })
  return hits
}

// The scanner against fixtures: a name in a one-line comment, inside a comment spanning lines,
// and joined to a word by an underscore is a hit; ordinary words that contain the letters are not.
for (const text of [
  'A line. <!-- src: fal schema and metered read, 2026-11-10 -->',
  '<!--\nsrc: read on the provider page (fal), 2026-11-10\n-->',
  '<!-- src: FAL_KEY probe, 2026-11-10 -->',
  '<!-- src: EvoLink route, 2026-11-10 -->',
]) assert.equal(hitsIn('fixture', text).length, 1, `a provider name in a comment is a hit: ${JSON.stringify(text)}`)
for (const text of ['<!-- src: billable false, final review, 2026-10-25 -->', 'The fall of light; a falcon; 12 credits per second.']) {
  assert.deepEqual(hitsIn('fixture', text), [], `not a provider name: ${JSON.stringify(text)}`)
}

// The card and router here plus the brain in slates-api brain/ (the public half alone in single-repo CI).
const hits = Object.entries(readAllSkills()).flatMap(([skill, text]) => hitsIn(`${skill}.md`, text))
if (hits.length) {
  console.error(`skill copy check: ${hits.length} line(s) break the pricing-in-copy rule:\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log('✓ skill copy check: no raw rates or serving-provider names in the skills, comments included')
