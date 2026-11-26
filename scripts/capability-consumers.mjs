import ts from 'typescript'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const repos = [
  [root, ['.']],
  [resolve(process.env.SLATES_DESKTOP_DIR || join(root, '../slate')), ['.']],
  [resolve(process.env.SLATES_API_DIR || join(root, '../slates-api')), ['.']],
  [resolve(process.env.SLATES_WEB_DIR || join(root, '../slates-web')), ['scripts/llm-docs']],
]

function checkFile(file, source) {
  const bound = /(?:max|limit|cap)\w*prompt|prompt\w*(?:max|limit|cap)|TTS_MAX_CHARACTERS/i
  if (!/maxReferenceAudio|getMaxRefAudio/.test(source) && !(source.includes('.length') && (bound.test(source) || /prompt/i.test(source)))) return
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const capacity = /\b(?:maxReferenceAudio|getMaxRefAudio)\b/
  const behavior = /soundCanBeDisabled|autoAttachCharacterVoice|(?:toggle|disable|set|enable)Sound|sound(?:Switch|Toggle)|characterVoice|attach(?:Character)?Voice|voiceVideoModels|no-character-voice/i
  const initializers = new Map()
  function tracks(node, predicate, seen = new Set()) {
    if (predicate(node)) return true
    if (ts.isFunctionLike(node) || ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node) || seen.size >= 3) return false
    if (ts.isIdentifier(node) && initializers.has(node.text) && !seen.has(node.text)) {
      return tracks(initializers.get(node.text), predicate, new Set([...seen, node.text]))
    }
    return !!ts.forEachChild(node, child => tracks(child, predicate, seen) || undefined)
  }
  const isBound = node => ts.isIdentifier(node) && bound.test(node.text)
  const isLength = node => ts.isPropertyAccessExpression(node) && node.name.text === 'length'
  const isPromptLength = node => isLength(node) &&
    ((ts.isIdentifier(node.expression) && /prompt$/i.test(node.expression.text)) ||
      (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'prompt'))
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) initializers.set(node.name.text, node.initializer)
    if (ts.isBinaryExpression(node) && ['>', '<', '>=', '<=', '===', '!=='].includes(node.operatorToken.getText(ast))) {
      const comparesBound = ([a, b]) => {
        if (tracks(a, isBound) && tracks(b, isLength)) return true
        // A literal in a validation branch is a bound too. Display-only ellipses use the length of their sliced preview.
        return ['<', '>', '<=', '>='].includes(node.operatorToken.getText(ast)) &&
          ts.isNumericLiteral(a) && Number(a.text) > 0 && tracks(b, isPromptLength) &&
          !(ts.isConditionalExpression(node.parent) && /^['"](?:\.\.\.|…)['"]$/.test(node.parent.whenTrue.getText(ast)))
      }
      if ([[node.left, node.right], [node.right, node.left]].some(comparesBound)) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        console.error(`${file}:${line}: use promptLengthFor before comparing a prompt bound. String.length counts UTF-16 units.`)
        process.exitCode = 1
      }
    }
    const value = ts.isIfStatement(node) || ts.isConditionalExpression(node) ? node.expression :
      ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) ? node.initializer :
      ts.isReturnStatement(node) ? node.expression : undefined
    if (value && !ts.isObjectLiteralExpression(value) && !ts.isFunctionLike(value) &&
        !(ts.isCallExpression(value) && value.arguments.some(ts.isFunctionLike) && !node.name?.getText(ast).match(behavior)) &&
        (capacity.test(value.getText(ast)) || (ts.isIdentifier(value) || ts.isPrefixUnaryExpression(value) || ts.isBinaryExpression(value)) &&
          tracks(value, part => ts.isIdentifier(part) && capacity.test(part.text)))) {
      let context = node.getText(ast)
      if (ts.isReturnStatement(node)) {
        const fn = ts.findAncestor(node, ts.isFunctionLike)
        if (fn?.name) context += ' ' + fn.name.getText(ast)
      }
      if (behavior.test(context)) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        console.error(`${file}:${line}: read soundCanBeDisabled or autoAttachCharacterVoice for this behavior. maxReferenceAudio only counts clips.`)
        process.exitCode = 1
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}

for (const [repo, paths] of repos) {
  if (!existsSync(repo) && process.env.CI) continue
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths], { cwd: repo, encoding: 'utf8', maxBuffer: 20_000_000 })
  for (const path of files.split('\0')) {
    if (!/\.[cm]?[jt]sx?$/.test(path) || /(?:^|\/)(?:vendor|dist|node_modules)\//.test(path)) continue
    const file = join(repo, path)
    if (existsSync(file)) checkFile(file, readFileSync(file, 'utf8'))
  }
}
