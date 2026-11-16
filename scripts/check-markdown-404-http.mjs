import assert from 'node:assert/strict'
import fs from 'node:fs'

// Run against next start, not next dev: node scripts/check-markdown-404-http.mjs [origin]
const origin = process.argv[2] ?? 'http://localhost:3010'
const catalog = JSON.parse(fs.readFileSync('public/education_hub_articles/metadata/catalog.json', 'utf8'))
const article = catalog.articles.find(
  item => item.language === 'en' && !item.draft && (!item.date || Date.parse(item.date) <= Date.now()),
)
assert.ok(article, 'A published article is available for the valid-route control')
const approvedMarkdown = `# Page not found

The page you requested does not exist on nervos.org. It may have moved or been removed.

- Site guide for AI tools: https://www.nervos.org/llms.txt
- All pages: https://www.nervos.org/sitemap.xml
- Knowledge Base: https://www.nervos.org/knowledge-base
- Developer documentation: https://docs.nervos.org/
`
const runId = `${Date.now().toString(36)}-${process.pid}`

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
async function checkNotFound(pathname, accept, method = 'GET') {
  const { response, body } = await request(pathname, accept, method)
  const label = `${method} ${pathname} (${accept}; cache=${response.headers.get('x-vercel-cache') ?? 'none'}, age=${response.headers.get('age') ?? 'none'})`
  assert.equal(response.status, 404, `${label}: true 404`)
  assert.equal(response.headers.get('location'), null, `${label}: no redirect`)
  assert.match(response.headers.get('vary') ?? '', /(?:^|,\s*)Accept(?:,|$)/i, `${label}: Vary includes Accept`)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/, `${label}: never cache either representation`)
  if (accept === 'text/markdown') {
    assert.match(
      response.headers.get('content-type') ?? '',
      /^text\/markdown; charset=utf-8$/,
      `${label}: Markdown type`,
    )
    // Vercel consumes Vercel-CDN-Cache-Control. CDN-Cache-Control may still be
    // exposed; when present it must not permit a cached HTML 404 to win.
    const cdnCacheControl = response.headers.get('cdn-cache-control')
    if (cdnCacheControl !== null) assert.match(cdnCacheControl, /no-store/, `${label}: CDN bypass`)
    assert.equal(
      Number(response.headers.get('content-length')),
      Buffer.byteLength(approvedMarkdown),
      `${label}: approved UTF-8 body length`,
    )
    assert.equal(body, method === 'HEAD' ? '' : approvedMarkdown, `${label}: approved Markdown body`)
  } else {
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/, `${label}: HTML type`)
    if (method === 'HEAD') assert.equal(body, '', `${label}: bodyless HEAD`)
    else assert.match(body, /This page could not be found/, `${label}: ordinary HTML error`)
  }
  checked++
}

for (const pathname of [
  '/b8-page-does-not-exist',
  '/zh/b8-page-does-not-exist',
  '/knowledge-base/b8-article-does-not-exist',
  '/zh/knowledge-base/b8-article-does-not-exist',
  '/knowledge-base/articles?page=999999',
  '/zh/knowledge-base/articles?page=999999',
  '/knowledge-base/topic/b8-topic-does-not-exist',
]) {
  // Retain the original seven route/error cases as warm-cache regressions.
  for (const accept of ['text/markdown', 'text/html', 'text/markdown', '*/*', 'text/markdown;q=0']) {
    await checkNotFound(pathname, accept)
  }
  await checkNotFound(pathname, 'text/markdown', 'HEAD')
}

// Fresh pathnames, rather than cache-busting query values, exercise Vercel's
// route-level negative cache. Each scenario gets a distinct first request.
const coldRoutes = [
  suffix => `/b8-cold-root-${suffix}`,
  suffix => `/b8-cold-deep-${suffix}/nested/page`,
  suffix => `/knowledge-base/b8-cold-article-${suffix}`,
  suffix => `/zh/knowledge-base/b8-cold-article-${suffix}`,
]
for (const [index, route] of coldRoutes.entries()) {
  for (const first of ['text/markdown', 'text/html']) {
    const other = first === 'text/markdown' ? 'text/html' : 'text/markdown'
    const pathname = route(`${runId}-${index}-${first === 'text/markdown' ? 'md-first' : 'html-first'}`)
    for (const accept of [first, other, first, other, first]) await checkNotFound(pathname, accept)
    await checkNotFound(pathname, 'text/markdown', 'HEAD')
    await checkNotFound(pathname, 'text/html', 'HEAD')
    await checkNotFound(pathname, 'text/markdown')
  }
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
for (const page of [
  `en/b8-data-root-${runId}`,
  `en/b8-data-deep-${runId}/nested/page`,
  `en/knowledge-base/b8-data-article-${runId}`,
  `zh/knowledge-base/b8-data-article-${runId}`,
]) {
  for (const headers of [{ 'x-nextjs-data': '1' }, {}]) {
    const pathname = `/_next/data/${buildId}/${page}.json`
    const { response, body } = await request(pathname, 'text/markdown', 'GET', headers)
    const label = `${pathname}: Next data ${headers['x-nextjs-data'] ? 'with' : 'without'} explicit data header`
    assert.equal(response.status, 404, `${label} keeps its notFound status`)
    // Next's native notFound data response can omit Content-Type. Preserve
    // that JSON protocol rather than imposing a new header on its 404 path.
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /^text\/markdown/, label)
    assert.equal(JSON.parse(body).notFound, true, label)
    checked++
  }
}
for (const pathname of ['/llms.txt', '/robots.txt', '/sitemap.xml', '/api/kb/release']) {
  const { response, body } = await request(pathname, 'text/markdown')
  assert.equal(response.status, 200, `${pathname}: existing resource unchanged`)
  assert.doesNotMatch(response.headers.get('content-type') ?? '', /^text\/markdown/)
  if (pathname === '/api/kb/release') {
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.ok(JSON.parse(body))
  }
  checked++
}
const { response: icon, body: iconBody } = await request('/favicon.svg', 'text/markdown')
assert.equal(icon.status, 200, 'An existing public SVG keeps its routing priority')
assert.match(icon.headers.get('content-type') ?? '', /^image\/svg\+xml/)
assert.equal(iconBody, fs.readFileSync('public/favicon.svg', 'utf8'), 'The original public file is returned unchanged')
checked++
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
  `${checked} production HTTP checks passed: approved Markdown/HTML 404s, cold MD-first/HTML-first routes (${runId}), warm HEAD, cache separation, Next data and unchanged valid resources.`,
)
