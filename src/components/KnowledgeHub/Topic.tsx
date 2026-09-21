import clsx from 'clsx'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Icon } from './Home'
import { hubs } from './fixtures'
import { Breadcrumb, PreviewPage, RelatedHubs } from './Shared'
import styles from './pages-v2.module.scss'
import { SubjectCard, ArticleCard } from './Components'
import { useHeroScroll } from './useHeroScroll'

const subjects = [
  {
    name: 'Scaling Fundamentals',
    icon: 'imgArrowExpand',
    description:
      'The core trade-offs. What throughput really means, why the scalability trilemma exists, and the difference between scaling at Layer 1 and scaling at Layer 2.',
  },
  {
    name: 'Rollups, Data Availability & Sidechains',
    icon: 'imgSystemData',
    description: 'Explore rollups, data availability and sidechains.',
  },
  {
    name: 'Payment Channels & Networks',
    icon: 'imgInterfaceCreditCard01',
    description: 'Explore payment channels and networks.',
  },
  { name: 'Bitcoin Scaling & RGB++', icon: 'img1421344023328', description: 'Explore Bitcoin scaling and RGB++.' },
  { name: 'View all', icon: 'imgGroup60', description: 'Browse all preview articles in this topic.' },
]
const titles = [
  'Layer 1 vs Layer 2',
  'The Ultimate Guide to Payment Channels',
  'The Ultimate Guide to RGB, RGB++ and Client-Side Validation',
]
const tags = ['Scaling', 'Rollups', 'Payment', 'RGB++']
const previewPosts = Array.from({ length: 17 }, (_, index) => ({
  id: index,
  title: titles[index % 3] ?? titles[0] ?? '',
  subject: index % 4,
  tag: index < 4 ? (tags[index] ?? 'Scaling') : 'Scaling',
  publishedAt: '2023-02-28',
}))

export function Topic() {
  const router = useRouter()
  const requestedHub = typeof router.query.hub === 'string' ? router.query.hub : ''
  const hub = hubs.find(item => item.name === requestedHub)
  const all = router.query.view === 'all'
  const heading = all ? 'All articles' : (hub?.name ?? 'Blockchain Scalability')
  const [subjectIndex, setSubjectIndex] = useState(0)
  const [density, setDensity] = useState(4)
  const { heroFade, breadcrumbHeight, breadcrumbRef } = useHeroScroll()
  const subject = subjects[subjectIndex] ?? {
    name: 'View all',
    icon: 'imgGroup60',
    description: 'Browse all preview articles.',
  }
  const posts = previewPosts
    .filter(post => subjectIndex === 0 || subjectIndex === 4 || post.subject === subjectIndex)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const selectSubject = (index: number) => {
    setSubjectIndex(index)
  }

  return (
    <PreviewPage title={heading} revision headerClassName={styles.scrollingHeader}>
      <div
        className={styles.container}
        style={{ '--heroFade': heroFade, '--breadcrumbHeight': `${breadcrumbHeight}px` } as CSSProperties}
      >
        <div className={styles.breadcrumbDock} ref={breadcrumbRef}>
          <Breadcrumb current={heading} revision />
        </div>
        <header className={styles.topicHero}>
          <h1>{heading}</h1>
          <p>
            {all
              ? 'Browse the static preview article collection. Article data, topics and search rules will be connected after content cleanup.'
              : hub && hub.name !== 'Blockchain Scalability'
                ? hub.description
                : 'Blockchain scalability is the study of how blockchain networks increase throughput, reduce costs, and support more complex applications. This hub covers Layer 1 and Layer 2 approaches, including rollups, payment channels, Lightning, RGB++, and Fiber, and how Nervos CKB scales without sacrificing security or decentralization.'}
          </p>
        </header>
        <div className={styles.topicRail} style={{ paddingTop: `${48 * (1 - heroFade)}px` }}>
          <h2 className={styles.subjectsLabel}>
            <Icon name="topicHero-imgInterfaceBookOpen" size={24} />
            Subjects
          </h2>
          <nav className={styles.subjectNav} aria-label="Subjects">
            {subjects.map((item, index) => (
              <SubjectCard
                key={item.name}
                title={item.name}
                icon={`topicControls-${item.icon}`}
                selected={subjectIndex === index}
                onClick={() => selectSubject(index)}
              />
            ))}
          </nav>
          <div className={styles.topicToolbar}>
            <div>
              <h2 id="subject-title">{subject.name === 'View all' ? 'All subjects' : subject.name}</h2>
              <p>{subject.description}</p>
            </div>
            <div className={styles.controls}>
              <button
                className={styles.gridReset}
                aria-label="Reset to four cards per row"
                onClick={() => {
                  setDensity(4)
                }}
              >
                <span className={styles.gridIcon} aria-hidden="true" />
              </button>
              <input
                aria-label="Cards per row"
                type="range"
                min="3"
                max="5"
                value={density}
                style={{ '--rangeProgress': `${((density - 3) / 2) * 100}%` } as CSSProperties}
                onChange={event => {
                  setDensity(Number(event.target.value))
                }}
              />
              <Menu as="div" className={styles.filterMenu}>
                <MenuButton className={styles.filterButton}>
                  <Icon name="topicBody-imgInterfaceSlider03" size={24} />
                  Filter
                </MenuButton>
                <MenuItems className={styles.filterOptions}>
                  <MenuItem>
                    <button className={styles.filterOption} type="button">
                      Latest to oldest <Icon name="interface-check" size={16} />
                      <span className={styles.srOnly}> (selected)</span>
                    </button>
                  </MenuItem>
                  <MenuItem disabled>
                    <button className={styles.filterOption} type="button" disabled>
                      Most popular
                    </button>
                  </MenuItem>
                  <MenuItem disabled>
                    <button className={styles.filterOption} type="button" disabled>
                      Must reads
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>
        <section className={styles.topicArticles} aria-labelledby="subject-title">
          <div className={clsx(styles.topicGrid, styles[`density${density}`])}>
            {posts.map(post => (
              <ArticleCard
                key={post.id}
                title={post.title}
                tag={subjectIndex === 4 ? post.tag : undefined}
                size={density === 5 ? 'small' : density === 3 ? 'large' : 'medium'}
              />
            ))}
          </div>
          {posts.length === 0 && (
            <p role="status" className={styles.empty}>
              No articles in this subject yet.
            </p>
          )}
          <p className={styles.srOnly} aria-live="polite">
            Showing {posts.length} articles, latest to oldest
          </p>
        </section>
        <RelatedHubs revision />
      </div>
    </PreviewPage>
  )
}
