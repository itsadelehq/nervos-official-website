import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { after, test } from 'node:test'
import ts from 'typescript'
import { KB_HUBS } from '../config/kb-hubs.mjs'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
const { i18n } = require('../next-i18next.config.js')
const previousNormalization = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE
process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = 'true'
after(() => {
  if (previousNormalization === undefined) delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE
  else process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = previousNormalization
})

function load(filename, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(
    name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`)
      return imports[name]
    },
    loaded,
    loaded.exports,
  )
  return loaded.exports
}
const negotiation = load('src/utils/markdown-accept.ts')
const hubs = load('src/utils/kb-hubs.ts', { '../../config/kb-hubs.mjs': { KB_HUBS } })
const { middleware } = load('src/middleware.page.ts', {
  'next/server': { NextRequest, NextResponse },
  '../public/education_hub_articles/metadata/slug-migrations.json': JSON.parse(
    fs.readFileSync('public/education_hub_articles/metadata/slug-migrations.json', 'utf8'),
  ),
  '../public/education_hub_articles/metadata/catalog.json': JSON.parse(
    fs.readFileSync('public/education_hub_articles/metadata/catalog.json', 'utf8'),
  ),
  './utils/kb-hubs': hubs,
  './utils/markdown-accept': negotiation,
})

function request(pathname, accept = 'text/markdown', method = 'GET', headers = {}) {
  return new NextRequest(`https://www.nervos.org${pathname}`, {
    method,
    headers: { ...(accept ? { accept } : {}), ...headers },
    nextConfig: { i18n },
  })
}

test('B9 rewrites only the two English landings to a fixed same-origin read-only resource', () => {
  for (const [pathname, page] of [
    ['/', 'home'],
    ['/en', 'home'],
    ['/knowledge-base', 'knowledge-base'],
    ['/en/knowledge-base', 'knowledge-base'],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const incoming = request(`${pathname}?utm_source=b9&secret=do-not-forward`, 'text/markdown', method)
      const original = incoming.url
      const result = middleware(incoming)
      assert.equal(result.status, 200)
      assert.equal(result.headers.get('location'), null)
      assert.equal(result.headers.get('x-middleware-rewrite'), `https://www.nervos.org/api/markdown-homepage/${page}`)
      assert.equal(incoming.url, original)
    }
  }
})

test('B9 preserves browser HTML, excluded locales, methods, articles and Next data protocols', () => {
  const cases = []
  for (const pathname of ['/', '/knowledge-base']) {
    for (const accept of [undefined, '*/*', 'text/html', 'text/markdown;q=0', 'text/markdown,text/html'])
      cases.push(request(pathname, accept ?? ''))
    cases.push(request(pathname, 'text/markdown', 'POST'))
    cases.push(request(pathname, 'text/markdown', 'GET', { 'x-nextjs-data': '1' }))
    cases.push(request('/zh' + pathname))
    cases.push(request('/es' + pathname))
  }
  for (const pathname of [
    '/_next/data/b9-build/en.json',
    '/_next/data/b9-build/en/knowledge-base.json',
    '/knowledge-base/articles',
    '/knowledge-base/what_is_fiber',
    '/knowledge-base/start-here',
    '/api/markdown-homepage',
    '/llms.txt',
  ])
    cases.push(request(pathname))
  for (const incoming of cases) {
    const result = middleware(incoming)
    assert.equal(result.headers.get('x-middleware-next'), '1', incoming.url)
    assert.equal(result.headers.get('x-middleware-rewrite'), null, incoming.url)
  }
})

test('B9 leaves retired KB selectors and article migrations in control', () => {
  for (const [from, target] of [
    ['/knowledge-base?page=2&utm_source=b9', '/knowledge-base/articles?utm_source=b9'],
    ['/knowledge-base?sort_by=popular&utm_source=b9', '/knowledge-base?utm_source=b9'],
    ['/knowledge-base/topic?hub=nervos-ckb', '/knowledge-base/topic/nervos-ckb'],
  ]) {
    const response = middleware(request(from))
    assert.equal(response.status, 308)
    assert.equal(response.headers.get('location'), 'https://www.nervos.org' + target)
    assert.equal(response.headers.get('x-middleware-rewrite'), null)
  }
})

function invoke({ page = 'home', method = 'GET', accept = 'text/markdown', query = {} } = {}) {
  const calls = []
  const responseModule = load('src/server/markdown-homepage-response.ts', {
    '../utils/markdown-accept': negotiation,
    './markdown-homepages': {
      renderMarkdownHomepage: selected => {
        calls.push(selected)
        return '# Example\n\nUnicode: 中文\n'
      },
    },
  })
  const { default: handler } = load(`src/pages/api/markdown-homepage/${page}.page.ts`, {
    '../../../server/markdown-homepage-response': responseModule,
  })
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.code = code
      return this
    },
    json(body) {
      this.jsonBody = body
      return this
    },
    end(body) {
      this.body = body
      this.ended = true
    },
  }
  handler({ query, method, headers: { accept } }, response)
  return { response, calls }
}

test('B9 Markdown responses use UTF-8, Vary, no-store and correct GET/HEAD lengths', () => {
  for (const page of ['home', 'knowledge-base']) {
    const { response: get, calls } = invoke({ page })
    const { response: head } = invoke({ page, method: 'HEAD' })
    assert.deepEqual(calls, [page])
    assert.equal(get.code, 200)
    assert.equal(get.headers['Content-Type'], 'text/markdown; charset=utf-8')
    assert.equal(get.headers.Vary, 'Accept')
    for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control'])
      assert.match(get.headers[key], /no-store/)
    assert.equal(get.headers['Content-Length'], Buffer.byteLength(get.body))
    assert.equal(head.code, 200)
    assert.equal(head.headers['Content-Length'], get.headers['Content-Length'])
    assert.equal(head.body, undefined)
    assert.equal(head.ended, true)
    assert.equal(get.headers.ETag, undefined)
  }
})

test('B9 fixed routes ignore query selectors and reject non-Markdown representations or unsupported methods', () => {
  for (const query of [
    { page: ['home', 'knowledge-base'] },
    { page: '../private' },
    { page: 'https://other.test', homepage: 'knowledge-base' },
  ]) {
    const { response, calls } = invoke({ query })
    assert.equal(response.code, 200)
    assert.deepEqual(calls, ['home'])
  }
  for (const accept of ['', '*/*', 'text/html', 'text/markdown;q=0']) {
    const { response, calls } = invoke({ accept })
    assert.equal(response.code, 406)
    assert.deepEqual(calls, [])
  }
  const { response, calls } = invoke({ method: 'POST' })
  assert.equal(response.code, 405)
  assert.equal(response.headers.Allow, 'GET, HEAD')
  assert.deepEqual(calls, [])
})
