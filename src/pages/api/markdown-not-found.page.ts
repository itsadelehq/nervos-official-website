import type { NextApiRequest, NextApiResponse } from 'next'
import { prefersMarkdown, writeMarkdownNotFound } from '../../server/markdown-error'

// A fixed read-only endpoint avoids Vercel's prerendered negative-cache path.
// The middleware selects it only after confirming that an article is missing.
export default function handler(request: NextApiRequest, response: NextApiResponse) {
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
  writeMarkdownNotFound(response, request.method)
}
