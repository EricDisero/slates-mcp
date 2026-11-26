import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { CONFIRM_CREDITS } from '../packages/shared/dist/index.js'
import { servingWords } from './serving-words.mjs'

let facts
function billingFacts() {
  if (facts) return facts
  const api = resolve(process.env.SLATES_API_DIR || resolve(import.meta.dirname, '../../slates-api'))
  const code = "import { CREDIT_COSTS, LICENSE_CREDIT_GRANT } from './src/types/index.ts'; console.log(JSON.stringify({...CREDIT_COSTS, LICENSE_CREDIT_GRANT}))"
  facts = { ...JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: api, encoding: 'utf8', maxBuffer: 2 ** 20 })), CONFIRM_CREDITS }
  return facts
}

// An expression starts at a billing key. A sum or difference combines keys, a factor
// counts takes and a divisor converts a multi-second key to credits per second.
function amount(expression) {
  const [first, ...rest] = expression.trim().split(/\s+/)
  const prices = billingFacts()
  let total = prices[first]
  while (rest.length) {
    const op = rest.shift()
    const rhs = rest.shift()
    if (op === '+') total += prices[rhs]
    else if (op === '-') total -= prices[rhs]
    else if (op === '*' && /^\d+$/.test(rhs)) total *= Number(rhs)
    else if (op === '/' && /^[1-9]\d*$/.test(rhs)) total /= Number(rhs)
    else return NaN
  }
  return total
}

const numerals = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const numeral = '(?:[0-9][0-9,]*(?:\\.[0-9]+)?|' + numerals.join('|') + ')'
const credit = new RegExp('(?<![\\w.])(' + numeral + ')(?:[ -]+|(?=cr\\b))(?:credits?|cr)\\b|\\bcredits?\\s*[:=]\\s*(' + numeral + ')\\b', 'gi')
const anchors = /<!--\s*src: price:\s*([^<>]+?), \d{4}-\d{2}-\d{2}\s*-->/g

export function guideCopyProblems(name, markdown) {
  const problems = []
  let creditColumn = -1
  for (const [index, raw] of markdown.split(/\r?\n/).entries()) {
    const fail = reason => problems.push(`${name}:${index + 1}: ${reason}`)
    if (servingWords.test(raw)) fail('names a serving provider: ' + raw.trim().slice(0, 120))
    if (/\$\s*(?:\d|\.\d)/.test(raw)) fail('raw dollar figure: quote the billed credits')
    const refs = [...raw.matchAll(anchors)].flatMap(match => match[1].split(';'))
    const line = raw.replace(anchors, '')
    const plain = line.replace(/[*_`~]/g, '')
    // Each end of a price range needs its own billing fact.
    const quantities = plain.replace(/(\d[\d,.]*)\s*(?:[–—-]|to)\s*(?=\d[\d,.]*\s*(?:credits?|cr)\b)/gi, '$1 credits, ')
    if (/\b(?:hundred|thousand|million|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -]+(?:and|[a-z]+)){0,2}[ -]+credits?\b/i.test(quantities)) {
      fail('write the credit count in digits and anchor it to its billing fact')
    }
    const values = [...quantities.matchAll(credit)].map(match => {
      const token = (match[1] ?? match[2]).toLowerCase()
      return numerals.includes(token) ? numerals.indexOf(token) : Number(token.replaceAll(',', ''))
    })
    const cells = line.trim().split('|').slice(1, -1)
    const header = cells.findIndex(cell => /^\s*(?:cost(?: in credits)?|credits)\s*$/i.test(cell))
    if (!cells.length) creditColumn = -1
    else if (header !== -1) creditColumn = header
    else if (creditColumn !== -1) {
      const cell = (cells[creditColumn] || '').replace(/<!--[\s\S]*?-->/g, '').replace(/[*~+,]/g, '').trim()
      if (/^\d+(?:\.\d+)?$/.test(cell)) values.push(Number(cell))
    }
    if (!values.length && !refs.length) continue
    if (refs.length !== values.length) fail(`anchor each of the ${values.length} credit figures to its billing fact with <!-- src: price: cost-key, YYYY-MM-DD -->`)
    else for (const [i, ref] of refs.entries()) {
      const expected = amount(ref)
      if (values[i] !== expected) fail(`credit claim ${values[i]} disagrees with ${ref.trim()} (${expected})`)
    }
  }
  return problems
}
