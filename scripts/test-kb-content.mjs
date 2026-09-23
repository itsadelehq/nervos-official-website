import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'
import matter from 'gray-matter'
import { remark } from 'remark'

const js = ts.transpileModule(fs.readFileSync('src/components/KnowledgeHub/content.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const content = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const { articlePath, searchArticles, relatedArticles, featuredArticles } = content
const root = 'public/education_hub_articles'
const catalog = JSON.parse(fs.readFileSync(`${root}/metadata/catalog.json`, 'utf8'))
const identities = new Set()
const routes = new Set()
const sourceFiles = new Set()
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || !fs.existsSync(path.join(root, entry.name, 'index.md'))) continue
  for (const file of fs.readdirSync(path.join(root, entry.name))) {
    if (/^index(?:[_-][a-z]{2})?\.md$/.test(file)) sourceFiles.add(`${entry.name}/${file}`)
  }
}
assert.deepEqual(
  new Set(catalog.articles.map(a => a.sourceFile)),
  sourceFiles,
  'Catalog must inventory every source rendition; regenerate after pulling new articles',
)
for (const a of catalog.articles) {
  const identity = `${a.id}:${a.language}`
  assert(!identities.has(identity), `Duplicate identity ${identity}`)
  identities.add(identity)
  assert(!routes.has(a.canonicalPath), `Duplicate path ${a.canonicalPath}`)
  routes.add(a.canonicalPath)
  const raw = fs.readFileSync(path.join(root, a.sourceFile))
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), a.sourceSHA256)
  assert.equal(crypto.createHash('sha256').update(matter(raw).content).digest('hex'), a.bodySHA256)
  const localePrefix = a.language === 'en' ? '' : `/${a.language}`
  const originalSlug = a.sourceFile.split('/')[0]
  assert.equal(a.id, originalSlug, `Source directory identity changed for ${a.sourceFile}`)
  assert.equal(a.canonicalPath, `${localePrefix}/knowledge-base/${originalSlug}`)
  const href = articlePath(a)
  assert.equal(href, `/knowledge-base/${originalSlug}`, `Article link changed the original slug: ${a.canonicalPath}`)
  // Next Link adds the current locale; catalog loaders only supply that locale.
  assert.equal(`${localePrefix}${href}`, a.canonicalPath, `Localized link changed: ${a.canonicalPath}`)
  assert(!href.includes('/kb/read/'), `Preview link leaked into article navigation: ${href}`)
  assert.equal(
    articlePath({ ...a, hub: 'another-hub', subjects: ['another-subject'] }),
    href,
    `Reclassification must not change the article address: ${a.canonicalPath}`,
  )
  if (a.coverImage) assert(fs.existsSync(path.join('public', a.coverImage)))
  assert(a.subjects.every(id => catalog.subjects.some(s => s.id === id && s.hub === a.hub)))
}
for (const language of ['en', 'zh', 'es']) {
  const local = {
    ...catalog,
    articles: catalog.articles.filter(a => a.language === language && !a.draft),
    featured: catalog.featured.filter(f => f.language === language),
  }
  for (const a of local.articles) {
    const related = relatedArticles(a, local)
    assert(related.length <= 3)
    assert.equal(new Set(related.map(r => r.id)).size, related.length)
    assert(related.every(r => r.id !== a.id && r.language === language))
  }
  for (const hub of catalog.hubs) assert(featuredArticles(local, hub.id).every(a => a.language === language))
}
const base = { ...catalog.articles[0], id: 'test', subjects: [], internalTags: [], hub: null }
for (const language of ['en', 'zh', 'es']) {
  const originalPath = '/knowledge-base/Original_CKB-article_v2'
  const canonicalPath = `${language === 'en' ? '' : `/${language}`}${originalPath}`
  assert.equal(
    articlePath({ ...base, id: 'not-a-route-source', language, canonicalPath }),
    originalPath,
    'Links must use the preserved canonical path, not normalize case/underscores or regenerate from metadata',
  )
}
for (const filename of fs.readdirSync('src/components/KnowledgeHub')) {
  if (!/\.tsx?$/.test(filename)) continue
  const component = fs.readFileSync(path.join('src/components/KnowledgeHub', filename), 'utf8')
  assert(!component.includes('/kb/read/'), `${filename} must not direct readers to preview article URLs`)
  assert(!component.includes('previewHref'), `${filename} must use preserved article paths`)
}
const search = {
  ...catalog,
  articles: [
    { ...base, id: 'title', title: 'RISC-V RGB++ secp256k1 x402', subtitle: '', text: '' },
    { ...base, id: 'body', title: 'Other', subtitle: '', text: 'RISC-V RGB++ secp256k1 x402 中文密码学' },
  ],
}
for (const query of ['RISC-V', 'RGB++', 'secp256k1', 'x402']) assert.equal(searchArticles(query, search)[0].id, 'title')
assert.equal(searchArticles('中文密码', search)[0].id, 'body')
assert.equal(searchArticles('notpresent', search).length, 0)
assert.equal(searchArticles('', search).length, 0)
assert.equal(relatedArticles(base, { ...catalog, articles: [base] }).length, 0)

