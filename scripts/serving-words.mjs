import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { desktopSource } from './desktop-source.mjs'

const api = resolve(process.env.SLATES_API_DIR || resolve(import.meta.dirname, '../../slates-api'))
const registry = resolve(api, 'src/types/index.ts')

function namesIn(file, variable) {
  const source = readFileSync(file, 'utf8')
  const array = new RegExp('const ' + variable + '\\s*=\\s*\\[([^\\]]+)\\]').exec(source)
  if (!array) throw new Error(`Read ${variable} in ${file} to derive the serving names`)
  return [...array[1].matchAll(/'([^']+)'/g)].map(match => match[1])
}

const snapshot = new URL('./serving-names.generated.json', import.meta.url)

function registeredNames() {
  const pricing = desktopSource('src/shared/pricing.ts')
  if (process.env.CI && (!existsSync(pricing) || !existsSync(registry))) {
    console.warn('Checking public copy against the serving names generated from the paired registries.')
    return JSON.parse(readFileSync(snapshot, 'utf8'))
  }
  const makers = new Set([...readFileSync(pricing, 'utf8').matchAll(/\bvendor: '([^']+)'/g)].map(m => m[1].toLowerCase()))
  const providers = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import { GENERATION_PROVIDERS } from './src/types/index.ts'; console.log(JSON.stringify(GENERATION_PROVIDERS))"], { cwd: api, encoding: 'utf8' }))
  const names = [...providers, ...namesIn(resolve(api, 'src/lib/error-classifier.ts'), 'UPSTREAM_NAMES')]
  const registered = [...new Set(names.map(name => name.toLowerCase()))].sort()
  const result = { rails: registered.filter(name => !makers.has(name)), makers: registered.filter(name => makers.has(name)) }
  const generated = JSON.stringify(result, null, 2) + '\n'
  if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv.includes('--write')) writeFileSync(snapshot, generated)
  else if (readFileSync(snapshot, 'utf8').replaceAll('\r\n', '\n') !== generated) throw new Error('Registry changed: run node scripts/serving-words.mjs --write.')
  return result
}

function servingPattern() {
  const { rails, makers } = registeredNames()
  // A company may also be credited as a maker. Its service domain or serving route is distinct.
  const patterns = [...rails, ...makers].map(name => {
    const word = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!makers.includes(name)) return word
    const domain = word.replace(/ ai$/, '') + '\\.(?:ai|com|io)'
    return `(?:${domain}|${word}(?:['’]s)?[ _-]+(?:api|direct|route|rail|cdn|upload|provider)(?![a-z]))`
  })
  return new RegExp('(?<![a-z0-9])(?:' + patterns.join('|') + ')(?![a-z0-9])', 'i')
}

export const servingWords = servingPattern()

// Inspect literal text, including JSX and template fragments on later lines. Transport identifiers
// are code. Visible labels, returned prose and exceptions remain in scope.
export function servingSourceHits(source, file, errorsOnly = false) {
  if (!servingWords.test(source)) return []
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const hits = []
  function visit(node, inError) {
    const parent = node.parent
    const error = inError || ts.isThrowStatement(node) || (ts.isNewExpression(node) && /Error$/.test(node.expression.getText(ast))) ||
      (ts.isPropertyAssignment(node) && /^(error|errorMessage|blocked)$/.test(node.name.getText(ast)))
    if ((!errorsOnly || error) && (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node))) {
      const value = node.text
      if (servingWords.test(value)) {
        const internal = !error && (ts.isLiteralTypeNode(parent) || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) ||
          ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind) ||
          ts.isPropertyAssignment(parent) && /^(?:provider|klingProvider|endpoint)$/.test(parent.name.getText(ast)) ||
          ts.isVariableDeclaration(parent) && /PROVIDER$/.test(parent.name.getText(ast)) ||
          ts.isCallExpression(parent) && !/\s/.test(value) && /^(?:remove|modelSupports|getAspectRatios)$/.test(parent.expression.getText(ast)))
        if (!internal) hits.push({ line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, text: value.trim().slice(0, 140) })
      }
    }
    ts.forEachChild(node, child => visit(child, error))
  }
  visit(ast, false)
  return hits
}
