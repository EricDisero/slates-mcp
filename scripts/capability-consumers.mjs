import ts from 'typescript'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const repos = [
  [root, ['packages']],
  [resolve(process.env.SLATES_DESKTOP_DIR || join(root, '../slate')), ['src']],
  [resolve(process.env.SLATES_API_DIR || join(root, '../slates-api')), ['src']],
  [resolve(process.env.SLATES_WEB_DIR || join(root, '../slates-web')), ['scripts/llm-docs']],
]

function checkFile(file, source) {
  if (!/maxReferenceAudio|getMaxRefAudio/.test(source)) return
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const capacity = /\b(?:maxReferenceAudio|getMaxRefAudio)\b/
  const behavior = /soundCanBeDisabled|autoAttachCharacterVoice|(?:toggle|disable|set|enable)Sound|sound(?:Switch|Toggle)|characterVoice|voiceVideoModels|no-character-voice/i
  function visit(node) {
    const value = ts.isIfStatement(node) || ts.isConditionalExpression(node) ? node.expression :
      ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) ? node.initializer :
      ts.isReturnStatement(node) ? node.expression : undefined
    if (value && !ts.isObjectLiteralExpression(value) && !ts.isFunctionLike(value) &&
        !(ts.isCallExpression(value) && value.arguments.some(ts.isFunctionLike) && !node.name?.getText(ast).match(behavior)) &&
        capacity.test(value.getText(ast))) {
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
    if (!/\.[cm]?[jt]sx?$/.test(path) || path.includes('/vendor/')) continue
    const file = join(repo, path)
    if (existsSync(file)) checkFile(file, readFileSync(file, 'utf8'))
  }
}
