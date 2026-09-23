import type { GetStaticPaths, GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { remark } from 'remark'
import { byDate, relatedArticles } from '../components/KnowledgeHub/content'
import { headingTree } from '../components/KnowledgeHub/markdown-headings'
import { getKBArticle, getKBCatalog } from './kb-content'

type ArticleRoute = 'canonical' | 'preview'

export const articleStaticPaths =
  (route: ArticleRoute): GetStaticPaths =>
  ({ locales }) => {
    const englishArticles = getKBCatalog('en').articles
    return {
      paths: (locales ?? ['en']).flatMap(locale =>
        // The existing public route also serves English when a translation is absent.
        (route === 'canonical' ? englishArticles : getKBCatalog(locale).articles).map(article => ({
          params: { slug: article.id },
          locale,
        })),
      ),
      fallback: false,
    }
  }

export const articleStaticProps =
  (route: ArticleRoute): GetStaticProps =>
  async ({ params, locale }) => {
    const id = typeof params?.slug === 'string' ? params.slug : ''
    if (!id) return { notFound: true }
    const language = locale ?? 'en'
    let catalog = getKBCatalog(language)
    let article = catalog.articles.find(item => item.id === id)
    if (!article && route === 'canonical' && language !== 'en') {
      catalog = getKBCatalog('en')
      article = catalog.articles.find(item => item.id === id)
    }
    if (!article) return { notFound: true }
    const markdown = getKBArticle(id, article.language)
    if (markdown === null) return { notFound: true }
    return {
      props: {
        article,
        markdown,
        preview: route === 'preview',
        headings: headingTree(remark().parse(markdown)),
        related: relatedArticles(article, catalog),
        recent: catalog.articles
          .filter(item => item.id !== id)
          .sort(byDate)
          .slice(0, 3),
        hub: catalog.hubs.find(hub => hub.id === article.hub) ?? null,
        subjects: catalog.subjects.filter(subject => article.subjects.includes(subject.id)),
        ...(await serverSideTranslations(language, ['common'])),
      },
    }
  }
