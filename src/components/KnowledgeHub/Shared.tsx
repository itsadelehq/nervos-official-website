import clsx from 'clsx'
import { ReactNode, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Page } from '../Page'
import { Icon, Newsletter } from './Home'
import base from './index.module.scss'
import styles from './pages.module.scss'
import revisedBase from './home-v2.module.scss'
import revisedStyles from './pages-v2.module.scss'
import { KnowledgeFooter } from './KnowledgeFooter'
import articleStyles from './article-v2.module.scss'

export const articleHref = (title?: string) =>
  title ? `/kb/article?title=${encodeURIComponent(title)}` : '/kb/article'

export function PreviewPage({
  title,
  children,
  newsletter = true,
  revision = false,
}: {
  title: string
  children: ReactNode
  newsletter?: boolean
  revision?: boolean
}) {
  return (
    <>
      <Head>
        <title>{title} — Knowledge Base preview</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Page className={revision ? clsx(revisedBase.page, revisedStyles.page) : clsx(base.page, styles.page)}>
        {({ renderHeader, renderFooter }) => (
          <>
            {renderHeader({ variant: 'knowledgeHub' })}
            {children}
            {newsletter && <Newsletter />}
            {revision ? <KnowledgeFooter /> : renderFooter()}
          </>
        )}
      </Page>
    </>
  )
}

export function Breadcrumb({ current, revision = false }: { current: string; revision?: boolean }) {
  return (
    <nav className={revision ? revisedStyles.breadcrumb : styles.breadcrumb} aria-label="Breadcrumb">
      <Link href="/kb">Knowledge Base</Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{current}</span>
    </nav>
  )
}

export function ArticleMeta({ large = false }: { large?: boolean }) {
  return (
    <div className={clsx(styles.meta, large && styles.largeMeta)}>
      <Icon name="articleBody-imgGroup58" size={large ? 35 : 18} />
      <span>Nervos</span>
      <span>·</span>
      <span>{large ? 'March 9, 2023' : 'February 28, 2023'}</span>
      <span>·</span>
      <Icon name="articleBody-imgLayer15" size={12} />
      <span>5 min read</span>
    </div>
  )
}

export function RelatedHubs({ revision = false }: { revision?: boolean }) {
  const design = revision ? revisedStyles : styles
  return (
    <section className={design.relatedHubs} aria-label="Related hubs">
      <div className={design.label}>
        <Icon name="topicBody-imgInterfaceMainComponent" />
        Related hubs
      </div>
      <div className={design.pills}>
        {['Blockchain Architecture', 'Blockchain VMs & RISC-V', 'Nervos CKB'].map(name => (
          <Link className={design.pill} key={name} href={`/kb/topic?hub=${encodeURIComponent(name)}`}>
            {name}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function DiscoverBanner({ compact = false, revision = false }: { compact?: boolean; revision?: boolean }) {
  const design = revision ? articleStyles : styles
  return (
    <aside className={compact ? design.discoverCompact : design.discoverBanner}>
      <div>
        <h2>Meet the blockchain built for what comes next.</h2>
        <p>Explore the ideas, architecture, and ecosystem behind CKB.</p>
      </div>
      <Link href="/kb/start-here">Discover CKB</Link>
    </aside>
  )
}

export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '')
  const key = ids.join('|')
  useEffect(() => {
    const sectionIds = key.split('|')
    let frame = 0
    const update = () => {
      let current = sectionIds[0] ?? ''
      sectionIds.forEach(id => {
        const node = document.getElementById(id)
        if (node && node.getBoundingClientRect().top <= 150) current = id
      })
      setActive(current)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [key])
  return active
}
