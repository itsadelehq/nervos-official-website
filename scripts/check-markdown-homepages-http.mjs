import assert from 'node:assert/strict'
import fs from 'node:fs'

// Run against next start: node scripts/check-markdown-homepages-http.mjs [origin]
const origin = process.argv[2] ?? 'http://localhost:3011'
const catalog = JSON.parse(fs.readFileSync('public/education_hub_articles/metadata/catalog.json', 'utf8'))
const article = catalog.articles.find(
  item => item.language === 'en' && !item.draft && (!item.date || Date.parse(item.date) <= Date.now()),
)
assert.ok(article)
let checked = 0
let buildId
async function request(pathname, accept, method = 'GET', headers = {}) {
  const response = await fetch(origin + pathname, {
    headers: { Accept: accept, ...headers },
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  })
  return { response, body: await response.text() }
}
function variesOnAccept(response) {
  assert.match(response.headers.get('vary') ?? '', /(?:^|,\s*)Accept(?:,|$)/i)
}

for (const pathname of ['/', '/knowledge-base', '/en', '/en/knowledge-base']) {
  let markdown
  let htmlEtag
  for (const accept of [
    'text/html',
    'text/markdown',
    'text/html',
    'text/markdown',
    '*/*',
    'text/markdown;q=0',
    'text/markdown,text/html',
    'text/html;q=0.2,text/markdown;q=0.9',
  ]) {
    const { response, body } = await request(pathname, accept)
    assert.equal(response.status, 200, `${pathname}: ${accept}`)
    assert.equal(response.headers.get('location'), null)
    variesOnAccept(response)
    const wantsMarkdown = accept === 'text/markdown' || accept.endsWith('text/markdown;q=0.9')
    if (wantsMarkdown) {
      assert.match(response.headers.get('content-type') ?? '', /^text\/markdown; charset=utf-8$/)
      assert.match(response.headers.get('cache-control') ?? '', /no-store/)
      assert.match(body, /^# /)
      assert.doesNotMatch(body, /<!DOCTYPE|<html|<script/i)
      assert.ok(body.includes(pathname.includes('knowledge-base') ? '# Knowledge Base' : '# Common Knowledge Base'))
      if (markdown !== undefined)
        assert.equal(body, markdown, 'Representation remains stable across HTML/Markdown alternation')
      markdown = body
    } else {
      assert.match(response.headers.get('content-type') ?? '', /^text\/html/)
      assert.match(body, /<html/i)
      htmlEtag = response.headers.get('etag')
      buildId ??= body.match(/"buildId":"([^"]+)"/)?.[1]
    }
    checked++
  }
  const { response: head, body: empty } = await request(pathname, 'text/markdown', 'HEAD')
  assert.equal(head.status, 200)
  assert.equal(empty, '')
  assert.match(head.headers.get('content-type') ?? '', /^text\/markdown/)
  assert.equal(Number(head.headers.get('content-length')), Buffer.byteLength(markdown))
  variesOnAccept(head)
  checked++
  const { response: tracked, body: trackedBody } = await request(
    pathname + '?utm_source=b9&private=do-not-echo&homepage=wrong&view=knowledge-base',
    'text/markdown',
  )
  assert.equal(tracked.status, 200)
  assert.equal(trackedBody, markdown)
  assert.ok(!trackedBody.includes('do-not-echo'))
  checked++
  if (htmlEtag) {
    const { response, body } = await request(pathname, 'text/markdown', 'GET', { 'If-None-Match': htmlEtag })
    assert.equal(response.status, 200, 'An HTML ETag must not produce a Markdown 304')
    assert.equal(body, markdown)
    checked++
  }
}

assert.ok(buildId)
for (const route of ['/', '/knowledge-base']) {
  // Next's PageLoader adds the locale before deriving the data asset path:
  // the default-locale root uses /en.json, not /en/index.json.
  const filename = route === '/' ? 'en' : 'en/knowledge-base'
  const { response, body } = await request(`/_next/data/${buildId}/${filename}.json`, 'text/markdown', 'GET', {
    'x-nextjs-data': '1',
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  assert.ok(JSON.parse(body).pageProps)
  checked++
}
for (const pathname of ['/zh', '/zh/knowledge-base', '/es', '/es/knowledge-base', '/knowledge-base/articles']) {
  const { response, body } = await request(pathname, 'text/markdown')
  assert.equal(response.status, 200, pathname)
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/)
  assert.match(body, /<html/i)
  checked++
}
// Article Markdown has its own protocol suite. Keep this suite's published
// article control as an ordinary browser visit rather than expecting HTML
// when that same URL explicitly requests its Markdown representation.
const { response: articlePage, body: articleHtml } = await request(article.canonicalPath, 'text/html')
assert.equal(articlePage.status, 200, article.canonicalPath)
assert.match(articlePage.headers.get('content-type') ?? '', /^text\/html/)
assert.match(articleHtml, /<html/i)
checked++
for (const [path, target] of [
  ['/knowledge-base?page=2&utm_source=b9', '/knowledge-base/articles?utm_source=b9'],
  ['/knowledge-base?sort_by=popular&utm_source=b9', '/knowledge-base?utm_source=b9'],
]) {
  const { response } = await request(path, 'text/markdown')
  assert.equal(response.status, 308)
  assert.equal(new URL(response.headers.get('location'), origin).href, origin + target)
  checked++
}
const { response: missing, body: errorBody } = await request('/this-page-does-not-exist', 'text/markdown')
assert.equal(missing.status, 404)
assert.match(missing.headers.get('content-type') ?? '', /^text\/markdown/)
assert.match(errorBody, /^# Page not found\n/)
checked++
console.log(
  `${checked} production HTTP checks passed: homepage Markdown/HTML, Vary, cache separation, HEAD, locales, data and redirects.`,
)
