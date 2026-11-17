import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'
import rehypeRaw from 'rehype-raw'

const origin = 'https://www.nervos.org'
const markdown = remark().use(remarkGfm)
const html = unified().use(rehypeRaw)

function walk(node, visitor) {
  visitor(node)
  if (Array.isArray(node.children)) node.children.forEach(child => walk(child, visitor))
}

function resolveURL(value, article, image = false) {
  if (!value.trim() || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value
  const source = new URL(article.canonicalPath, origin)
  // Fragment links must still identify their source article in llms-full.txt.
  if (value.startsWith('#')) return new URL(value, source).href
  const base = image ? new URL(`/education_hub_articles/${encodeURIComponent(article.id)}/`, origin) : source
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

// Locate one attribute only after the HTML parser has identified a real a/img
// element. Quoted > characters, comments and script/code text are not tags.
function attributeRange(source, start, wanted) {
  if (source[start] !== '<') return null
  let offset = start + 1
  while (offset < source.length && !/[\t\n\f\r />]/.test(source[offset])) offset++
  while (offset < source.length) {
    while (/[\t\n\f\r ]/.test(source[offset] ?? '')) offset++
    if (source[offset] === '>' || source[offset] === '/' || offset >= source.length) return null
    const nameStart = offset
    while (offset < source.length && !/[\t\n\f\r =/>]/.test(source[offset])) offset++
    const name = source.slice(nameStart, offset).toLowerCase()
    if (offset === nameStart) return null
    while (/[\t\n\f\r ]/.test(source[offset] ?? '')) offset++
    if (source[offset] !== '=') continue
    offset++
    while (/[\t\n\f\r ]/.test(source[offset] ?? '')) offset++
    const quote = source[offset] === '"' || source[offset] === "'" ? source[offset++] : ''
    const valueStart = offset
    if (quote) while (offset < source.length && source[offset] !== quote) offset++
    else while (offset < source.length && !/[\t\n\f\r >]/.test(source[offset])) offset++
    if (name === wanted) return { start: valueStart, end: offset, quote }
    if (quote && source[offset] === quote) offset++
  }
  return null
}

function escapeAttribute(value, quote) {
  const encoded = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  if (quote === "'") return encoded.replaceAll("'", '&#39;')
  if (quote === '"') return encoded.replaceAll('"', '&quot;')
  return encoded.replace(/[\s"'`=]/g, character => `&#${character.codePointAt(0)};`)
}

function rewriteHTML(value, article) {
  const lines = value.split('\n')
  const tree = html.runSync(
    {
      type: 'root',
      children: [
        {
          type: 'raw',
          value,
          position: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: lines.length, column: lines.at(-1).length + 1, offset: value.length },
          },
        },
      ],
    },
    value,
  )
  const replacements = new Map()
  walk(tree, node => {
    const attribute = node.tagName === 'img' ? 'src' : node.tagName === 'a' ? 'href' : null
    const original = attribute && node.properties?.[attribute]
    if (typeof original !== 'string' || node.position?.start.offset === undefined) return
    const target = resolveURL(original, article, attribute === 'src')
    if (target === original) return
    const range = attributeRange(value, node.position.start.offset, attribute)
    if (range) replacements.set(range.start, { ...range, value: escapeAttribute(target, range.quote) })
  })
  // Keep every other HTML byte, including element attributes and inline text.
  for (const replacement of [...replacements.values()].sort((a, b) => b.start - a.start))
    value = value.slice(0, replacement.start) + replacement.value + value.slice(replacement.end)
  return value
}

/**
 * Render one real catalog rendition and its already frontmatter-free body.
 * Pure and synchronous: no filesystem, network, translation or slug guessing.
 * @param {import('./kb-article-markdown.mjs').KBArticleMarkdownInput} article
 * @param {string} body
 * @returns {string}
 */
export function renderKBArticleMarkdown(article, body) {
  const source = new URL(article.canonicalPath, origin)
  if (source.origin !== origin || !source.pathname.startsWith('/')) throw new Error('Invalid article canonical path')
  const tree = markdown.parse(body)
  const definitions = new Map()
  const references = new Map()
  walk(tree, node => {
    if (node.type === 'definition' && !definitions.has(node.identifier))
      definitions.set(node.identifier, { url: node.url, title: node.title })
    if (node.type === 'imageReference' || node.type === 'linkReference') {
      const kinds = references.get(node.identifier) ?? new Set()
      kinds.add(node.type)
      references.set(node.identifier, kinds)
    }
  })
  walk(tree, node => {
    if (node.type === 'imageReference' && references.get(node.identifier)?.has('linkReference')) {
      // One reference can be used as both a link and an image. The HTML page
      // resolves those against different bases, so expand just this image.
      const definition = definitions.get(node.identifier)
      if (definition) {
        node.type = 'image'
        node.url = resolveURL(definition.url, article, true)
        node.title = definition.title
        delete node.identifier
        delete node.label
        delete node.referenceType
      }
    } else if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      const image =
        node.type === 'image' ||
        (node.type === 'definition' &&
          references.get(node.identifier)?.has('imageReference') &&
          !references.get(node.identifier)?.has('linkReference'))
      node.url = resolveURL(node.url, article, image)
    } else if (node.type === 'html') node.value = rewriteHTML(node.value, article)
  })
  const title = markdown.stringify({
    type: 'root',
    children: [{ type: 'heading', depth: 1, children: [{ type: 'text', value: article.title }] }],
  })
  const fields = [`Source: ${source.href}`, `Language: ${article.language}`]
  if (article.date && Number.isFinite(Date.parse(article.date))) fields.push(`Published: ${article.date}`)
  const subtitle = article.subtitle?.trim()
    ? markdown.stringify({
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: article.subtitle }] }],
      }) + '\n'
    : ''
  return `${title}\n${fields.join('\n')}\n\n${subtitle}${markdown.stringify(tree)}`
}
