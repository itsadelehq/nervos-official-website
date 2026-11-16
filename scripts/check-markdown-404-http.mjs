import assert from 'node:assert/strict'
import fs from 'node:fs'

// Run against next start, not next dev: node scripts/check-markdown-404-http.mjs [origin]
const origin = process.argv[2] ?? 'http://localhost:3010'
const catalog = JSON.parse(fs.readFileSync('public/education_hub_articles/metadata/catalog.json', 'utf8'))
const article = catalog.articles.find(
  item => item.language === 'en' && !item.draft && Date.parse(item.date) <= Date.now(),
)
assert.ok(article, 'A published article is available for the valid-route control')

async function request(pathname, accept, method = 'GET', headers = {}) {
  const response = await fetch(origin + pathname, {
    method,
    headers: { Accept: accept, ...headers },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  })
  return { response, body: await response.text() }
}

let checked = 0
let buildId
for (const pathname of [
  '/b8-page-does-not-exist',
  '/zh/b8-page-does-not-exist',
  '/knowledge-base/b8-article-does-not-exist',
  '/zh/knowledge-base/b8-article-does-not-exist',
  '/knowledge-base/articles?page=999999',
  '/zh/knowledge-base/articles?page=999999',
  '/knowledge-base/topic/b8-topic-does-not-exist',
]) {
  // Both request orders are deliberate: a cached variant must not leak across Accept values.
  for (const accept of ['text/markdown', 'text/html', 'text/markdown', '*/*', 'text/markdown;q=0']) {
    const { response, body } = await request(pathname, accept)
    assert.equal(response.status, 404, `${pathname}: true 404 for ${accept}`)
    assert.equal(response.headers.get('location'), null)
    assert.match(response.headers.get('vary') ?? '', /(?:^|,\s*)Accept(?:,|$)/i)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    if (accept === 'text/markdown') {
      assert.match(response.headers.get('content-type') ?? '', /^text\/markdown; charset=utf-8$/)
      assert.match(body, /^# Page not found\n/)
      for (const link of [
        'https://www.nervos.org/llms.txt',
        'https://www.nervos.org/sitemap.xml',
        'https://www.nervos.org/knowledge-base',
        'https://docs.nervos.org/',
      ])
        assert.ok(body.includes(link))
      assert.doesNotMatch(body, /<!DOCTYPE|<html/i)
    } else {
      assert.match(response.headers.get('content-type') ?? '', /^text\/html/)
      assert.match(body, /This page could not be found/)
    }
    checked++
  }
  const { response, body } = await request(pathname, 'text/markdown', 'HEAD')
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type') ?? '', /^text\/markdown/)
  assert.equal(body, '')
  checked++
}

for (const pathname of ['/', '/knowledge-base', '/knowledge-base/articles', article.canonicalPath]) {
  const accept = pathname === '/' || pathname === '/knowledge-base' ? 'text/html' : 'text/markdown'
  const { response, body } = await request(pathname, accept)
  assert.equal(response.status, 200, `${pathname}: valid route stays valid`)
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/)
  assert.match(body, /<html/i)
  buildId ??= body.match(/"buildId":"([^"]+)"/)?.[1]
  checked++
}
assert.ok(buildId, 'A production Next build ID is available')
const { response: dataResponse, body: dataBody } = await request(
  `/_next/data/${buildId}/en/knowledge-base/b8-article-does-not-exist.json`,
  'text/markdown',
  'GET',
  { 'x-nextjs-data': '1' },
)
assert.equal(dataResponse.status, 404, 'Next client navigation keeps its notFound response')
assert.doesNotMatch(dataResponse.headers.get('content-type') ?? '', /^text\/markdown/)
assert.equal(JSON.parse(dataBody).notFound, true)
checked++
for (const pathname of ['/llms.txt', '/robots.txt', '/sitemap.xml', '/api/kb/release']) {
  const { response } = await request(pathname, 'text/markdown')
  assert.equal(response.status, 200, `${pathname}: existing resource unchanged`)
  assert.doesNotMatch(response.headers.get('content-type') ?? '', /^text\/markdown/)
  checked++
}
for (const pathname of ['/api/b8-api-does-not-exist', '/_next/b8-asset-does-not-exist']) {
  const { response } = await request(pathname, 'text/markdown')
  assert.equal(response.status, 404)
  assert.doesNotMatch(response.headers.get('content-type') ?? '', /^text\/markdown/)
  checked++
}
const { response: redirect } = await request('/knowledge-base?page=2', 'text/markdown')
assert.equal(redirect.status, 308, 'Existing listing migration takes precedence over 404 negotiation')
assert.equal(new URL(redirect.headers.get('location'), origin).pathname, '/knowledge-base/articles')
checked++
console.log(
  `${checked} production HTTP checks passed: Markdown/HTML 404 negotiation, HEAD, cache separation and unchanged valid routes.`,
)
