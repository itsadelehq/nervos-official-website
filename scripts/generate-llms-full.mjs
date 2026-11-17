import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import matter from 'gray-matter'
import { renderKBArticleMarkdown } from '../config/kb-article-markdown.mjs'
import { loadSitemapEntries } from './generate-sitemap.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const origin = 'https://www.nervos.org'
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

export function generateLLMSFull({ repository = repositoryRoot, now = Date.now() } = {}) {
  const contentRoot = path.join(repository, 'public/education_hub_articles')
  const catalogPath = path.join(contentRoot, 'metadata/catalog.json')
  const catalogBytes = fs.readFileSync(catalogPath)
  const catalog = JSON.parse(catalogBytes.toString('utf8'))

  // Reuse the complete sitemap source inventory/hash/identity/canonical checks,
  // including excluded drafts and translations, before publishing any output.
  const indexed = new Set(loadSitemapEntries(repository, now).map(entry => entry.loc))
  assert(
    fs.readFileSync(catalogPath).equals(catalogBytes),
    'KB catalog changed while generating llms-full.txt; rebuild from a stable content snapshot',
  )
  const articles = catalog.articles
    .filter(
      article => article.language === 'en' && !article.draft && (!article.date || Date.parse(article.date) <= now),
    )
    .sort((a, b) => (a.canonicalPath < b.canonicalPath ? -1 : a.canonicalPath > b.canonicalPath ? 1 : 0))
  const rendered = articles.map(article => {
    assert.equal(article.sourceFile, `${article.id}/index.md`, `Invalid English source: ${article.sourceFile}`)
    assert(indexed.has(origin + article.canonicalPath), `Article is not a published canonical page: ${article.id}`)
    const source = fs.readFileSync(path.join(contentRoot, article.sourceFile))
    // Read again for rendering and reject edits made since validation. Never
    // pair a validated title/URL with a different article body.
    assert.equal(sha256(source), article.sourceSHA256, `KB metadata is stale: ${article.sourceFile}`)
    const raw = source.toString('utf8')
    assert(/^\uFEFF?---[^\S\r\n]*\r?\n/.test(raw), `Invalid YAML frontmatter: ${article.sourceFile}`)
    const markdown = renderKBArticleMarkdown(article, matter(raw).content)
    assert.equal(typeof markdown, 'string', `Invalid article Markdown: ${article.id}`)
    return markdown.endsWith('\n') ? markdown : markdown + '\n'
  })
  const intro = [
    '# Nervos Knowledge Base — full English articles',
    '',
    '> Complete text of the published English Knowledge Base articles. Translations, drafts and scheduled articles are excluded.',
    '',
    `- Knowledge Base: ${origin}/knowledge-base`,
    `- Sitemap: ${origin}/sitemap.xml`,
    `- Site guide: ${origin}/llms.txt`,
    `- Article count: ${articles.length}`,
    '',
    '',
  ].join('\n')
  // Publication dates come only from the shared article renderer. A build
  // timestamp is not an article's modification date and is never added here.
  const text = intro + rendered.join('\n---\n\n')
  const outputPath = path.join(repository, 'public/llms-full.txt')
  const temporaryPath = path.join(
    repository,
    'public',
    `.llms-full.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`,
  )
  // All validation and rendering succeed before touching the existing output.
  // A same-directory rename publishes the complete UTF-8 file atomically.
  try {
    fs.writeFileSync(temporaryPath, text, { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporaryPath, outputPath)
  } finally {
    fs.rmSync(temporaryPath, { force: true })
  }
  return { outputPath, articles: articles.length, bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'Usage: node scripts/generate-llms-full.mjs')
    const result = generateLLMSFull()
    console.log(
      `Generated llms-full.txt: ${result.articles} published English articles; ${result.bytes} UTF-8 bytes; SHA-256 ${result.sha256}.`,
    )
  } catch (error) {
    console.error(`llms-full.txt generation failed: ${error.message}`)
    process.exitCode = 1
  }
}
