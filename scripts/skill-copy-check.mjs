// Customers read the skills (through the MCP server, the skills pack and the Prompt
// Builder), so they follow the vault's pricing-in-copy rule: prices in credits, never a
// raw provider rate, and never the service that serves a model. Model makers are fine.
// Receipt: 2026-10-17, raw $/s rates in five skills shipped in shared 0.7.5.
import { readAllSkills } from './brain-source.mjs'

// The card and router here plus the brain in slates-api brain/ (the public half alone in single-repo CI).
const skills = readAllSkills()
const banned = [
  [/\$\d+(?:\.\d+)?(?:\s*(?:\/|per)\s*(?:s|sec|second|image|M)\b)?/, 'a raw dollar rate (quote credits)'],
  [/\bfal(?:\.ai)?\b/i, 'the serving provider fal'],
  [/\bpiapi\b/i, 'the serving provider PiAPI'],
  [/\bevolink\b/i, 'the serving provider EvoLink'],
  [/\bbyteplus\b/i, 'the serving provider BytePlus'],
  [/\b(?:kuaishou|google) direct\b/i, 'a serving route name'],
]

const hits = []
for (const [skill, text] of Object.entries(skills)) {
  const name = `${skill}.md`
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of banned) if (re.test(line)) hits.push(`${name}:${i + 1} names ${what}: ${line.trim().slice(0, 120)}`)
  })
}
if (hits.length) {
  console.error(`skill copy check: ${hits.length} line(s) break the pricing-in-copy rule:\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log('✓ skill copy check: no raw rates or serving-provider names in the skills')
