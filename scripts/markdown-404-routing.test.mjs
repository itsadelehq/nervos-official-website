import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { after, test } from 'node:test'
import ts from 'typescript'
import { KB_HUBS } from '../config/kb-hubs.mjs'
import negotiation from './fixtures/load-markdown-accept.mjs'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
const { i18n } = require('../next-i18next.config.js')
const catalog = JSON.parse(fs.readFileSync('public/education_hub_articles/metadata/catalog.json', 'utf8'))
const migrations = JSON.parse(fs.readFileSync('public/education_hub_articles/metadata/slug-migrations.json', 'utf8'))
const previousNormalization = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE
process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = 'true'
after(() => {
  if (previousNormalization === undefined) delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE
  else process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = previousNormalization
})

function load(filename, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(
    name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency in ${filename}: ${name}`)
      return imports[name]
    },
    loaded,
    loaded.exports,
  )
  return loaded.exports
}

const hubs = load('src/utils/kb-hubs.ts', { '../../config/kb-hubs.mjs': { KB_HUBS } })
function loadMiddleware(articles = catalog.articles) {
  return load('src/middleware.page.ts', {
    'next/server': { NextRequest, NextResponse },
    '../public/education_hub_articles/metadata/slug-migrations.json': migrations,
    '../public/education_hub_articles/metadata/catalog.json': { ...catalog, articles },
    './utils/kb-hubs': hubs,
    './utils/markdown-accept': negotiation,
  })
}
const { middleware, missingKBArticlePath } = loadMiddleware()
function request(pathname, { accept = 'text/markdown', method = 'GET', headers = {} } = {}) {
  return new NextRequest(`https://www.nervos.org${pathname}`, {
    method,
    headers: { ...(accept === undefined ? {} : { accept }), ...headers },
    nextConfig: { i18n },
  })
}
function assertNext(result, message) {
  assert.equal(result.headers.get('x-middleware-next'), '1', message)
  assert.equal(result.headers.get('x-middleware-rewrite'), null, message)
  assert.equal(result.headers.get('location'), null, message)
}

test('published renditions and missing translations use the article representation rather than the B8 missing-page API', () => {
  const now = Date.parse('2026-11-16T00:00:00Z')
  let published = 0
  let translationFallbacks = 0
  for (const article of catalog.articles) {
    if (article.draft || (article.date && !(Date.parse(article.date) <= now))) continue
    published++
    assert.equal(
      missingKBArticlePath(`/knowledge-base/${encodeURIComponent(article.id)}`, article.language, now),
      false,
    )
    assertNext(middleware(request(encodeURI(article.canonicalPath), { accept: 'text/html' })), article.canonicalPath)
    assert.equal(
      middleware(request(encodeURI(article.canonicalPath))).headers.get('x-middleware-rewrite'),
      `https://www.nervos.org/api/markdown-article/${article.language}/${encodeURIComponent(article.id)}`,
    )
    if (article.language !== 'en') continue
    for (const locale of i18n.locales.filter(locale => locale !== 'en')) {
      if (catalog.articles.some(version => version.id === article.id && version.language === locale)) continue
      translationFallbacks++
      const path = `/${locale}/knowledge-base/${encodeURIComponent(article.id)}`
      assert.equal(missingKBArticlePath(`/knowledge-base/${encodeURIComponent(article.id)}`, locale, now), false, path)
      assertNext(middleware(request(path, { accept: 'text/html' })), `${path}: English fallback keeps its HTML route`)
      assert.equal(
        middleware(request(path)).headers.get('x-middleware-rewrite'),
        `https://www.nervos.org/api/markdown-article/${locale}/${encodeURIComponent(article.id)}`,
        `${path}: the article handler retains the missing-translation redirect`,
      )
    }
  }
  assert.ok(published > 0, 'The real catalog must exercise published articles')
  assert.ok(translationFallbacks > 0, 'The real catalog must exercise missing translations')
})

test('article rewrites overwrite caller-supplied identity headers with the actual locale and ID', () => {
  const id = catalog.articles.find(article => article.language === 'zh' && !article.draft).id
  const result = middleware(
    request(`/zh/knowledge-base/${encodeURIComponent(id)}?language=en&slug=other`, {
      headers: { 'x-kb-markdown-language': 'en', 'x-kb-markdown-id': 'other' },
    }),
  )
  assert.equal(result.headers.get('x-middleware-request-x-kb-markdown-language'), 'zh')
  assert.equal(result.headers.get('x-middleware-request-x-kb-markdown-id'), encodeURIComponent(id))
  assert.equal(result.headers.get('x-kb-markdown-language'), null, 'Internal identity is not a public response header')
})

const fixtureID = 'markdown-404-routing-fixture'
const fixturePath = `/knowledge-base/${fixtureID}`
function article(language, state = {}) {
  return {
    ...catalog.articles[0],
    id: fixtureID,
    language,
    canonicalPath: `${language === 'en' ? '' : `/${language}`}${fixturePath}`,
    draft: false,
    date: '2000-01-01T00:00:00Z',
    ...state,
  }
}

