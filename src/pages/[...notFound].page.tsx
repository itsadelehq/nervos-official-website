import type { GetServerSideProps } from 'next'
import NextError from 'next/error'
import { respondToMarkdownNotFound } from '../server/markdown-error'

export default function NotFoundPage() {
  return <NextError statusCode={404} />
}

// Specific pages, APIs and public files retain their normal routing priority.
// An SSR fallback is necessary because Vercel otherwise serves its own 404
// without invoking the request-aware _error handler used by next start.
export const getServerSideProps: GetServerSideProps = ({ req, res }) => {
  res.statusCode = 404
  respondToMarkdownNotFound({ req, res })
  if (res.writableEnded) return Promise.resolve({ props: {} })
  // Preserve Next's HTML error rendering and notFound client-navigation JSON.
  return Promise.resolve({ notFound: true })
}
