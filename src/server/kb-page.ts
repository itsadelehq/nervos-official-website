import type { GetServerSideProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { getKBCatalog, getKBPublishedArticleSummaries } from './kb-content'
import { byDate, searchArticles } from '../components/KnowledgeHub/content'
import type { KBArticle } from '../components/KnowledgeHub/content'
import type { LibraryProps } from '../components/KnowledgeHub/Library'

export function archiveAlternates(
  articles: Pick<KBArticle, 'id' | 'language' | 'date'>[],
  language: string,
  page: number,
): NonNullable<LibraryProps['archiveAlternates']> {
  const pageIds = (locale: string) =>
    articles
      .filter(article => article.language === locale)
      .sort(byDate)
      .slice((page - 1) * 24, page * 24)
      .map(article => article.id)
      .sort()
  const current = pageIds(language)
  if (!current.length) return []
  // Matching page numbers alone are insufficient: translation coverage and
  // publication dates can move articles between pages in different languages.
  const languages = [...new Set(articles.map(article => article.language))].filter(locale => {
    const ids = pageIds(locale)
    return ids.length === current.length && ids.every((id, index) => id === current[index])
  })
  const route = `/knowledge-base/articles${page > 1 ? `?page=${page}` : ''}`
  const urlFor = (locale: string) => `https://www.nervos.org${locale === 'en' ? '' : `/${locale}`}${route}`
  return [
    ...languages.map(locale => ({ language: locale, url: urlFor(locale) })),
    ...(languages.includes('en') ? [{ language: 'x-default', url: urlFor('en') }] : []),
  ]
}

export const libraryProps =
  (mode: LibraryProps['mode']): GetServerSideProps =>
  async ({ locale, query }) => {
    const catalog = getKBCatalog(locale, mode === 'search')
    const q = typeof query.q === 'string' ? query.q.slice(0, 200) : ''
    const requested = typeof query.hub === 'string' ? query.hub : 'blockchain-scalability'
    const hub = catalog.hubs.find(h => h.id === requested || h.name === requested)
    if (mode === 'topic' && !hub) return { notFound: true }
    const articles =
      mode === 'search'
        ? searchArticles(q, catalog)
        : catalog.articles.filter(a => mode !== 'topic' || a.hub === hub?.id).sort(byDate)
    const page = query.page === undefined ? 1 : Number(query.page)
    if (!Number.isInteger(page) || page < 1 || (page > 1 && (page - 1) * 24 >= articles.length))
      return { notFound: true }
    const selected = mode === 'topic' ? articles : articles.slice((page - 1) * 24, page * 24)
    catalog.articles = selected.map(a => {
      const copy = { ...a }
      delete copy.text
      return copy
    })
    return {
      props: {
        catalog,
        mode,
        hubId: hub?.id ?? '',
        subjectId: typeof query.subject === 'string' ? query.subject : '',
        query: q,
        page,
        total: articles.length,
        ...(mode === 'archive'
          ? { archiveAlternates: archiveAlternates(getKBPublishedArticleSummaries(), locale ?? 'en', page) }
          : {}),
        ...(await serverSideTranslations(locale ?? 'en', ['common'])),
      },
    }
  }
