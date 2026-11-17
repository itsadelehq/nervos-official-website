import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import matter from 'gray-matter'
import { renderKBArticleMarkdown } from '../config/kb-article-markdown.mjs'
import { generateLLMSFull } from './generate-llms-full.mjs'

const now = Date.parse('2026-11-17T00:00:00Z')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

function fixture(t) {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-full-'))
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }))
  const root = path.join(repository, 'public/education_hub_articles')
  const metadata = path.join(root, 'metadata')
  fs.mkdirSync(metadata, { recursive: true })
  fs.writeFileSync(path.join(metadata, 'slug-migrations.json'), JSON.stringify({ renames: [] }))
  const articles = []
  const save = () => fs.writeFileSync(path.join(metadata, 'catalog.json'), JSON.stringify({ articles }))
  const add = (id, language = 'en', extra = {}, body = `Body for ${id} (${language}).\n`) => {
    const filename = language === 'en' ? 'index.md' : `index_${language}.md`
    const raw = `---\ntitle: ${id}\nlanguage: ${language}\n---\n${body}`
    fs.mkdirSync(path.join(root, id), { recursive: true })
    fs.writeFileSync(path.join(root, id, filename), raw)
    const article = {
      id,
      title: `Title for ${id}`,
      language,
      canonicalPath: `${language === 'en' ? '' : `/${language}`}/knowledge-base/${id}`,
      sourceFile: `${id}/${filename}`,
      sourceSHA256: sha256(raw),
      date: '2020-01-01T00:00:00.000Z',
      draft: false,
      ...extra,
    }
    articles.push(article)
    save()
    return { article, raw }
  }
  save()
  return { repository, root, articles, save, add, output: path.join(repository, 'public/llms-full.txt') }
}