test('B8 distinguishes unpublished translations from missing translations and respects the publication instant', () => {
  const now = Date.parse('2030-01-01T00:00:00Z')
  for (const state of [{ draft: true }, { date: '2030-01-01T00:00:01Z' }]) {
    const fixture = loadMiddleware([article('en'), article('zh', state)])
    assert.equal(fixture.missingKBArticlePath(fixturePath, 'en', now), false)
    assert.equal(fixture.missingKBArticlePath(fixturePath, 'zh', now), true)
    assert.equal(
      fixture.missingKBArticlePath(fixturePath, 'es', now),
      false,
      'A truly missing translation uses English',
    )
    const unavailableEnglish = loadMiddleware([article('en', state)])
    assert.equal(unavailableEnglish.missingKBArticlePath(fixturePath, 'en', now), true)
    assert.equal(unavailableEnglish.missingKBArticlePath(fixturePath, 'zh', now), true)
  }
  const dated = loadMiddleware([article('en', { date: '2030-01-01T00:00:00Z' })])
  assert.equal(dated.missingKBArticlePath(fixturePath, 'en', now - 1), true)
  assert.equal(dated.missingKBArticlePath(fixturePath, 'en', now), false)
  const translatedOnly = loadMiddleware([article('zh')])
  assert.equal(translatedOnly.missingKBArticlePath(fixturePath, 'zh', now), false)
  assert.equal(translatedOnly.missingKBArticlePath(fixturePath, 'en', now), true)
  assert.equal(translatedOnly.missingKBArticlePath(fixturePath, 'es', now), true)
  assert.equal(loadMiddleware([]).missingKBArticlePath(fixturePath, 'en', now), true)
})

test('B8 rewrites missing and unpublished articles only for Markdown GET/HEAD without forwarding query selectors', () => {
  const fixture = loadMiddleware([article('en'), article('zh', { draft: true })])
  for (const pathname of ['/knowledge-base/markdown-404-not-present', `/zh${fixturePath}`]) {
    for (const method of ['GET', 'HEAD']) {
      const incoming = request(`${pathname}?page=home&url=https%3A%2F%2Fother.test&secret=do-not-forward`, { method })
      const original = incoming.url
      const result = fixture.middleware(incoming)
      assert.equal(result.status, 200)
      assert.equal(result.headers.get('location'), null)
      assert.equal(result.headers.get('x-middleware-rewrite'), 'https://www.nervos.org/api/markdown-not-found')
      assert.equal(incoming.url, original)
    }
  }
})

test('B8 preserves browser HTML, route boundaries, valid assets, API requests and Next navigation protocols', () => {
  const missing = '/knowledge-base/markdown-404-not-present'
  for (const accept of ['', '*/*', 'text/html', 'text/markdown;q=0', 'text/markdown,text/html'])
    assertNext(middleware(request(missing, { accept })), accept)
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS'])
    assertNext(middleware(request(missing, { method })), method)
  assertNext(middleware(request(missing, { headers: { 'x-nextjs-data': '1' } })), 'Next data header')
  for (const pathname of [
    '/knowledge-base/articles?page=2',
    '/knowledge-base/search?q=missing',
    '/knowledge-base/start-here',
    '/knowledge-base/topic?hub=not-a-hub',
    '/knowledge-base/topic/not-a-hub',
    '/knowledge-base/markdown-404-not-present/extra',
    '/_next/data/build/en/knowledge-base/markdown-404-not-present.json',
    '/_next/static/chunks/example.js',
    '/api/kb-search?q=missing',
    '/api/markdown-not-found',
    '/education_hub_articles/metadata/catalog.json',
    '/education_hub_articles/what_is_fiber/images/image1.png',
    '/llms.txt',
    '/robots.txt',
    '/sitemap.xml',
    '/favicon.ico',
    '/another-missing-page',
  ])
    assertNext(middleware(request(pathname)), pathname)
  for (const pathname of [
    '/',
    '/api/missing',
    '/_next/missing',
    '/education_hub_articles/missing/image.png',
    '/knowledge-base',
    '/knowledge-base/articles',
    '/knowledge-base/search',
    '/knowledge-base/start-here',
    '/knowledge-base/topic',
    '/knowledge-base/topic/missing',
    '/knowledge-base/missing/extra',
  ])
    assert.equal(missingKBArticlePath(pathname), false, pathname)
})

test('B8 keeps approved article, image, hub and retired-listing redirects ahead of missing-page detection', () => {
  const { from, to } = migrations.renames[0]
  for (const [pathname, target] of [
    [`/knowledge-base/${encodeURIComponent(from)}?keep=yes`, `/knowledge-base/${to}?keep=yes`],
    [
      `/education_hub_articles/${encodeURIComponent(from)}/images/image1.png?keep=yes`,
      `/education_hub_articles/${to}/images/image1.png?keep=yes`,
    ],
    ['/knowledge-base/topic?hub=nervos-ckb&keep=yes', '/knowledge-base/topic/nervos-ckb?keep=yes'],
    ['/knowledge-base?page=2&keep=yes', '/knowledge-base/articles?keep=yes'],
  ]) {
    const result = middleware(request(pathname))
    assert.equal(result.status, 308, pathname)
    assert.equal(result.headers.get('location'), `https://www.nervos.org${target}`, pathname)
    assert.equal(result.headers.get('x-middleware-rewrite'), null, pathname)
  }
})

