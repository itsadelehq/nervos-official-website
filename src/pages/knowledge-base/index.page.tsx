import type { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { KnowledgeHubHome } from '../../components/KnowledgeHub/Home'
import { getKBCatalog } from '../../server/kb-content'
import { featuredArticles } from '../../components/KnowledgeHub/content'

export default KnowledgeHubHome

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const catalog = getKBCatalog(locale)
  const counts = Object.fromEntries(catalog.hubs.map(h => [h.id, catalog.articles.filter(a => a.hub === h.id).length]))
  catalog.articles = [
    ...new Map(catalog.hubs.flatMap(h => featuredArticles(catalog, h.id)).map(a => [a.id, a])).values(),
  ]
  return { props: { catalog, counts, ...(await serverSideTranslations(locale ?? 'en', ['common'])) } }
}
