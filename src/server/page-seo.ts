import type { GetServerSideProps, GetStaticProps } from 'next'
import type { KBArticle, KBCatalog } from '../components/KnowledgeHub/content'
import type { PageSEO } from '../utils/page-seo'
import { PRODUCTION_SITE_ORIGIN, sharingPageUrl } from '../utils/sharing-urls'
import { getKBArticle, getKBArticleStatus } from './kb-content'
import i18nConfig from '../../next-i18next.config'
import { kbHubPath } from '../utils/kb-hubs'
import { coreNamespaces, coreLanguages } from '../../config/site-indexing.mjs'
import { articleStructuredData, homepageStructuredData, kbCollectionStructuredData } from './structured-data'

function languageSet(route: string, languages: string[]): PageSEO['alternates'] {
  const alternates = languages.map(language => ({ language, url: sharingPageUrl(route, language) }))
  if (languages.includes('en')) alternates.push({ language: 'x-default', url: sharingPageUrl(route) })
  return alternates
}

type PageData = {
  article?: KBArticle
  catalog?: KBCatalog
  page?: number
  hubId?: string
  preview?: boolean
  archiveAlternates?: PageSEO['alternates']
}

export function getPageSEO(route: string, requestedLanguage = 'en', props: PageData = {}): PageSEO {
  if (props.article) {
    const { id, language, canonicalPath } = props.article
    // Verify the actual files and publication state, not a hard-coded en/zh/es
    // list. New published translations join the reciprocal set on regeneration.
    const languages = i18nConfig.i18n.locales.filter(
      locale => getKBArticleStatus(id, locale) === 'published' && getKBArticle(id, locale) !== null,
    )
    const canonical = sharingPageUrl(new URL(canonicalPath, PRODUCTION_SITE_ORIGIN).pathname)
    const structuredData =
      route === '/knowledge-base/[slug]' && !props.preview && languages.includes(language)
        ? articleStructuredData(props.article, canonical)
        : []
    return {
      canonical,
      language,
      alternates: languageSet(`/knowledge-base/${id}`, languages),
      ...(structuredData.length ? { structuredData } : {}),
    }
  }

  const namespace = coreNamespaces[route]
  if (namespace) {
    const languages = coreLanguages(namespace)
    const language = languages.includes(requestedLanguage) ? requestedLanguage : 'en'
    // /home is the same page as /; no redirect or visible navigation change.
    const canonicalRoute = route === '/home' ? '/' : route
    return {
      canonical: sharingPageUrl(canonicalRoute, language),
      language,
      alternates: languageSet(canonicalRoute, languages),
      ...(canonicalRoute === '/' ? { structuredData: homepageStructuredData() } : {}),
    }
  }

  if (route === '/knowledge-base/articles') {
    // D-07's explicit pagination rule takes precedence over stripping queries.
    const language = props.catalog?.articles[0]?.language ?? 'en'
    const page = props.page ?? 1
    const canonical = sharingPageUrl(`${route}${page > 1 ? `?page=${page}` : ''}`, language)
    // The loader only pairs pages with the same published article IDs. Page N
    // alone does not establish an equivalent page in another language.
    return { canonical, language, alternates: props.archiveAlternates ?? [] }
  }

  // The redesigned landing copy is currently English only. Do not advertise
  // translated Hub/Start Here pages simply because their URL has a locale.
  const canonicalRoute = route === '/knowledge-base/topic' ? (kbHubPath(props.hubId) ?? '/knowledge-base') : route
  const canonical = sharingPageUrl(canonicalRoute)
  const structuredData = props.preview ? [] : kbCollectionStructuredData(route, canonical, props)
  return {
    canonical,
    language: 'en',
    alternates: route === '/knowledge-base/search' ? [] : languageSet(canonicalRoute, ['en']),
    ...(structuredData.length ? { structuredData } : {}),
  }
}

export function withStaticPageSEO(route: string, load: GetStaticProps): GetStaticProps {
  return async context => {
    const result = await load(context)
    if (!('props' in result)) return result
    const props = await Promise.resolve(result.props)
    return { ...result, props: { ...props, pageSEO: getPageSEO(route, context.locale, props) } }
  }
}

export function withServerPageSEO(route: string, load: GetServerSideProps): GetServerSideProps {
  return async context => {
    const result = await load(context)
    if (!('props' in result)) return result
    const props = await result.props
    return { ...result, props: { ...props, pageSEO: getPageSEO(route, context.locale, props) } }
  }
}
