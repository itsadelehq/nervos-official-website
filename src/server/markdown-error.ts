import type { NextPageContext } from 'next'
import { prefersMarkdown } from '../utils/markdown-accept'

export { prefersMarkdown }

export const markdownNotFound = `# Page not found

The page you requested does not exist on nervos.org. It may have moved or been removed.

- Site guide for AI tools: https://www.nervos.org/llms.txt
- All pages: https://www.nervos.org/sitemap.xml
- Knowledge Base: https://www.nervos.org/knowledge-base
- Developer documentation: https://docs.nervos.org/
`

/** Called only after Next has resolved a real page error, never to detect missing routes. */
export function respondToMarkdownNotFound({ req, res }: Pick<NextPageContext, 'req' | 'res'>): void {
  if (!req || !res || res.statusCode !== 404 || res.headersSent || res.writableEnded) return
  if (req.method !== 'GET' && req.method !== 'HEAD') return
  if (req.headers['x-nextjs-data'] !== undefined) return
  const pathname = (req.url ?? '').split('?')[0] ?? ''
  if (/^\/(?:[a-z]{2}(?:-[a-z]+)?\/)?(?:api|_next)(?:\/|$)/i.test(pathname)) return

  // Both variants must vary together; otherwise a cached HTML 404 can hide Markdown.
  const currentVary = res.getHeader('Vary')
  const vary = (Array.isArray(currentVary) ? currentVary.join(',') : String(currentVary ?? ''))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  if (!vary.some(value => value === '*' || value.toLowerCase() === 'accept')) vary.push('Accept')
  res.setHeader('Vary', vary.join(', '))
  res.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate')

  if (!prefersMarkdown(req.headers.accept)) return
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(markdownNotFound))
  res.end(req.method === 'HEAD' ? undefined : markdownNotFound)
}