test('B15 contains only published English articles in stable canonical order with no synthetic modification date', t => {
  const setup = fixture(t)
  setup.add('zebra')
  setup.add('zebra', 'zh', {}, 'Only the Chinese source contains this translation.\n')
  setup.add('zebra', 'es', {}, 'Only the Spanish source contains this translation.\n')
  setup.add('draft', 'en', { draft: true }, 'This is a private draft.\n')
  setup.add('future', 'en', { date: '2999-01-01T00:00:00.000Z' }, 'This is scheduled content.\n')
  setup.add('alpha', 'en', { date: null }, 'A complete first paragraph.\n\n## Detail\n\nThe final paragraph.\n')
  fs.writeFileSync(path.join(setup.root, 'README.md'), 'The repo README must not appear.\n')
  const result = generateLLMSFull({ repository: setup.repository, now })
  const text = fs.readFileSync(setup.output, 'utf8')
  assert.equal(result.articles, 2)
  assert.ok(text.indexOf('# Title for alpha') < text.indexOf('# Title for zebra'))
  assert.match(text, /A complete first paragraph\.\n\n## Detail\n\nThe final paragraph\./)
  assert.match(text, /Article count: 2/)
  assert.match(text, /https:\/\/www\.nervos\.org\/knowledge-base\/alpha/)
  assert.match(text, /https:\/\/www\.nervos\.org\/sitemap\.xml/)
  assert.match(text, /https:\/\/www\.nervos\.org\/llms\.txt/)
  assert.doesNotMatch(text, /private draft|scheduled content|Chinese source|Spanish source|repo README|2026-11-17|2999/)
  setup.articles.reverse()
  setup.save()
  generateLLMSFull({ repository: setup.repository, now: now + 1_000 })
  assert.equal(fs.readFileSync(setup.output, 'utf8'), text, 'Catalog order and build time do not change the snapshot')
})

test('B15 uses the exact shared article representation and reports verifiable UTF-8 bytes/hash', t => {
  const setup = fixture(t)
  const { article, raw } = setup.add(
    'example',
    'en',
    { subtitle: 'An English summary.' },
    'Unicode: 中文 and café.\n\n[Related](../other)\n\n![Diagram](images/diagram.png)\n\nThe complete final paragraph.\n',
  )
  const result = generateLLMSFull({ repository: setup.repository, now })
  const bytes = fs.readFileSync(setup.output)
  const text = bytes.toString('utf8')
  assert.ok(text.endsWith(renderKBArticleMarkdown(article, matter(raw).content)))
  assert.equal(result.bytes, bytes.length)
  assert.equal(result.sha256, sha256(bytes))
  assert.ok(bytes.length > text.length, 'The reported size counts UTF-8 bytes, not JavaScript characters')
  assert.doesNotMatch(text, /language: en|---\ntitle:/, 'Frontmatter is not emitted as article content')
})

test('B15 reflects source edits, new publications and deletions on the next generation', t => {
  const setup = fixture(t)
  const { article } = setup.add('example')
  generateLLMSFull({ repository: setup.repository, now })
  const original = fs.readFileSync(setup.output, 'utf8')
  const updated = '---\ntitle: example\n---\nNew complete article body.\n'
  fs.writeFileSync(path.join(setup.root, article.sourceFile), updated)
  article.sourceSHA256 = sha256(updated)
  setup.add('second')
  generateLLMSFull({ repository: setup.repository, now })
  const changed = fs.readFileSync(setup.output, 'utf8')
  assert.notEqual(changed, original)
  assert.match(changed, /New complete article body/)
  assert.match(changed, /# Title for second/)
  setup.articles.splice(setup.articles.indexOf(article), 1)
  fs.rmSync(path.join(setup.root, article.id), { recursive: true })
  setup.save()
  generateLLMSFull({ repository: setup.repository, now })
  const removed = fs.readFileSync(setup.output, 'utf8')
  assert.doesNotMatch(removed, /# Title for example|New complete article body/)
  assert.match(removed, /Article count: 1/)
})

test('B15 validates every source before replacing a prior complete output', async t => {
  const mutations = [
    ['English hash mismatch', setup => fs.appendFileSync(path.join(setup.root, 'example/index.md'), '\nChanged.')],
    [
      'excluded translation hash mismatch',
      setup => fs.appendFileSync(path.join(setup.root, 'example/index_zh.md'), '\nChanged.'),
    ],
    ['missing source', setup => fs.rmSync(path.join(setup.root, 'example/index.md'))],
    [
      'stale catalog inventory',
      setup => {
        setup.articles.pop()
        setup.save()
      },
    ],
    [
      'non-canonical URL',
      setup => {
        setup.articles[0].canonicalPath = '/en/knowledge-base/example'
        setup.save()
      },
    ],
    [
      'source identity mismatch',
      setup => {
        setup.articles[0].id = 'other'
        setup.save()
      },
    ],
    [
      'English source points to translation',
      setup => {
        setup.articles[0].language = 'zh'
        setup.articles[0].canonicalPath = '/zh/knowledge-base/example'
        setup.articles[1].language = 'en'
        setup.articles[1].canonicalPath = '/knowledge-base/example'
        setup.save()
      },
    ],
  ]
  for (const [name, mutate] of mutations) {
    await t.test(name, t => {
      const setup = fixture(t)
      setup.add('example')
      setup.add('example', 'zh')
      generateLLMSFull({ repository: setup.repository, now })
      const original = fs.readFileSync(setup.output)
      mutate(setup)
      assert.throws(() => generateLLMSFull({ repository: setup.repository, now }))
      assert.deepEqual(fs.readFileSync(setup.output), original)
      assert.deepEqual(
        fs.readdirSync(path.dirname(setup.output)).filter(name => name.startsWith('.llms-full.')),
        [],
      )
    })
  }
})

test('B15 build and dev generate the file after content preparation and before starting Next', () => {
  const { scripts } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['build', 'dev']) {
    const command = scripts[name]
    assert.ok(command.indexOf('prepare-kb-content.mjs') < command.indexOf('generate-sitemap.mjs'), name)
    assert.ok(command.indexOf('generate-sitemap.mjs') < command.indexOf('generate-llms-full.mjs'), name)
    assert.ok(command.indexOf('generate-llms-full.mjs') < command.indexOf(`next ${name}`), name)
  }
  assert.doesNotMatch(
    scripts['kb:prepare'],
    /generate-llms-full/,
    'The existing metadata-only command retains its scope',
  )
  const ignore = fs.readFileSync(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.match(ignore, /^\/public\/llms-full\.txt$/m)
  const guide = fs.readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8')
  assert.match(guide, /\[Full English article text\]\(https:\/\/www\.nervos\.org\/llms-full\.txt\)/)
})
