import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import negotiation from '../../scripts/fixtures/load-markdown-accept.mjs'

function load(filename, imports) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(
    name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`)
      return imports[name]
    },
    module,
    module.exports,
  )
  return module.exports
}
const error = load('src/server/markdown-error.ts', { '../utils/markdown-accept': negotiation })
const english = {
  id: 'published',
  language: 'en',
  title: 'Published article',
  canonicalPath: '/knowledge-base/published',
}
const chinese = { ...english, language: 'zh', title: '中文标题', canonicalPath: '/zh/knowledge-base/published' }

function fixture({ articles = [english, chinese], states = {}, body = 'Full source body 中文\n' } = {}) {
  const rendered = []
  const module = load('src/server/markdown-articles.ts', {
    '../../next-i18next.config.js': { i18n: { locales: ['en', 'zh', 'es', 'fr', 'tr', 'ko', 'pt'] } },
    '../../config/kb-article-markdown.mjs': {
      renderKBArticleMarkdown(article, content) {
        rendered.push({ article, content })
        return `# ${article.title}\n\n${content}`
      },
    },
    './kb-content': {
      getKBArticleMetadata: (id, language) =>
        articles.find(item => item.id === id && item.language === language) ?? null,
      getKBArticleStatus: (id, language) => states[`${id}:${language}`] ?? 'missing',
      getKBArticle: () => body,
      resolveKBArticleId: id => (id === 'Old_Published' ? 'published' : id),
    },
    './markdown-error': error,
  })
  function invoke({
    url = '/api/markdown-article/zh/published',
    method = 'GET',
    accept = 'text/markdown',
    query = {},
    headers = {},
  } = {}) {
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value
      },
      getHeader(name) {
        return this.headers[name]
      },
      status(value) {
        this.statusCode = value
        return this
      },
      json(value) {
        this.jsonBody = value
        this.writableEnded = true
      },
      end(value) {
        this.body = value
        this.writableEnded = true
      },
    }
    module.markdownArticleHandler({ url, method, headers: { accept, ...headers }, query }, response)
    return response
  }
  return { ...module, invoke, rendered }
}

test('article identity comes only from supported routed API/public paths', () => {
  const { markdownArticleIdentity: identity } = fixture()
  for (const [url, expected] of [
    ['/api/markdown-article/en/published?language=zh&slug=other', { id: 'published', language: 'en' }],
    ['/api/markdown-article/es/published', { id: 'published', language: 'es' }],
  ])
    assert.deepEqual(identity(url), expected)
  for (const language of ['en', 'zh', 'es']) {
    assert.deepEqual(
      identity('/knowledge-base/published?language=other', {
        'x-kb-markdown-language': language,
        'x-kb-markdown-id': 'published',
      }),
      { id: 'published', language },
    )
  }
  for (const url of [
    undefined,
    '/',
    '/api/markdown-article/xx/published',
    '/api/markdown-article/en/%broken',
    '/api/markdown-article/en/a%2fb',
    '/api/markdown-article/en/a%5cb',
    '/api/markdown-article/en/a%00b',
    '/api/markdown-article/en/published/extra',
    '/xx/knowledge-base/published',
  ])
    assert.equal(identity(url), null, url)
})

test('published articles return their actual language, canonical source and complete shared Markdown', () => {
  const { invoke, rendered } = fixture()
  const response = invoke({ query: { slug: 'other', language: 'en' } })
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['Content-Type'], 'text/markdown; charset=utf-8')
  assert.equal(response.headers['Content-Language'], 'zh')
  assert.equal(response.headers.Link, '<https://www.nervos.org/zh/knowledge-base/published>; rel="canonical"')
  assert.equal(response.headers.Vary, 'Accept')
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control'])
    assert.match(response.headers[name], /no-store/)
  assert.equal(response.body, '# 中文标题\n\nFull source body 中文\n')
  assert.equal(response.headers['Content-Length'], Buffer.byteLength(response.body))
  assert.equal(response.headers.ETag, undefined)
  assert.deepEqual(rendered, [{ article: chinese, content: 'Full source body 中文\n' }])
})

