import type { NextApiRequest, NextApiResponse } from 'next'
import i18nConfig from '../../next-i18next.config.js'
import { renderKBArticleMarkdown } from '../../config/kb-article-markdown.mjs'
import { getKBArticle, getKBArticleMetadata, getKBArticleStatus, resolveKBArticleId } from './kb-content'
import { prefersMarkdown, writeMarkdownNotFound } from './markdown-error'

// Next can restore a locale-stripped public URL after a rewrite. Middleware
// binds its locale/ID in request headers, overwriting user-supplied copies.
// Direct API paths always bind both values themselves and ignore the headers.
export function markdownArticleIdentity(
  url: string | undefined,
  headers: NextApiRequest['headers'] = {},
): { id: string; language: string } | null {
  if (!url) return null
  let pathname: string
  try {
    pathname = new URL(url, 'https://www.nervos.org').pathname
  } catch {
    return null
  }
  const api = /^\/api\/markdown-article\/([^/]+)\/([^/]+)$/.exec(pathname)
  const page = /^(?:\/([^/]+))?\/knowledge-base\/([^/]+)$/.exec(pathname)
  const language = api?.[1] ?? headers['x-kb-markdown-language']
  const segment = api?.[2] ?? page?.[2]
  if (!segment || typeof language !== 'string' || !i18nConfig.i18n.locales.includes(language)) return null
  try {
    const id = decodeURIComponent(segment)
    if (!id || /[/\\\u0000-\u001f\u007f]/.test(id)) return null
    if (!api && page) {
      const boundID = headers['x-kb-markdown-id']
      if (typeof boundID !== 'string' || decodeURIComponent(boundID) !== id || (page[1] && page[1] !== language))
        return null
    }
    return { id, language }
  } catch {
    return null
  }
}

export function markdownArticleHandler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Vary', 'Accept')
  response.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate')
  response.setHeader('CDN-Cache-Control', 'no-store')
  response.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!prefersMarkdown(request.headers.accept)) {
    response.status(406)
    if (request.method === 'HEAD') response.end()
    else response.json({ error: 'This representation requires Accept: text/markdown' })
    return
  }
  const identity = markdownArticleIdentity(request.url, request.headers)
  if (!identity) return writeMarkdownNotFound(response, request.method)
  const id = resolveKBArticleId(identity.id)
  const article = getKBArticleMetadata(id, identity.language)
  if (!article) {
    // Match the HTML route: a genuinely missing translation redirects to
    // English; an existing unpublished translation must stay unavailable.
    const english =
      identity.language !== 'en' && getKBArticleStatus(id, identity.language) === 'missing'
        ? getKBArticleMetadata(id, 'en')
        : null
    if (english) {
      response.status(308).setHeader('Location', encodeURI(english.canonicalPath))
      response.end()
      return
    }
    return writeMarkdownNotFound(response, request.method)
  }
  if (id !== identity.id) {
    response.status(308).setHeader('Location', encodeURI(article.canonicalPath))
    response.end()
    return
  }
  const body = getKBArticle(id, identity.language)
  if (body === null) return writeMarkdownNotFound(response, request.method)
  const markdown = renderKBArticleMarkdown(article, body)
  response.status(200)
  response.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  response.setHeader('Content-Language', article.language)
  response.setHeader('Link', `<${new URL(article.canonicalPath, 'https://www.nervos.org').href}>; rel="canonical"`)
  response.setHeader('Content-Length', Buffer.byteLength(markdown))
  response.end(request.method === 'HEAD' ? undefined : markdown)
}
