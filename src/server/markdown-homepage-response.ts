import type { NextApiRequest, NextApiResponse } from 'next'
import { renderMarkdownHomepage, type MarkdownHomepage } from './markdown-homepages'
import { prefersMarkdown } from '../utils/markdown-accept'

// Public read-only content reached by the two landing-page middleware rewrites.
// No arbitrary path, language, filesystem location or forwarded query is used.
export function markdownHomepageHandler(page: MarkdownHomepage) {
  return function handler(request: NextApiRequest, response: NextApiResponse) {
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
    const markdown = renderMarkdownHomepage(page)
    response.status(200)
    response.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    response.setHeader('Content-Length', Buffer.byteLength(markdown))
    response.end(request.method === 'HEAD' ? undefined : markdown)
  }
}
