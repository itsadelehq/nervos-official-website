import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

// Run against a production build, not next dev:
// node scripts/check-markdown-articles-http.mjs [origin]
const repository = fileURLToPath(new URL('../', import.meta.url))
const contentRoot = path.join(repository, 'public/education_hub_articles')
const canonicalOrigin = 'https://www.nervos.org'
const parser = remark().use(remarkGfm)
const normalize = value => value.replace(/\s+/gu, ' ').trim()
const published = article => !article.draft && (!article.date || Date.parse(article.date) <= Date.now())
const canonicalURL = article => new URL(article.canonicalPath, canonicalOrigin).href
const absoluteReference = value => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function visibleText(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  return (node.children ?? []).map(visibleText).join('')
}

function nodes(tree, type) {
  const matches = []
  walk(tree, node => {
    if (node.type === type) matches.push(node)
  })
  return matches
}

export function articleBodyProbes(source) {
  const paragraphs = nodes(parser.parse(source), 'paragraph')
    .map(visibleText)
    .map(normalize)
    .filter(value => value.length >= 40)
  assert.ok(paragraphs.length, 'An article has substantive source text for independent body checks')
  return [...new Set([paragraphs[0], paragraphs[Math.floor(paragraphs.length / 2)], paragraphs.at(-1)])]
}

// Expected prose comes from the original content, not the renderer under test.
// Parsing permits harmless Markdown formatting changes while detecting a
// summary, a truncated article, or an English fallback on a translation URL.
export function assertArticleMarkdown(body, article, source) {
  const label = `${article.language}:${article.id}`
  const tree = parser.parse(body)
  const first = tree.children[0]
  assert.equal(first?.type, 'heading', `${label}: starts with an article heading`)
  assert.equal(first.depth, 1, `${label}: top-level title`)
  assert.equal(visibleText(first), article.title, `${label}: translated title`)
  assert.ok(
    body.includes(`\nSource: ${canonicalURL(article)}\nLanguage: ${article.language}\n`),
    `${label}: canonical identity`,
  )
  assert.doesNotMatch(body, /^\uFEFF?---\r?\n(?:title|description|coverImage):/, `${label}: YAML is not published`)
  const prose = normalize(nodes(tree, 'paragraph').map(visibleText).join(' '))
  for (const probe of articleBodyProbes(source))
    assert.ok(prose.includes(probe), `${label}: complete source prose: ${probe.slice(0, 70)}`)
  const sourceTree = parser.parse(source)
  assert.deepEqual(
    nodes(tree, 'code').map(node => ({ lang: node.lang, meta: node.meta, value: node.value })),
    nodes(sourceTree, 'code').map(node => ({ lang: node.lang, meta: node.meta, value: node.value })),
    `${label}: complete code blocks remain intact`,
  )
  walk(tree, node => {
    if (['image', 'link', 'definition'].includes(node.type)) {
      assert.ok(absoluteReference(node.url), `${label}: unresolved resource URL ${node.url}`)
    }
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/gi)) {
        assert.ok(absoluteReference(match[1]), `${label}: unresolved HTML resource ${match[1]}`)
      }
    }
  })
  // Check a real relative image independently of the link normalizer. Images
  // live under the article source directory, including translated pages.
  const relativeImage = nodes(sourceTree, 'image').find(node => /^(?:\.\/)?images\//.test(node.url))
  if (relativeImage) {
    const expected = new URL(relativeImage.url, `${canonicalOrigin}/education_hub_articles/${article.id}/`).href
    assert.ok(
      nodes(tree, 'image').some(node => node.url === expected),
      `${label}: image resolves against its article directory`,
    )
  }
  return tree
}

