import clsx from 'clsx'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { Icon } from './Home'
import { hubs } from './fixtures'
import { Breadcrumb, PreviewPage, RelatedHubs } from './Shared'
import styles from './pages-v2.module.scss'
import { SubjectCard, ArticleCard } from './Components'

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
}))

export function Topic() {
  const router = useRouter()
  const requestedHub = typeof router.query.hub === 'string' ? router.query.hub : ''
  const hub = hubs.find(item => item.name === requestedHub)
  const all = router.query.view === 'all'
  const heading = all ? 'All articles' : (hub?.name ?? 'Blockchain Scalability')
  const [subjectIndex, setSubjectIndex] = useState(0)
  const [density, setDensity] = useState(4)
  const [mixed, setMixed] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('design')
  const subject = subjects[subjectIndex] ?? {
    name: 'View all',
    icon: 'imgGroup60',
    description: 'Browse all preview articles.',
  }
  const filtered = previewPosts.filter(
    post =>
      (subjectIndex === 0 || subjectIndex === 4 || post.subject === subjectIndex) &&
      post.title.toLowerCase().includes(search.toLowerCase()),
  )
  const sorted = sort === 'title' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
  const posts = sorted
  const selectSubject = (index: number) => {
    setSubjectIndex(index)
  }

  return (
    <PreviewPage title={heading} revision>
      <div className={styles.container}>
        <header className={styles.topicHero}>
          <Breadcrumb current={heading} revision />
          <h1>{heading}</h1>
          <p>
            {all
              ? 'Browse the static preview article collection. Article data, topics and search rules will be connected after content cleanup.'
              : hub && hub.name !== 'Blockchain Scalability'
                ? hub.description
                : 'Blockchain scalability is the study of how blockchain networks increase throughput, reduce costs, and support more complex applications. This hub covers Layer 1 and Layer 2 approaches, including rollups, payment channels, Lightning, RGB++, and Fiber, and how Nervos CKB scales without sacrificing security or decentralization.'}
          </p>
        </header>
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
        <section className={styles.topicArticles} aria-labelledby="subject-title">
          <div className={styles.topicToolbar}>
            <div>
              <h2 id="subject-title">{subject.name === 'View all' ? 'All subjects' : subject.name}</h2>
              <p>{subject.description}</p>
            </div>
            <div className={styles.controls}>
              <button
                className={styles.gridReset}
                aria-label="Restore Figma mixed card layout"
                onClick={() => {
                  setMixed(true)
                  setDensity(4)
                }}
              >
                <Icon name="topicBody-imgEpMenu" size={21} />
              </button>
              <input
                aria-label="Cards per row"
                type="range"
                min="3"
                max="5"
                value={density}
                onChange={event => {
                  setDensity(Number(event.target.value))
                  setMixed(false)
                }}
              />
              <button
                className={styles.filterButton}
                aria-expanded={filterOpen}
                aria-controls="article-filters"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Icon name="topicBody-imgInterfaceSlider03" size={24} />
                Filter
              </button>
            </div>
          </div>
          {filterOpen && (
            <div id="article-filters" className={styles.filterPanel}>
              <label>
                Search preview titles
                <input
                  type="search"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value)
                  }}
                />
              </label>
              <label>
                Sort by
                <select value={sort} onChange={event => setSort(event.target.value)}>
                  <option value="design">Design order</option>
                  <option value="title">Title A–Z</option>
                </select>
              </label>
              <button
                onClick={() => {
                  setSearch('')
                  setSort('design')
                  selectSubject(0)
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          <div className={clsx(styles.topicGrid, mixed ? styles.mixedGrid : styles[`density${density}`])}>
            {posts.map((post, index) => (
              <ArticleCard
                key={post.id}
                title={post.title}
                tag={post.tag}
                size={
                  mixed
                    ? index < 4
                      ? 'medium'
                      : index < 14
                        ? 'small'
                        : 'large'
                    : density === 5
                      ? 'small'
                      : density === 3
                        ? 'large'
                        : 'medium'
                }
                className={
                  mixed ? (index < 4 ? styles.mediumCard : index < 14 ? styles.smallCard : styles.bigCard) : undefined
                }
              />
            ))}
          </div>
          {posts.length === 0 && (
            <p role="status" className={styles.empty}>
              No matching preview articles. Try another subject or clear your search.
            </p>
          )}
          <p className={styles.srOnly} aria-live="polite">
            Showing {posts.length} of {sorted.length} preview articles
          </p>
        </section>
        <RelatedHubs revision />
      </div>
    </PreviewPage>
  )
}
