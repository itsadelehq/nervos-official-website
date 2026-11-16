import fs from 'node:fs'
import ts from 'typescript'

// VM tests share production negotiation rules instead of copying them into mocks.
const compiled = ts.transpileModule(
  fs.readFileSync(new URL('../../src/utils/markdown-accept.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText
const loaded = { exports: {} }
new Function('module', 'exports', compiled)(loaded, loaded.exports)

export default loaded.exports
