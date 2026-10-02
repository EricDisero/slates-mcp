import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

/** Read canonical TypeScript before a build, without writing a second compiled copy. */
export function loadTypeScriptModule(path, { onSource } = {}) {
  const cache = new Map()
  function load(filename) {
    filename = resolve(filename)
    if (cache.has(filename)) return cache.get(filename).exports
    const source = readFileSync(filename, 'utf8')
    onSource?.(filename, source)
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText
    const module = { exports: {} }
    cache.set(filename, module)
    const nativeRequire = createRequire(filename)
    const sourceRequire = (specifier) => {
      if (specifier.startsWith('.')) {
        const requested = resolve(dirname(filename), specifier)
        const candidate = requested.replace(/\.js$/, '.ts')
        if (candidate.endsWith('.ts') && existsSync(candidate)) return load(candidate)
      }
      return nativeRequire(specifier)
    }
    const execute = runInThisContext(`(function(exports, require, module, __filename, __dirname) {${compiled}\n})`, { filename })
    execute(module.exports, sourceRequire, module, filename, dirname(filename))
    return module.exports
  }
  return load(path instanceof URL ? fileURLToPath(path) : path)
}