// Exercise the real page loaders without requiring Next's runtime or loading
// translations. Source/hash validation and Markdown parsing are not mocked.
const require = createRequire(import.meta.url)
function loadServerModule(filename, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText
  const loadedModule = { exports: {} }
  const moduleRequire = id => (Object.hasOwn(dependencies, id) ? dependencies[id] : require(id))
  new Function('require', 'module', 'exports', compiled)(moduleRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
const source = loadServerModule('src/server/kb-content.ts')
const headings = loadServerModule('src/components/KnowledgeHub/markdown-headings.ts')
const translationRequests = []
const { articleStaticPaths, articleStaticProps } = loadServerModule('src/server/kb-article-page.ts', {
  '../components/KnowledgeHub/content': content,
  '../components/KnowledgeHub/markdown-headings': headings,
  './kb-content': source,
  remark: { remark },
  'next-i18next/serverSideTranslations': {
    serverSideTranslations: async language => {
      translationRequests.push(language)
      return {}
    },
  },
})
const { locales } = require('../next-i18next.config.js').i18n

const englishArticles = source.getKBCatalog('en').articles
const canonicalPaths = await articleStaticPaths('canonical')({ locales })
assert.equal(canonicalPaths.fallback, false)
assert.equal(canonicalPaths.paths.length, englishArticles.length * locales.length)
assert.deepEqual(
  new Set(canonicalPaths.paths.map(({ locale, params }) => `${locale}:${params.slug}`)),
  new Set(locales.flatMap(locale => englishArticles.map(article => `${locale}:${article.id}`))),
  'Existing public routes must retain every English article in every configured locale',
)
const previewPaths = await articleStaticPaths('preview')({ locales })
assert.equal(previewPaths.fallback, false)
assert.deepEqual(
  new Set(previewPaths.paths.map(({ locale, params }) => `${locale}:${params.slug}`)),
  new Set(locales.flatMap(locale => source.getKBCatalog(locale).articles.map(article => `${locale}:${article.id}`))),
  'Preview routes must include only actual translations',
)
const originalEnglish = englishArticles.find(article => /[A-Z]/.test(article.id) && article.id.includes('_'))
assert(originalEnglish, 'Expected an existing mixed-case, underscore article to exercise legacy paths')
const frenchContext = { params: { slug: originalEnglish.id }, locale: 'fr' }
const frenchPage = await articleStaticProps('canonical')(frenchContext)
assert('props' in frenchPage && !('redirect' in frenchPage), 'Old untranslated paths must serve directly')
assert.equal(frenchPage.props.article.language, 'en')
assert.equal(frenchPage.props.article.canonicalPath, originalEnglish.canonicalPath)
assert.equal(frenchPage.props.markdown, source.getKBArticle(originalEnglish.id, 'en'))
assert.equal(frenchPage.props.preview, false)
assert.equal(translationRequests.at(-1), 'fr', 'Page chrome must retain the requested locale')
assert.deepEqual(await articleStaticProps('preview')(frenchContext), { notFound: true })
const originalChinese = source.getKBCatalog('zh').articles.find(article => article.id === originalEnglish.id)
assert(originalChinese, 'Expected a real Chinese translation for the route fixture')
const chineseContext = { params: { slug: originalChinese.id }, locale: 'zh' }
const chinesePage = await articleStaticProps('canonical')(chineseContext)
assert('props' in chinesePage && !('redirect' in chinesePage))
assert.equal(chinesePage.props.article.language, 'zh')
assert.equal(chinesePage.props.article.canonicalPath, originalChinese.canonicalPath)
assert.equal(chinesePage.props.markdown, source.getKBArticle(originalChinese.id, 'zh'))
assert.equal(chinesePage.props.preview, false)
assert.equal((await articleStaticProps('preview')(chineseContext)).props.preview, true)
for (const route of ['canonical', 'preview']) {
  assert.deepEqual(await articleStaticProps(route)({ params: { slug: 'not-an-existing-article' }, locale: 'en' }), {
    notFound: true,
  })
  assert.deepEqual(await articleStaticProps(route)({ params: {}, locale: 'en' }), { notFound: true })
}
console.log(
  `Verified ${identities.size} source hashes, body hashes, unchanged canonical routes and article links, images and taxonomy; ${canonicalPaths.paths.length} public route entries, translation fallback, strict previews, recommendation/language/search tests passed.`,
)
