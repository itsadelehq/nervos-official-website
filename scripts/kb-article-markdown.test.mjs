import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import matter from 'gray-matter'
import { renderKBArticleMarkdown } from '../config/kb-article-markdown.mjs'

const parser = remark().use(remarkGfm)
const article = Object.freeze({
  id: 'example_article',
  title: '关于 CKB 的指南',
  language: 'zh',
  canonicalPath: '/zh/knowledge-base/example_article',
  date: '2026-10-01T00:00:00Z',
  subtitle: '来自同一篇译文的副标题。',
})
function nodes(body, type) {
  const result = []
  function walk(node) {
    if (node.type === type) result.push(node)
    node.children?.forEach(walk)
  }
  walk(parser.parse(body))
  return result
}

test('renders the exact rendition metadata and full Unicode body without inventing fields or translations', () => {
  const body = '第一段正文。\n\n## 细节\n\n最后一段：完整保留。\n'
  const output = renderKBArticleMarkdown(article, body)
  assert.match(output, /^# 关于 CKB 的指南\n/)
  assert.ok(output.includes('Source: https://www.nervos.org/zh/knowledge-base/example_article\n'))
  assert.ok(output.includes('Language: zh\nPublished: 2026-10-01T00:00:00Z\n'))
  assert.ok(output.includes(article.subtitle))
  for (const text of ['第一段正文。', '## 细节', '最后一段：完整保留。']) assert.ok(output.includes(text))
  assert.ok(output.endsWith('\n'))
  assert.equal(body, '第一段正文。\n\n## 细节\n\n最后一段：完整保留。\n', 'The source body is not mutated')
  const minimal = renderKBArticleMarkdown({ ...article, date: 'invalid', subtitle: null }, 'A real body.\n')
  assert.doesNotMatch(minimal, /Published:|Subtitle:|Description:|Author:|undefined|null/)
  assert.doesNotMatch(minimal, /来自同一篇译文/)
})

test('uses the page URL for links, the shared source folder for images and canonical URLs for fragments', () => {
  const output = renderKBArticleMarkdown(
    article,
    [
      '[Peer](other_article?ref=one#details)',
      '[Parent](../another-page)',
      '[Root](/knowledge-base/other_article)',
      '[Fragment](#section-2)',
      '![Relative](images/cell%20diagram.png?v=1&download=1)',
      '![Parent image](../shared/cell.png)',
      '![Public](/images/logo.svg)',
    ].join('\n\n'),
  )
  assert.deepEqual(
    nodes(output, 'link')
      .slice(1)
      .map(node => node.url),
    [
      'https://www.nervos.org/zh/knowledge-base/other_article?ref=one#details',
      'https://www.nervos.org/zh/another-page',
      'https://www.nervos.org/knowledge-base/other_article',
      'https://www.nervos.org/zh/knowledge-base/example_article#section-2',
    ],
  )
  assert.deepEqual(
    nodes(output, 'image').map(node => node.url),
    [
      'https://www.nervos.org/education_hub_articles/example_article/images/cell%20diagram.png?v=1&download=1',
      'https://www.nervos.org/education_hub_articles/shared/cell.png',
      'https://www.nervos.org/images/logo.svg',
    ],
  )
})

test('retains explicit external, mail, protocol-relative and translated URLs rather than guessing slug or locale', () => {
  const targets = [
    'https://external.example/guide?q=one#part',
    'http://external.example/guide',
    '//cdn.example/image.png',
    'mailto:media@nervos.org',
    'tel:+12345',
    'https://www.nervos.org/es/knowledge-base/existing_article',
  ]
  const body = targets.map((url, index) => `[Target ${index}](${url})`).join('\n\n')
  const output = renderKBArticleMarkdown(article, body)
  assert.deepEqual(
    nodes(output, 'link')
      .slice(1)
      .map(node => node.url),
    targets,
  )
  const markdownPath = renderKBArticleMarkdown(article, '[Source path](../article/index.md)')
  assert.equal(nodes(markdownPath, 'link').at(-1).url, 'https://www.nervos.org/zh/article/index.md')
})

test('resolves references by their actual image/link use, including one shared definition and definitions before use', () => {
  const body = [
    '[both]: images/shared.png "Shared"',
    '[image-only]: images/diagram.png',
    '[link-only]: next_article',
    '',
    '![Image][both] and [link][both].',
    '',
    '![Only image][image-only] and [only link][link-only].',
  ].join('\n')
  const output = renderKBArticleMarkdown(article, body)
  const definitions = new Map(nodes(output, 'definition').map(node => [node.identifier, node.url]))
  assert.equal(definitions.get('both'), 'https://www.nervos.org/zh/knowledge-base/images/shared.png')
  assert.equal(
    definitions.get('image-only'),
    'https://www.nervos.org/education_hub_articles/example_article/images/diagram.png',
  )
  assert.equal(definitions.get('link-only'), 'https://www.nervos.org/zh/knowledge-base/next_article')
  const sharedImage = nodes(output, 'image')[0]
  assert.equal(sharedImage.url, 'https://www.nervos.org/education_hub_articles/example_article/images/shared.png')
  assert.equal(sharedImage.title, 'Shared')
  assert.equal(nodes(output, 'imageReference')[0].identifier, 'image-only')
  assert.equal(nodes(output, 'linkReference').length, 2)
})

test('rewrites only actual raw HTML URL attributes and preserves the rest of the markup', () => {
  const body = [
    '<div data-example="<img src=\'not-a-tag.png\'>">',
    '<a class="guide" title="x > y" HREF = \'./peer?x=1&amp;y=2\'>Read</a>',
    '<IMG src=images/cell.png width="700px" alt="alt_text">',
    '<img src="/images/logo.svg" data-keep="yes">',
    '<img src=images/cell\u00a0diagram.png alt="Unicode path">',
    '<a href="#section-2">Local section</a>',
    '<a href="mailto:media@nervos.org">Email</a>',
    '<a href="https://external.example/?a=1&amp;b=2">External</a>',
    '</div>',
  ].join('\n')
  const output = renderKBArticleMarkdown(article, body)
  assert.ok(output.includes('<div data-example="<img src=\'not-a-tag.png\'>">'))
  assert.ok(
    output.includes(
      '<a class="guide" title="x > y" HREF = \'https://www.nervos.org/zh/knowledge-base/peer?x=1&amp;y=2\'>Read</a>',
    ),
  )
  assert.ok(
    output.includes(
      '<IMG src=https://www.nervos.org/education_hub_articles/example_article/images/cell.png width="700px" alt="alt_text">',
    ),
  )
  assert.ok(output.includes('<img src="https://www.nervos.org/images/logo.svg" data-keep="yes">'))
  assert.ok(
    output.includes(
      '<img src=https://www.nervos.org/education_hub_articles/example_article/images/cell%C2%A0diagram.png alt="Unicode path">',
    ),
  )
  assert.ok(
    output.includes('<a href="https://www.nervos.org/zh/knowledge-base/example_article#section-2">Local section</a>'),
  )
  assert.ok(output.includes('<a href="mailto:media@nervos.org">Email</a>'))
  assert.ok(output.includes('<a href="https://external.example/?a=1&amp;b=2">External</a>'))
})

test('does not rewrite Markdown code, inline code, HTML comments or raw-text/script examples', () => {
  const body = [
    '```html',
    '<img src="images/code.png">',
    '[code](../literal)',
    '```',
    '',
    '`![inline](images/code.png)`',
    '',
    '<!-- <a href="relative">Comment</a><img src="comment.png"> -->',
    '',
    '<script>const sample = \'<a href="relative">example</a>\';</script>',
    '',
    '<pre><code>&lt;img src="code.png"&gt;</code></pre>',
  ].join('\n')
  const output = renderKBArticleMarkdown(article, body)
  assert.equal(nodes(output, 'code')[0].value, '<img src="images/code.png">\n[code](../literal)')
  assert.equal(nodes(output, 'inlineCode')[0].value, '![inline](images/code.png)')
  assert.ok(output.includes('<!-- <a href="relative">Comment</a><img src="comment.png"> -->'))
  assert.ok(output.includes('<script>const sample = \'<a href="relative">example</a>\';</script>'))
  assert.ok(output.includes('<pre><code>&lt;img src="code.png"&gt;</code></pre>'))
})

test('retains GFM tables, task lists, footnotes and source code values across rendering', () => {
  const body =
    '| Feature | Status |\n| --- | --- |\n| CKB | ✅ |\n\n- [x] Verified\n- [ ] Pending\n\nA note.[^1]\n\n[^1]: Source note.\n\n~~~js\nconst x = "images/code.png"\n~~~\n'
  const output = renderKBArticleMarkdown(article, body)
  assert.equal(nodes(output, 'table').length, 1)
  assert.deepEqual(
    nodes(output, 'listItem').map(node => node.checked),
    [true, false],
  )
  assert.equal(nodes(output, 'footnoteDefinition')[0].children[0].children[0].value, 'Source note.')
  assert.equal(nodes(output, 'code')[0].value, 'const x = "images/code.png"')
})

test('renders representative real source renditions through the shared HTML/Markdown content model', () => {
  const root = path.resolve('public/education_hub_articles')
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'metadata/catalog.json'), 'utf8'))
  const chosen = [
    catalog.articles.find(item => item.id === 'nervosdao_withdrawal_process_explained' && item.language === 'en'),
    catalog.articles.find(item => item.language === 'zh'),
    catalog.articles.find(item => item.language === 'es'),
  ]
  for (const rendition of chosen) {
    assert.ok(rendition)
    const { content } = matter(fs.readFileSync(path.join(root, rendition.sourceFile), 'utf8'))
    const output = renderKBArticleMarkdown(rendition, content)
    assert.ok(output.includes(`Language: ${rendition.language}`))
    assert.ok(output.includes(`Source: https://www.nervos.org${rendition.canonicalPath}`))
    assert.ok(output.length > content.length / 2, 'The complete article is rendered, rather than a summary')
    for (const image of nodes(output, 'image')) assert.ok(!/^images\//.test(image.url))
    assert.equal(nodes(output, 'code').length, nodes(content, 'code').length)
  }
})
