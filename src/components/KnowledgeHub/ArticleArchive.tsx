import clsx from 'clsx'
import { useState } from 'react'
import Pagination from '../Pagination'
import { ArticleCard } from './Components'
import { ArticleGridControls } from './ArticleGridControls'
import { ArticleSearch } from './ArticleSearch'
import { Breadcrumb, PreviewPage } from './Shared'
import type { LibraryProps } from './Library'
import styles from './pages-v2.module.scss'
import { trackKBEvent } from './analytics'

export function ArticleArchive({ catalog, page, total }: Pick<LibraryProps, 'catalog' | 'page' | 'total'>) {
  const [density, setDensity] = useState(4)
  // Catalogs contain only real translations. Empty untranslated locale pages
  // refer to English; pagination keeps its own canonical, without tracking keys.
  const language = catalog.articles[0]?.language ?? 'en'
  const chinese = language === 'zh'
  const heading = chinese ? '全部文章' : 'All Articles'
  const subtitle = chinese ? '探索知识库中的各类文章。' : 'Explore articles from across the Knowledge Base.'
  const localePrefix = language === 'en' ? '' : `/${language}`
  const canonicalPath = `${localePrefix}/knowledge-base/articles${page > 1 ? `?page=${page}` : ''}`

  return (
    <PreviewPage
      title={
        chinese
          ? page > 1
            ? `全部文章 — 第 ${page} 页`
            : '全部文章'
          : page > 1
            ? `All articles — Page ${page}`
            : 'All articles'
      }
      description={`${subtitle}${chinese ? `第 ${page} 页。` : ` Page ${page}.`}`}
      canonicalPath={canonicalPath}
      revision
      headerClassName={styles.scrollingHeader}
    >
      <div className={clsx(styles.container, styles.archivePage)}>
        <div className={styles.breadcrumbDock}>
          <Breadcrumb current={chinese ? '全部文章' : 'All articles'} language={language} revision />
        </div>
        <header className={styles.topicHero}>
          <h1 id="all-articles-title">{heading}</h1>
          <p>{subtitle}</p>
        </header>
        <div className={styles.archiveRail}>
          <div className={styles.topicToolbar}>
            <div className={styles.archiveSearch}>
              <ArticleSearch language={language} />
            </div>
            <ArticleGridControls
              density={density}
              onDensityChange={setDensity}
              placement="archive"
              pageType="all_articles"
              language={language}
            />
          </div>
        </div>
        <section className={styles.topicArticles} aria-labelledby="all-articles-title">
          <div className={clsx(styles.topicGrid, styles[`density${density}`])}>
            {catalog.articles.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                title={article.title}
                analyticsContext={{ placement: 'archive_articles', position: index + 1 }}
                size={density === 5 ? 'small' : density === 3 ? 'large' : 'medium'}
              />
            ))}
          </div>
          {!catalog.articles.length && (
            <p role="status" className={styles.empty}>
              {chinese ? '暂无此语言的文章。' : 'No articles available in this language.'}
            </p>
          )}
          <p className={styles.srOnly} aria-live="polite">
            {chinese
              ? `共 ${total} 篇文章，当前显示 ${catalog.articles.length} 篇，按时间从新到旧排列`
              : `Showing ${catalog.articles.length} of ${total} articles, latest to oldest`}
          </p>
        </section>
        <Pagination
          pageCount={Math.ceil(total / 24)}
          currentPage={page}
          language={language}
          className={styles.numberedPagination}
          hrefForPage={destination => `/knowledge-base/articles?page=${destination}`}
          onPageChange={destination =>
            trackKBEvent('kb_pagination_click', {
              placement: 'archive',
              page: destination,
              page_type: 'all_articles',
              direction: destination < page ? 'previous' : 'next',
            })
          }
        />
      </div>
    </PreviewPage>
  )
}