const markdownError = load('src/server/markdown-error.ts', { '../utils/markdown-accept': negotiation })
const { default: apiHandler } = load('src/pages/api/markdown-not-found.page.ts', {
  '../../server/markdown-error': markdownError,
})
const { getServerSideProps } = load('src/pages/[...notFound].page.tsx', {
  'react/jsx-runtime': { jsx: () => null },
  'next/error': () => null,
  '../server/markdown-error': markdownError,
})
function response() {
  return {
    statusCode: 200,
    headers: {},
    getHeader(name) {
      return this.headers[name]
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.jsonBody = body
      this.writableEnded = true
      return this
    },
    end(body) {
      this.body = body
      this.writableEnded = true
    },
  }
}
function assertMarkdown404(res, method) {
  assert.equal(res.statusCode, 404)
  assert.equal(res.headers['Content-Type'], 'text/markdown; charset=utf-8')
  assert.equal(res.headers.Vary, 'Accept')
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control'])
    assert.match(res.headers[name], /no-store/, name)
  assert.equal(res.headers['Content-Length'], Buffer.byteLength(markdownError.markdownNotFound))
  assert.equal(res.body, method === 'HEAD' ? undefined : markdownError.markdownNotFound)
  assert.equal(res.writableEnded, true)
}

test('B8 fixed API returns the approved 404 body, no-store headers and bodyless HEAD independent of selectors', () => {
  for (const method of ['GET', 'HEAD']) {
    const res = response()
    apiHandler(
      { method, headers: { accept: 'text/markdown' }, query: { url: 'https://other.test', page: '../private' } },
      res,
    )
    assertMarkdown404(res, method)
  }
  for (const accept of ['', '*/*', 'text/html', 'text/markdown;q=0', 'text/markdown,text/html']) {
    for (const method of ['GET', 'HEAD']) {
      const res = response()
      apiHandler({ method, headers: { accept } }, res)
      assert.equal(res.statusCode, 406)
      assert.equal(res.body, undefined)
      assert.equal(res.writableEnded, true)
      if (method === 'HEAD') assert.equal(res.jsonBody, undefined)
      assert.equal(res.headers.Vary, 'Accept')
      for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control'])
        assert.match(res.headers[name], /no-store/)
    }
  }
  const res = response()
  apiHandler({ method: 'POST', headers: { accept: 'text/markdown' } }, res)
  assert.equal(res.statusCode, 405)
  assert.equal(res.headers.Allow, 'GET, HEAD')
  assert.equal(res.body, undefined)
})

test('B8 SSR fallback handles unknown root and deep paths while retaining ordinary HTML notFound behavior', async () => {
  for (const url of ['/markdown-404-not-present', '/unmatched/deep/path', '/zh/markdown-404-not-present']) {
    for (const method of ['GET', 'HEAD']) {
      const res = response()
      const result = await getServerSideProps({ req: { method, url, headers: { accept: 'text/markdown' } }, res })
      assert.deepEqual(result, { props: {} })
      assertMarkdown404(res, method)
    }
    const res = response()
    const result = await getServerSideProps({ req: { method: 'GET', url, headers: { accept: 'text/html' } }, res })
    assert.deepEqual(result, { notFound: true })
    assert.equal(res.statusCode, 404)
    assert.equal(res.writableEnded, undefined)
    assert.equal(res.headers['Content-Type'], undefined)
    assert.equal(res.headers.Vary, 'Accept')
    for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control'])
      assert.match(res.headers[name], /no-store/)
  }
})

test('B8 SSR fallback does not turn unknown APIs, framework assets or client-navigation JSON into Markdown', async () => {
  for (const req of [
    { method: 'GET', url: '/api/not-present', headers: { accept: 'text/markdown' } },
    { method: 'GET', url: '/zh/api/not-present', headers: { accept: 'text/markdown' } },
    { method: 'GET', url: '/_next/static/not-present.js', headers: { accept: 'text/markdown' } },
    { method: 'GET', url: '/_next/data/build/en/not-present.json', headers: { accept: 'text/markdown' } },
    { method: 'GET', url: '/not-present', headers: { accept: 'text/markdown', 'x-nextjs-data': '1' } },
    { method: 'POST', url: '/not-present', headers: { accept: 'text/markdown' } },
  ]) {
    const res = response()
    assert.deepEqual(await getServerSideProps({ req, res }), { notFound: true }, req.url)
    assert.equal(res.statusCode, 404)
    assert.equal(res.writableEnded, undefined)
    assert.deepEqual(res.headers, {}, req.url)
  }
})
