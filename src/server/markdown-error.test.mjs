import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import markdownAccept from '../../scripts/fixtures/load-markdown-accept.mjs'

const compiled = ts.transpileModule(fs.readFileSync('src/server/markdown-error.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  name => {
    assert.equal(name, '../utils/markdown-accept', `Unexpected Markdown error dependency: ${name}`)
    return markdownAccept
  },
  loaded,
  loaded.exports,
)
const { prefersMarkdown, respondToMarkdownNotFound, markdownNotFound } = loaded.exports

test('only an explicit, higher quality Markdown preference selects Markdown', () => {
  assert.equal(prefersMarkdown, markdownAccept.prefersMarkdown, 'The existing export shares the negotiation helper')
  for (const accept of [
    'text/markdown',
    'TEXT/MARKDOWN; charset=utf-8',
    'text/html;q=0.5, text/markdown;q=0.9',
    'text/*;q=0.3, text/markdown;q=0.8',
    'text/html;q=0, */*;q=1, text/markdown;q=0.8',
  ])
    assert.equal(prefersMarkdown(accept), true, accept)
  for (const accept of [
    undefined,
    '*/*',
    'text/*',
    'text/html,application/xhtml+xml,*/*;q=0.8',
    'text/markdown;q=0',
    'text/markdown;q=invalid',
    'text/markdown;q=1.1',
    'text/markdown;q=0.1234',
    'text/markdown;q=0.5, text/html;q=0.9',
    'text/markdown, text/html',
    'text/markdown, */*',
  ])
    assert.equal(prefersMarkdown(accept), false, accept)
})

function invoke({
  method = 'GET',
  statusCode = 404,
  accept = 'text/markdown',
  url = '/missing',
  headers = {},
  responseHeaders = {},
  ...state
} = {}) {
  const req = { method, url, headers: { accept, ...headers } }
  const res = {
    statusCode,
    headers: { ...responseHeaders },
    ...state,
    getHeader(name) {
      return this.headers[name]
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body) {
      this.body = body
      this.writableEnded = true
    },
  }
  respondToMarkdownNotFound({ req, res })
  return res
}

test('real Markdown 404 responses preserve status and provide discovery links', () => {
  const res = invoke()
  assert.equal(res.statusCode, 404)
  assert.equal(res.headers['Content-Type'], 'text/markdown; charset=utf-8')
  assert.equal(res.headers['Content-Length'], Buffer.byteLength(res.body))
  assert.match(res.body, /^# Page not found\n/)
  for (const target of [
    'https://www.nervos.org/llms.txt',
    'https://www.nervos.org/sitemap.xml',
    'https://www.nervos.org/knowledge-base',
    'https://docs.nervos.org/',
  ])
    assert.ok(res.body.includes(target))
  assert.equal(res.headers.Vary, 'Accept')
  assert.match(res.headers['Cache-Control'], /private.*no-store/)
})

test('HTML errors negotiate on the same header without ending the response', () => {
  for (const vary of ['Accept-Encoding', ['Accept-Encoding', 'X-Nextjs-Data'], 'Accept', '*']) {
    const res = invoke({ accept: 'text/html', responseHeaders: { Vary: vary } })
    assert.equal(res.writableEnded, undefined)
    assert.equal(res.headers['Content-Type'], undefined)
    assert.match(res.headers['Cache-Control'], /no-store/)
    assert.ok(res.headers.Vary === '*' || res.headers.Vary.includes('Accept'))
    assert.ok(!res.headers.Vary.includes('Accept, Accept'))
  }
})

test('HEAD returns the same headers and no body', () => {
  const res = invoke({ method: 'HEAD' })
  assert.equal(res.statusCode, 404)
  assert.equal(res.writableEnded, true)
  assert.equal(res.body, undefined)
  assert.equal(res.headers['Content-Length'], Buffer.byteLength(markdownNotFound))
})

test('valid pages, server errors, APIs, assets and Next navigation keep their protocols', () => {
  for (const options of [
    { statusCode: 200 },
    { statusCode: 500 },
    { method: 'POST' },
    { url: '/api/missing' },
    { url: '/zh/api/missing' },
    { url: '/_next/missing' },
    { url: '/en/_next/data/build/missing.json' },
    { headers: { 'x-nextjs-data': '1' } },
    { headersSent: true },
    { writableEnded: true },
  ]) {
    const res = invoke(options)
    assert.equal(res.body, undefined)
    assert.deepEqual(res.headers, {})
  }
  assert.doesNotThrow(() => respondToMarkdownNotFound({}))
})

test('a request-aware _error handles Next notFound results without adding a static 404', () => {
  const source = fs.readFileSync('src/pages/_error.page.tsx', 'utf8')
  assert.match(source, /ErrorPage\.getInitialProps\s*=\s*async/)
  assert.match(source, /await NextError\.getInitialProps\(context\)/)
  assert.match(source, /respondToMarkdownNotFound\(context\)/)
  assert.equal(fs.existsSync('src/pages/404.page.tsx'), false)
})
