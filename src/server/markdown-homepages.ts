import home from '../../public/locales/en/home.json'
import { featuredArticles, type KBArticle } from '../components/KnowledgeHub/content'
import { hubs } from '../components/KnowledgeHub/fixtures'
import { kbHubPath } from '../utils/kb-hubs'
import { PRODUCTION_SITE_ORIGIN } from '../utils/sharing-urls'
import { getKBCatalog } from './kb-content'
import { getKBMostRead } from './kb-most-read'

export type MarkdownHomepage = 'home' | 'knowledge-base'

// Text remains the existing page copy. Remove visual line-break hints and
// escape inline Markdown so editorial titles cannot introduce extra blocks.
function text(value: string): string {
  return value
    .replace(/&shy;|\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_{}\[\]<>#|]/g, '\\$&')
}

function link(label: string, href: string): string {
  const url = new URL(href, PRODUCTION_SITE_ORIGIN)
  if (url.protocol !== 'https:') throw new Error('Homepage resources must use HTTPS')
  const destination = url.href.replace(/\(/g, '%28').replace(/\)/g, '%29')
  return `[${text(label)}](${destination})`
}

function articleItem(article: KBArticle): string {
  return `- ${link(article.title, article.canonicalPath)} (${article.readingMinutes} min read)`
}

function mainHomepage(): string {
  const intro = home.slide_ckb_intro
  const started = home.get_started
  const cards = [
    { copy: started.axon, href: 'https://axonweb3.io/' },
    { copy: started.developers, href: '/developers' },
    // Preserve the existing page's self-link instead of inventing a destination.
    { copy: started.learn_more, href: '/' },
  ]
  return [
    `# ${text(intro.text1)}`,
    text(intro.text2),
    link(intro.nervos_ckb_docs, 'https://docs.nervos.org/'),
    `## ${text(intro.l2_text1)}`,
    text(intro.l2_text2),
    link(intro.nervos_eco_fund, 'https://ckbeco.fund/'),
    `## ${text(home.slide_ckb_security.text1)}`,
    text(home.slide_ckb_security.text2),
    `## ${text(home.slide_ckb_flexibility.slogan)}`,
    text(home.slide_ckb_flexibility.description),
    `## ${text(home.slide_ckb_subtainability.slogan)}`,
    text(home.slide_ckb_subtainability.description),
    `## ${text(home.slide_ckb_modular.slogan)}`,
    text(home.slide_ckb_modular.description),
    `## ${text(started.title)}`,
    ...cards.flatMap(({ copy, href }) => [`### ${text(copy.title)}`, text(copy.description), link(copy.name, href)]),
  ].join('\n\n')
}

function knowledgeHomepage(): string {
  // Keep the full published catalog until both featured lists and popularity
  // have been selected, just as the HTML page loader does.
  const catalog = getKBCatalog('en')
  const mostRead = getKBMostRead(catalog)
  const hasReadRanking = mostRead.articles.length > 0
  const recommendations = hasReadRanking
    ? mostRead.articles
    : [
        ...new Map(
          catalog.hubs.flatMap(hub => featuredArticles(catalog, hub.id).slice(0, 1)).map(a => [a.id, a]),
        ).values(),
      ].slice(0, 4)

  // These are the existing KnowledgeHubHome / Newsletter labels. No form,
  // animation, loading state or article body is part of this representation.
  return [
    '# Knowledge Base',
    'Your guide to blockchain technology. Clear and comprehensive explanations of everything from the fundamentals to advanced concepts.',
    '## New to Nervos? Start here.',
    'Everything you need to understand Nervos, how it works, and what makes it different.',
    link('Explore the guide', '/knowledge-base/start-here'),
    '## What do you want to learn?',
    'From blockchain fundamentals to advanced concepts, explore the topics that interest you.',
    ...catalog.hubs.flatMap((hub, index) => {
      const destination = kbHubPath(hub.id)
      const count = catalog.articles.filter(article => article.hub === hub.id).length
      return [
        `### ${destination ? link(hub.name, destination) : text(hub.name)}`,
        text(hubs[index]?.description ?? ''),
        featuredArticles(catalog, hub.id).map(articleItem).join('\n'),
        ...(destination ? [link(`${count} Articles`, destination)] : []),
      ]
    }),
    `## ${hasReadRanking ? "What everyone's reading" : 'Recommended reading'}`,
    recommendations.map(articleItem).join('\n'),
    link('See all articles', '/knowledge-base/articles'),
    '## The Blockchain Signal',
    'A monthly briefing on the most significant developments shaping blockchain technology. Tech-focused and grounded in evidence. No hype. No price talk.',
    'Monthly. Unsubscribe anytime.',
    `### ${link('Build on CKB', 'https://docs.nervos.org/')}`,
    'Developer Docs & Quick Start',
    `### ${link('Join the CKB Community', 'https://talk.nervos.org/')}`,
    'Join the Discussion on NervosTalk',
    `### ${link('Become a CKBA Member', 'https://ckba.build/')}`,
    'Explore Membership',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function renderMarkdownHomepage(page: MarkdownHomepage): string {
  return `${page === 'home' ? mainHomepage() : knowledgeHomepage()}\n`
}
