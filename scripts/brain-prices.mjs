import { loadTypeScriptModule } from './load-typescript.mjs'
import { WHITE_LABEL_WORDS } from './white-label-words.mjs'

const { CONFIRM_CREDITS } = loadTypeScriptModule(new URL('../packages/shared/src/operations/confirm-threshold.ts', import.meta.url))
import { servingWords } from './serving-words.mjs'

const numberWord = 'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million'
const amount = '(?:\\d[\\d,]*(?:\\.\\d+)?|\\.\\d+|(?:' + numberWord + '))'
const unit = '(?:credits?|cr|dollars?|cents?|USD|CAD)'
const figure = new RegExp('(?<![\\w.])' + amount + '[\\s-]*' + unit + '\\b|\\b' + unit + '\\s*[:=]\\s*' + amount + '\\b|\\b(?:USD|CAD)\\s*' + amount + '|[$€£]\\s*[+-]?\\s*(?:\\d|\\.\\d)|\\d\\s*¢', 'i')
const priceLabel = /^(?:(?:unit|total|estimated)\s+)?(?:credits?|cr|dollars?|usd|cad|cost|price|rate)(?:\b|\/)/i
const cellFigure = new RegExp('(?<![\\w.])' + amount + '(?!\\w)', 'i')

// Markdown tables may omit their outer pipes. Price columns are set only by the header.
function cellsOf(line) {
  if (!line.includes('|')) return []
  return line.replace(/<!--.*?-->/g, '').trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
}

/** Numeric quotes come from a pricing tool. Comments, examples and price-table cells reach the agent too. */
export function guideCopyProblems(name, markdown) {
  const problems = []
  let priceColumns = []
  let previousCells = []
  for (const [index, raw] of markdown.split(/\r?\n/).entries()) {
    const fail = reason => problems.push(`${name}:${index + 1}: ${reason}`)
    if (servingWords.test(raw) || WHITE_LABEL_WORDS.test(raw)) {
      fail('names a serving provider or white-label engine: use the model or Slates feature name in place of ' + raw.trim().slice(0, 120))
    }
    // This generated threshold describes the confirmation response. Its value must still match the code.
    const plain = raw.replace(
      `**Confirm gate:** above **${CONFIRM_CREDITS} credits** an op returns \`requires_confirm\``,
      'Confirm gate'
    ).replace(/[*_`~]/g, '')
    const cells = cellsOf(plain)
    if (!cells.length) priceColumns = []
    else if (cells.every(cell => /^:?-{3,}:?$/.test(cell))) {
      priceColumns = previousCells.flatMap((label, i) => priceLabel.test(label) ? [i] : [])
    }
    const rowPrice = priceLabel.test(cells[0] ?? '') && cells.slice(1).some(cell => cellFigure.test(cell))
    if (figure.test(plain) || rowPrice || priceColumns.some(i => cellFigure.test(cells[i] ?? ''))) {
      fail('literal price: quote the requested settings with a pricing tool')
    }
    previousCells = cells
  }
  return problems
}
