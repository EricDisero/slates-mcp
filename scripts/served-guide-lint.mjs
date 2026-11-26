import assert from 'node:assert/strict'
import { guideCopyProblems } from './brain-prices.mjs'
import { loadTypeScriptModule } from './load-typescript.mjs'

const { matcherFor, parseGuideBans } = loadTypeScriptModule(new URL('../packages/shared/src/prompts/guide-bans.ts', import.meta.url))

// Prompts are fenced or explicitly labelled. A bad example can demonstrate a ban.
const NEGATIVE = /^[>\s*-]*(?:\u274c|\u2717|(?:bad|wrong|avoid|never use|don't|do not|not this|what not to send)\b)/iu
const POSITIVE = /(?:\u2705[ \t]*|^(?:[>\s*-]*)(?:good|better|positive example|example prompt):[ \t]*)(.*)/iu
const FENCE = /^\s*(\x60{3,}|~{3,})(.*)$/

function exampleProblems(name, markdown, bans) {
  const problems = []
  if (!bans.some((ban) => ban.checkable)) return problems
  const prose = markdown.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\r\n]/g, ' '))
  let previous = ''
  let fence
  const check = (sample, start, condition) => {
    for (const ban of bans) {
      if (!ban.checkable || (ban.when && ban.when !== condition)) continue
      const match = matcherFor(ban.token).exec(sample)
      if (match) {
        const line = start + sample.slice(0, match.index).split(/\r?\n/).length - 1
        problems.push(`${name}:${line}: positive prompt uses banned token "${ban.token}"; rewrite the example or label it as a bad example`)
      }
    }
  }
  for (const [index, line] of prose.split(/\r?\n/).entries()) {
    const marker = FENCE.exec(line)
    if (fence) {
      if (marker?.[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2].trim()) {
        if (fence.positive) check(fence.lines.map((line) => NEGATIVE.test(line) ? '' : line).join('\n'), fence.start, fence.condition)
        fence = undefined
      } else fence.lines.push(line)
      continue
    }
    if (marker) {
      const info = marker[2].trim().toLowerCase()
      fence = {
        marker: marker[1], start: index + 2, lines: [],
        positive: !NEGATIVE.test(previous) && /^(?:|(?:text|prompt)(?: (?:reference-video|edit))?)$/.test(info),
        condition: info.split(/\s+/)[1],
      }
      previous = ''
      continue
    }
    const inline = POSITIVE.exec(line)
    if (inline?.[1]) check(inline[1], index + 1)
    if (line.trim()) previous = line.trim()
  }
  return problems
}

export function servedGuideProblems(skills) {
  return Object.entries(skills).flatMap(([name, markdown]) => {
    const problems = guideCopyProblems(name, markdown)
    try {
      const bans = parseGuideBans(name, markdown, true)
      return [...problems, ...exampleProblems(name, markdown, bans)]
    } catch (error) {
      return [...problems, error.message]
    }
  })
}

export function selfTestServedGuides() {
  const name = 'fixture.md'
  const header = '<!-- @banned:start -->\n- Ban: `very cinematic`\n- Ban (edit): `replace everything`\n- Warn: `staged`\n<!-- @banned:end -->'
  const fence = (content, info = 'prompt') => '```' + info + '\n' + content + '\n```'
  const lint = (body) => servedGuideProblems({ [name]: `${header}\n\n${body}` })
  for (const [body, want] of [
    ['Use the HyperFrames engine.', /white-label/],
    ['<!-- Source: FAL_KEY -->', /serving provider/],
    ['| Mode | Price |\n| --- | --- |\n| Fast | 50 |', /literal price/],
    [fence('A very cinematic shot.'), /fixture\.md:8: positive prompt.*very cinematic/],
    ['> \u274c `bad` \u2192 \u2705 `very cinematic`', /positive prompt/],
    [fence('Replace everything.', 'prompt edit'), /positive prompt.*replace everything/],
  ]) assert.match(lint(body).join('\n'), want)
  for (const body of [
    'Never use `very cinematic`.',
    'Bad:\n\n' + fence('Very cinematic.'),
    '**What NOT to send**\n\n' + fence('Very cinematic.'),
    fence('\u2717 Very cinematic.\n\u2713 Oil smoke over a garage.'),
    '> \u274c `very cinematic` \u2192 \u2705 `Overcast light on a parked van.`',
    fence('Replace everything in the scene. It looks staged.'),
    'The board takes 50 frames as a batch.',
  ]) assert.deepEqual(lint(body), [], body)
  console.log('served-guide lint self-test: 6 violations caught, 7 allowed cases kept')
}
