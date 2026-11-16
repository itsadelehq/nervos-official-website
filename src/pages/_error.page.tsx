import type { NextPageContext } from 'next'
import NextError, { type ErrorProps } from 'next/error'
import { respondToMarkdownNotFound } from '../server/markdown-error'

function ErrorPage(props: ErrorProps) {
  return <NextError {...props} />
}

// Keep this request-aware: a static /404 page would bypass content negotiation.
ErrorPage.getInitialProps = async (context: NextPageContext) => {
  const props = await NextError.getInitialProps(context)
  respondToMarkdownNotFound(context)
  return props
}

export default ErrorPage