test('HEAD keeps UTF-8 length and headers but omits the Markdown body', () => {
  const { invoke } = fixture()
  const get = invoke(),
    head = invoke({ method: 'HEAD' })
  assert.equal(head.statusCode, 200)
  assert.deepEqual(head.headers, get.headers)
  assert.equal(head.body, undefined)
})

test('rewritten public URLs use middleware-bound identity after locale-prefix normalization', () => {
  const { invoke, markdownArticleIdentity: identity } = fixture()
  const zh = invoke({
    url: '/knowledge-base/published?language=en',
    query: { language: 'en', slug: 'other' },
    headers: { 'x-kb-markdown-language': 'zh', 'x-kb-markdown-id': 'published' },
  })
  assert.equal(zh.headers['Content-Language'], 'zh')
  assert.match(zh.body, /^# 中文标题/)
  const fr = invoke({
    url: '/knowledge-base/published',
    headers: { 'x-kb-markdown-language': 'fr', 'x-kb-markdown-id': 'published' },
  })
  assert.equal(fr.statusCode, 308)
  assert.equal(fr.headers.Location, english.canonicalPath)
  assert.equal(
    identity('/knowledge-base/published', { 'x-kb-markdown-language': 'zh', 'x-kb-markdown-id': 'other' }),
    null,
  )
  assert.equal(
    identity('/zh/knowledge-base/published', { 'x-kb-markdown-language': 'fr', 'x-kb-markdown-id': 'published' }),
    null,
  )
  assert.equal(identity('/knowledge-base/published'), null)
  const direct = invoke({ headers: { 'x-kb-markdown-language': 'en', 'x-kb-markdown-id': 'other' } })
  assert.equal(direct.headers['Content-Language'], 'zh', 'Direct APIs ignore caller-supplied identity headers')
})

test('missing translations redirect to English; unpublished translations do not fall back', () => {
  const absent = fixture({ articles: [english] }).invoke({ url: '/api/markdown-article/fr/published' })
  assert.equal(absent.statusCode, 308)
  assert.equal(absent.headers.Location, english.canonicalPath)
  assert.equal(absent.body, undefined)
  const unpublished = fixture({ articles: [english], states: { 'published:fr': 'unpublished' } }).invoke({
    url: '/api/markdown-article/fr/published',
  })
  assert.equal(unpublished.statusCode, 404)
  assert.equal(unpublished.headers.Location, undefined)
  assert.equal(unpublished.body, error.markdownNotFound)
})

test('unknown, unpublished, malformed and unavailable article bodies retain the approved 404', () => {
  for (const response of [
    fixture().invoke({ url: '/api/markdown-article/en/unknown' }),
    fixture({ articles: [] }).invoke(),
    fixture().invoke({ url: '/api/markdown-article/en/%broken' }),
    fixture({ body: null }).invoke(),
  ]) {
    assert.equal(response.statusCode, 404)
    assert.equal(response.body, error.markdownNotFound)
    assert.equal(response.headers['Content-Type'], 'text/markdown; charset=utf-8')
    assert.match(response.headers['Vercel-CDN-Cache-Control'], /no-store/)
  }
})

test('approved aliases redirect to canonical article paths without rendering duplicate bodies', () => {
  const { invoke, rendered } = fixture()
  const response = invoke({ url: '/api/markdown-article/zh/Old_Published' })
  assert.equal(response.statusCode, 308)
  assert.equal(response.headers.Location, chinese.canonicalPath)
  assert.equal(rendered.length, 0)
})

test('direct API requests reject unsupported methods and non-Markdown preferences', () => {
  const { invoke, rendered } = fixture()
  for (const accept of ['', '*/*', 'text/html', 'text/markdown;q=0', 'text/markdown,text/html']) {
    const response = invoke({ accept })
    assert.equal(response.statusCode, 406)
  }
  assert.equal(invoke({ method: 'HEAD', accept: 'text/html' }).body, undefined)
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = invoke({ method })
    assert.equal(response.statusCode, 405)
    assert.equal(response.headers.Allow, 'GET, HEAD')
  }
  assert.equal(rendered.length, 0)
})