export function assertFullCollection(body, english, readSource) {
  assert.match(body, /^# Nervos Knowledge Base/)
  assert.ok(
    body.includes(`- Article count: ${english.length}\n`),
    'The collection reports its actual published English count',
  )
  const identities = [...body.matchAll(/^# [^\n]+\n\nSource: ([^\n]+)\nLanguage: ([^\n]+)\n/gm)]
  assert.equal(identities.length, english.length, 'Exactly one complete section exists per published English article')
  assert.deepEqual(
    identities.map(match => match[1]).sort(),
    english.map(canonicalURL).sort(),
    'No missing article, draft, translation, duplicate, or noncanonical article URL',
  )
  for (let index = 0; index < identities.length; index++) {
    const match = identities[index]
    assert.equal(match[2], 'en', `${match[1]}: collection language`)
    const article = english.find(item => canonicalURL(item) === match[1])
    const section = body.slice(match.index, identities[index + 1]?.index ?? body.length)
    assertArticleMarkdown(section, article, readSource(article))
  }
}

export async function runArticleHTTPChecks(origin = 'http://localhost:3018') {
  origin = new URL(origin).origin
  const catalog = JSON.parse(fs.readFileSync(path.join(contentRoot, 'metadata/catalog.json'), 'utf8'))
  const articles = catalog.articles.filter(published)
  const english = articles.filter(article => article.language === 'en')
  const readSource = article => matter(fs.readFileSync(path.join(contentRoot, article.sourceFile), 'utf8')).content
  assert.ok(english.length >= 3, 'At least three published English articles exist for independent cache orders')
  const translations = ['en', 'zh', 'es'].map(language => {
    const article =
      articles.find(
        article => article.language === language && article.id === 'account_abstraction_where_we_are_going',
      ) ?? articles.find(article => article.language === language)
    assert.ok(article, `A real ${language} article is available`)
    return article
  })
  let checked = 0
  let buildId
  async function request(pathname, accept = 'text/markdown', method = 'GET', headers = {}) {
    const response = await fetch(origin + pathname, {
      method,
      headers: { Accept: accept, 'Accept-Encoding': 'identity', ...headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(45000),
    })
    const bytes = await response.arrayBuffer()
    return { response, body: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  }
  function variesOnAccept(response, label) {
    assert.match(response.headers.get('vary') ?? '', /(?:^|,\s*)Accept(?:,|$)/i, `${label}: Vary includes Accept`)
  }
  function markdownHeaders(response, article, label) {
    assert.equal(response.status, 200, `${label}: successful published article`)
    assert.equal(response.headers.get('location'), null, `${label}: canonical page does not redirect`)
    assert.match(response.headers.get('content-type') ?? '', /^text\/markdown; charset=utf-8$/i, label)
    assert.equal(response.headers.get('content-language'), article.language, `${label}: language header`)
    assert.equal(
      response.headers.get('link'),
      `<${canonicalURL(article)}>; rel="canonical"`,
      `${label}: canonical header`,
    )
    variesOnAccept(response, label)
    for (const header of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) {
      const value = response.headers.get(header)
      // Vercel consumes its private CDN header before sending the response.
      if (header === 'cache-control' || value !== null) assert.match(value ?? '', /no-store/i, `${label}: ${header}`)
    }
  }
  async function markdown(article, pathname = article.canonicalPath, expected, method = 'GET', headers = {}) {
    const { response, body } = await request(pathname, 'text/markdown', method, headers)
    const label = `${method} ${pathname}`
    markdownHeaders(response, article, label)
    if (method === 'HEAD') {
      assert.equal(body, '', `${label}: no HEAD body`)
      assert.equal(
        Number(response.headers.get('content-length')),
        Buffer.byteLength(expected),
        `${label}: full UTF-8 body length`,
      )
    } else {
      assertArticleMarkdown(body, article, readSource(article))
      if (expected !== undefined) assert.equal(body, expected, `${label}: representation is stable`)
    }
    checked++
    return { response, body }
  }
  async function html(article, accept = 'text/html', method = 'GET', headers = {}) {
    const { response, body } = await request(article.canonicalPath, accept, method, headers)
    const label = `${method} ${article.canonicalPath} (${accept})`
    assert.equal(response.status, 200, label)
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/, label)
    variesOnAccept(response, label)
    if (method === 'HEAD') assert.equal(body, '', label)
    else {
      assert.match(body, /<html/i, label)
      buildId ??= body.match(/"buildId":"([^"]+)"/)?.[1]
    }
    checked++
    return response.headers.get('etag')
  }

  // Distinct canonical URLs make MD-first and HTML-first genuine independent
  // order checks. Query cache-busters alone cannot test CDN route variation.
  for (const [article, first] of [
    [english[0], 'markdown'],
    [english[2], 'html'],
  ]) {
    let expected
    let htmlEtag
    for (const representation of [
      first,
      first === 'html' ? 'markdown' : 'html',
      first,
      first === 'html' ? 'markdown' : 'html',
    ]) {
      if (representation === 'html') htmlEtag = await html(article)
      else expected = (await markdown(article, undefined, expected)).body
    }
    await markdown(article, undefined, expected, 'HEAD')
    await html(article, 'text/html', 'HEAD')
    if (htmlEtag) await markdown(article, undefined, expected, 'GET', { 'If-None-Match': htmlEtag })
    console.log(`${article.canonicalPath}: ${first}-first cache alternation passed`)
  }

  for (const article of translations) {
    const { response, body } = await markdown(article)
    await markdown(article, undefined, body, 'HEAD')
    for (const accept of [
      '*/*',
      'text/markdown;q=0',
      'text/markdown,text/html',
      'text/markdown;q=0.5,text/html;q=0.5',
    ]) {
      await html(article, accept)
    }
    const preferred = await request(article.canonicalPath, 'text/html;q=0.2,text/markdown;q=0.9')
    markdownHeaders(preferred.response, article, article.canonicalPath)
    assert.equal(preferred.body, body, 'Explicitly preferred Markdown wins negotiation')
    checked++
    if (response.headers.get('etag')) {
      await markdown(article, undefined, body, 'GET', { 'If-None-Match': response.headers.get('etag') })
      await html(article, 'text/html', 'GET', { 'If-None-Match': response.headers.get('etag') })
    }
    const other = english.find(item => item.id !== article.id)
    const collision = new URLSearchParams({
      slug: other.id,
      id: other.id,
      language: article.language === 'en' ? 'zh' : 'en',
      locale: 'es',
      sourceFile: `${other.id}/index.md`,
      canonicalPath: other.canonicalPath,
      article: other.id,
      view: 'wrong',
      utm_source: 'b9-article',
      private: 'do-not-echo',
    })
    await markdown(article, `${article.canonicalPath}?${collision}`, body)
    if (article.language === 'en') await markdown(article, `/en${article.canonicalPath}`, body)
    console.log(`${article.language}: full source prose, resources, negotiation, HEAD and query identity passed`)
  }

  assert.ok(buildId, 'HTML retains the production Next build ID')
  for (const article of translations) {
    const pathname = `/_next/data/${buildId}/${article.language}/knowledge-base/${encodeURIComponent(article.id)}.json`
    for (const headers of [{}, { 'x-nextjs-data': '1' }]) {
      const other = english.find(item => item.id !== article.id)
      for (const suffix of [
        '',
        `?slug=${encodeURIComponent(other.id)}&language=wrong&id=${encodeURIComponent(other.id)}`,
      ]) {
        const { response, body } = await request(pathname + suffix, 'text/markdown', 'GET', headers)
        assert.equal(response.status, 200, `${pathname}: existing Next data stays available`)
        assert.match(response.headers.get('content-type') ?? '', /application\/json/, `${pathname}: JSON protocol`)
        const data = JSON.parse(body)
        assert.equal(data.pageProps.article.id, article.id, `${pathname}: path selects the article`)
        assert.equal(data.pageProps.article.language, article.language, `${pathname}: path selects the language`)
        assert.equal(data.pageProps.markdown, readSource(article), `${pathname}: original complete JSON body`)
        checked++
      }
    }
  }

  const missingTranslation = english.find(
    article => !articles.some(item => item.id === article.id && ['es', 'fr'].includes(item.language)),
  )
  assert.ok(missingTranslation, 'A genuinely absent translation is available for the redirect control')
  for (const locale of ['es', 'fr']) {
    assert.ok(!articles.some(item => item.id === missingTranslation.id && item.language === locale))
    for (const method of ['GET', 'HEAD']) {
      for (const suffix of ['', `?language=en&slug=${encodeURIComponent(english[2].id)}`]) {
        const { response } = await request(
          `/${locale}${missingTranslation.canonicalPath}${suffix}`,
          'text/markdown',
          method,
        )
        assert.equal(response.status, 308, `${locale}: missing translations retain the permanent English redirect`)
        assert.equal(new URL(response.headers.get('location'), origin).pathname, missingTranslation.canonicalPath)
        checked++
      }
    }
  }
  const migrations = JSON.parse(fs.readFileSync(path.join(contentRoot, 'metadata/slug-migrations.json'), 'utf8'))
  const publishedRenames = migrations.renames.filter(item => english.some(article => article.id === item.to))
  const renames = [
    ...new Set([
      publishedRenames[0],
      publishedRenames.find(item => item.from !== item.to && item.from.toLowerCase() === item.to),
    ]),
  ].filter(Boolean)
  assert.equal(renames.length, 2, 'Both structural and case-only slug migrations have real published targets')
  for (const rename of renames) {
    for (const method of ['GET', 'HEAD']) {
      const { response } = await request(`/knowledge-base/${encodeURIComponent(rename.from)}`, 'text/markdown', method)
      assert.equal(response.status, 308, 'Explicit slug migrations run before representation negotiation')
      assert.equal(new URL(response.headers.get('location'), origin).pathname, `/knowledge-base/${rename.to}`)
      checked++
    }
  }
  for (const pathname of [
    '/knowledge-base/b9-article-does-not-exist',
    ...catalog.articles.filter(article => !published(article)).map(article => article.canonicalPath),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const { response, body } = await request(pathname, 'text/markdown', method)
      assert.equal(response.status, 404, `${pathname}: unknown or unpublished article is unavailable`)
      assert.match(response.headers.get('content-type') ?? '', /^text\/markdown; charset=utf-8$/)
      if (method === 'HEAD') assert.equal(body, '')
      else assert.match(body, /^# Page not found\n/)
      variesOnAccept(response, pathname)
      assert.match(response.headers.get('cache-control') ?? '', /no-store/)
      checked++
    }
  }

  const { response: collection, body: full } = await request('/llms-full.txt')
  assert.equal(collection.status, 200)
  assert.match(collection.headers.get('content-type') ?? '', /^text\/plain;\s*charset=utf-8$/i)
  assertFullCollection(full, english, readSource)
  assert.equal(
    full,
    fs.readFileSync(path.join(repository, 'public/llms-full.txt'), 'utf8'),
    'The published full-text file matches this build artifact',
  )
  checked++
  const { response: collectionHead, body: collectionEmpty } = await request('/llms-full.txt', 'text/markdown', 'HEAD')
  assert.equal(collectionHead.status, 200)
  assert.equal(collectionEmpty, '')
  assert.match(collectionHead.headers.get('content-type') ?? '', /^text\/plain/)
  assert.equal(Number(collectionHead.headers.get('content-length')), Buffer.byteLength(full))
  checked++
  for (const pathname of ['/llms.txt', '/robots.txt', '/sitemap.xml', '/api/kb/release', '/favicon.svg']) {
    const { response, body } = await request(pathname)
    assert.equal(response.status, 200, `${pathname}: existing resource remains available`)
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /^text\/markdown/)
    if (pathname === '/api/kb/release') assert.ok(JSON.parse(body))
    if (pathname === '/favicon.svg')
      assert.equal(body, fs.readFileSync(path.join(repository, 'public/favicon.svg'), 'utf8'))
    checked++
  }
  console.log(
    `${checked} article/full-text HTTP checks passed: EN/ZH/ES full bodies, canonical references, negotiation, cold/warm HTML separation, HEAD, ETags, Next JSON, publication and migration priority; ${english.length} complete English articles in llms-full.txt.`,
  )
  return checked
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runArticleHTTPChecks(process.argv[2]).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
