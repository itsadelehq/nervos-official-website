import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import { remark } from 'remark'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = process.cwd()
function load(filename, overrides = {}) {
  const full = path.resolve(root, filename)
  const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const loaded = { exports: {} }
  const resolve = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name]
    if (!name.startsWith('.')) return require(name)
    const target = path.resolve(path.dirname(full), name)
    if (fs.existsSync(target + '.ts')) return load(path.relative(root, target + '.ts'), overrides)
    return require(target)
  }
  new Function('require', 'module', 'exports', compiled)(resolve, loaded, loaded.exports)
  return loaded.exports
}
const home = JSON.parse(fs.readFileSync('public/locales/en/home.json', 'utf8'))
const bodyText = value =>
  value
    .replace(/&shy;|\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim()
function links(markdown) {
  const urls = []
  function visit(node) {
    if (node.type === 'link') urls.push(node.url)
    for (const child of node.children ?? []) visit(child)
  }
  visit(remark().parse(markdown))
  return urls
}

function renderer(catalog, mostRead = { articles: [] }) {
  const calls = []
  const { renderMarkdownHomepage } = load('src/server/markdown-homepages.ts', {
    './kb-content': {
      getKBCatalog: locale => {
        calls.push(['catalog', locale])
        return catalog
      },
    },
    './kb-most-read': {
      getKBMostRead: input => {
        assert.equal(input, catalog, 'Popularity must see the full unmodified catalog')
        return mostRead
      },
    },
  })
  return { render: renderMarkdownHomepage, calls }
}

function article(id, hub, extra = {}) {
  return {
    id,
    language: 'en',
    canonicalPath: `/knowledge-base/${id}`,
    title: `Article ${id}`,
    hub,
    readingMinutes: 5,
    date: '2026-01-01',
    ...extra,
  }
}

test('main homepage preserves existing section copy and destinations without interactive or loading text', () => {
  const { render, calls } = renderer({})
  const markdown = render('home')
  assert.ok(markdown.startsWith('# Common Knowledge Base\n'))
  for (const section of [
    'slide_ckb_intro',
    'slide_ckb_security',
    'slide_ckb_flexibility',
    'slide_ckb_subtainability',
    'slide_ckb_modular',
  ]) {
    for (const [key, value] of Object.entries(home[section])) {
      if (key.endsWith('_comment')) continue
      assert.ok(markdown.includes(bodyText(value)), `${section}.${key} remains page copy`)
    }
  }
  for (const card of [home.get_started.axon, home.get_started.developers, home.get_started.learn_more]) {
    assert.ok(markdown.includes(card.title))
    assert.ok(markdown.includes(card.description))
  }
  assert.deepEqual(links(markdown), [
    'https://docs.nervos.org/',
    'https://ckbeco.fund/',
    'https://axonweb3.io/',
    'https://www.nervos.org/developers',
    'https://www.nervos.org/',
  ])
  assert.doesNotMatch(markdown, /&shy;|\u00ad|Scroll Down|LEFT CLICK TO DRAW|loading/)
  assert.deepEqual(calls, [], 'Main homepage does not read article content or analytics')
})

test('KB homepage keeps real counts, featured selection and ranked articles even outside the featured list', () => {
  const articles = [
    article('latest', 'blockchain-cryptography'),
    article('pinned', 'blockchain-cryptography'),
    article('ranked', null),
  ]
  const catalog = {
    articles,
    hubs: [{ id: 'blockchain-cryptography', name: 'Blockchain Cryptography' }],
    featured: [{ hub: 'blockchain-cryptography', language: 'en', order: 1, articleId: 'pinned' }],
  }
  const before = JSON.stringify(catalog)
  const { render, calls } = renderer(catalog, { articles: [articles[2]] })
  const markdown = render('knowledge-base')
  assert.ok(markdown.startsWith('# Knowledge Base\n'))
  assert.match(markdown, /\[Explore the guide\]\(https:\/\/www\.nervos\.org\/knowledge-base\/start-here\)/)
  assert.match(markdown, /\[2 Articles\]\(https:\/\/www\.nervos\.org\/knowledge-base\/topic\/blockchain-cryptography\)/)
  assert.ok(markdown.indexOf('Article pinned') < markdown.indexOf('Article latest'))
  assert.match(markdown, /## What everyone's reading\n\n- \[Article ranked\]/)
  assert.match(markdown, /\(5 min read\)/)
  assert.match(markdown, /\[See all articles\]\(https:\/\/www\.nervos\.org\/knowledge-base\/articles\)/)
  assert.deepEqual(calls, [['catalog', 'en']])
  assert.equal(JSON.stringify(catalog), before, 'Rendering does not prune or modify the source catalog')
})

test('KB fallback uses the same first featured item per hub and does not claim measured popularity', () => {
  const first = article('first', 'blockchain-cryptography')
  const next = article('next', 'blockchain-cryptography')
  const catalog = {
    articles: [next, first],
    hubs: [{ id: 'blockchain-cryptography', name: 'Blockchain Cryptography' }],
    featured: [{ hub: 'blockchain-cryptography', language: 'en', order: 1, articleId: 'first' }],
  }
  const markdown = renderer(catalog).render('knowledge-base')
  assert.match(markdown, /## Recommended reading\n\n- \[Article first\]/)
  assert.doesNotMatch(markdown, /What everyone's reading/)
  const recommendations = markdown.split('## Recommended reading\n')[1].split('## The Blockchain Signal')[0]
  assert.ok(!recommendations.includes('Article next'))
})

test('editorial Markdown and HTML-like title characters remain literal text inside article links', () => {
  const item = article('safe', 'blockchain-cryptography', {
    title: '[bait](https://evil.test/) <script> **bold** _tag_\n# injected',
    text: 'ARTICLE BODY MUST NOT BE EXPOSED',
  })
  const catalog = { articles: [item], hubs: [], featured: [] }
  const markdown = renderer(catalog, { articles: [item] }).render('knowledge-base')
  assert.ok(markdown.includes('\\[bait\\](https://evil.test/) \\<script\\> \\*\\*bold\\*\\* \\_tag\\_ \\# injected'))
  assert.ok(!links(markdown).some(url => url.includes('evil.test')))
  assert.doesNotMatch(markdown, /<script>|\n# injected|ARTICLE BODY MUST NOT BE EXPOSED/)
})

test('the live published catalog supplies six real topic destinations and no article bodies or images', () => {
  const { getKBCatalog } = load('src/server/kb-content.ts')
  const { getKBMostRead } = load('src/server/kb-most-read.ts')
  const catalog = getKBCatalog('en')
  const markdown = renderer(catalog, getKBMostRead(catalog)).render('knowledge-base')
  for (const hub of catalog.hubs) {
    assert.ok(links(markdown).includes(`https://www.nervos.org/knowledge-base/topic/${hub.id}`))
  }
  assert.equal(catalog.hubs.length, 6)
  for (const target of ['https://docs.nervos.org/', 'https://talk.nervos.org/', 'https://ckba.build/']) {
    assert.ok(links(markdown).includes(target))
  }
  const englishPaths = new Set(catalog.articles.map(item => `https://www.nervos.org${item.canonicalPath}`))
  for (const target of links(markdown).filter(url =>
    /^https:\/\/www\.nervos\.org\/knowledge-base\/(?!topic\/|start-here|articles)/.test(url),
  )) {
    assert.ok(englishPaths.has(target), target)
  }
  assert.match(markdown, /## The Blockchain Signal/)
  assert.match(markdown, /Monthly\. Unsubscribe anytime\./)
  assert.doesNotMatch(markdown, /<form|<input|!\[|loading|sourceSHA256|propertyId|Views/)
})
