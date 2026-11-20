export interface KBArticleMarkdownInput {
  id: string
  title: string
  language: string
  canonicalPath: string
  date?: string | null
  subtitle?: string | null
}

/** Render this exact catalog rendition without IO or language fallback. */
export function renderKBArticleMarkdown(article: KBArticleMarkdownInput, body: string): string
