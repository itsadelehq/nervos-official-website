import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Page } from '../Page'
import { hubs, previewArticleTitles } from './fixtures'
import styles from './home-v2.module.scss'
import { Icon } from './Icon'
import { ArrowButton, HubCard } from './Components'
import { KnowledgeFooter } from './KnowledgeFooter'
import { GuideLife } from './GuideLife'
import { NeuronIcon } from './NeuronIcon'

export { Icon } from './Icon'

function SearchCloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Eyebrow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className={styles.eyebrow}>
      <Icon name={icon} />
      {children}
    </div>
  )
}

export function KnowledgeHubHome() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const matches = previewArticleTitles.filter(title => title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <Head>
        <title>Knowledge Base Hub — Design preview</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Page className={styles.page}>
        {({ renderHeader }) => (
          <>
            {renderHeader({ variant: 'knowledgeHub' })}
            <section className={styles.hero} aria-labelledby="kb-title">
              <div className={styles.heading}>
                <span className={styles.brain}>
                  <NeuronIcon />
                </span>
                <h1 id="kb-title">Knowledge Base Hub</h1>
              </div>
              <p className={styles.intro}>
                Build your understanding of blockchain technology. Find answers to specific questions, explore a new
                topic, or work your way from the fundamentals to advanced concepts.
              </p>
              <div className={styles.guideBanner}>
                <GuideLife className={styles.guideLife} />
                <div className={styles.guideContent}>
                  <Eyebrow icon="hero-imgQlementineIconsGamepadStart16">Start here</Eyebrow>
                  <h2>
                    What is Nervos?
                    <br />A complete guide for beginners.
                  </h2>
                  <p>
                    This guide is the be-all and end-all resource for the underlying architecture and value proposition
                    of the Nervos Network. Start here, then go as deep as you like.
                  </p>
                  <button className={styles.guideButton} onClick={() => void router.push('/kb/start-here')}>
                    Take the guide <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </section>
            <section className={styles.topics} aria-labelledby="topics-title">
              <div className={styles.container}>
                <Eyebrow icon="topics-imgGroup59">Explore by topic</Eyebrow>
                <h2 id="topics-title">Find your starting point</h2>
                <p className={styles.topicIntro}>
                  New to blockchain or exploring a specific question? Browse articles by topic and build your
                  understanding at your own pace.
                </p>
                <div className={styles.hubGrid}>
                  {hubs.map((hub, index) => (
                    <HubCard key={hub.name} {...hub} index={index} titles={previewArticleTitles} />
                  ))}
                </div>
              </div>
            </section>
            <section className={styles.popular} aria-labelledby="popular-title">
              <div className={styles.container}>
                <div className={styles.popularHeader}>
                  <div>
                    <Eyebrow icon="popular-imgIconamoonStarThin">Reader favourites</Eyebrow>
                    <h2 id="popular-title">Most read this year</h2>
                  </div>
                  <div className={styles.searchActions}>
                    <div className={styles.searchWrap}>
                      <form
                        role="search"
                        onSubmit={event => {
                          event.preventDefault()
                          setShowSearch(true)
                        }}
                      >
                        <input
                          type="search"
                          aria-label="Search preview articles"
                          placeholder="Search all articles"
                          value={query}
                          onChange={event => {
                            setQuery(event.target.value)
                            setShowSearch(true)
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Escape') setShowSearch(false)
                          }}
                        />
                        {query && (
                          <button
                            type="button"
                            className={styles.clearSearch}
                            aria-label="Clear search"
                            onClick={() => {
                              setQuery('')
                              setShowSearch(false)
                            }}
                          >
                            <SearchCloseIcon />
                          </button>
                        )}
                        <button aria-label="Search">
                          <Icon name="popular-img9026843MagnifyingGlassThinIcon1" />
                        </button>
                      </form>
                      {showSearch && (
                        <div className={styles.searchResults}>
                          <div className={styles.searchCaption}>
                            Preview titles only{' '}
                            <button onClick={() => setShowSearch(false)} aria-label="Close search results">
                              <SearchCloseIcon />
                            </button>
                          </div>
                          {matches.length ? (
                            matches.map(title => (
                              <button
                                key={title}
                                onClick={() => void router.push(`/kb/article?title=${encodeURIComponent(title)}`)}
                              >
                                {title}
                              </button>
                            ))
                          ) : (
                            <p role="status">No matching preview articles.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowButton className={styles.allArticles} href="/kb/topic?view=all">
                      See all articles
                    </ArrowButton>
                  </div>
                </div>
                <div className={styles.popularGrid}>
                  {[0, 1, 2, 3].map(index => (
                    <button className={styles.popularCard} key={index} onClick={() => void router.push('/kb/article')}>
                      <div className={styles.coverPlaceholder} aria-label="Article cover placeholder">
                        <span>Cover image</span>
                      </div>
                      <h3>
                        What is Nervos?
                        <br />A complete guide for newbies.
                      </h3>
                      <div className={styles.articleMeta}>
                        <Icon name="popular-imgGroup58" size={18} />
                        <span>February 28, 2023 ·</span>
                        <Icon name="popular-imgLayer15" size={12} />
                        <span>5 min read</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <Newsletter />
            <KnowledgeFooter />
          </>
        )}
      </Page>
    </>
  )
}

export function PreviewNotice({ notice, onClose }: { notice: string; onClose: () => void }) {
  return (
    <Dialog open={Boolean(notice)} onClose={() => onClose()} className={styles.dialog}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.dialogPosition}>
        <DialogPanel className={styles.dialogPanel}>
          <DialogTitle>Static design preview</DialogTitle>
          <p>{notice}</p>
          <button onClick={() => onClose()}>Got it</button>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export function Newsletter() {
  const [notice, setNotice] = useState('')
  const explainPreview = (feature: string) => setNotice(`${feature} is not connected in this static preview.`)
  return (
    <>
      <section className={styles.newsletter} aria-labelledby="newsletter-title">
        <div className={styles.newsletterInner}>
          <div className={styles.newsletterCopy}>
            <Eyebrow icon="newsletter-imgArcticonsNewsreader">Stay ahead of the curve</Eyebrow>
            <h2 id="newsletter-title">The Blockchain Signal</h2>
            <p>
              A monthly briefing on the most significant developments shaping blockchain technology. Tech-focused and
              grounded in evidence. No hype. No price talk.
            </p>
            <form
              onSubmit={event => {
                event.preventDefault()
                setNotice(
                  'This is a design preview. Your email has not been sent or stored, and no subscription has been created.',
                )
              }}
            >
              <input
                aria-label="Email address"
                type="email"
                required
                placeholder="you@email.com"
                autoComplete="email"
              />
              <button>
                Get the briefing <span aria-hidden="true">→</span>
              </button>
            </form>
            <small>Monthly. Unsubscribe anytime.</small>
          </div>
          <div className={styles.resourceGrid}>
            <a className={styles.resourceCard} href="https://docs.nervos.org/">
              <Icon name="newsletter-imgLayer1" size={60} />
              <div>
                <h3>Build on CKB</h3>
                <p>
                  Developer Docs &amp;
                  <br />
                  Quick Start →
                </p>
              </div>
            </a>
            <a className={styles.resourceCard} href="https://talk.nervos.org/">
              <Icon name="newsletter-imgLayer1" size={60} />
              <div>
                <h3>
                  Join the CKB
                  <br />
                  Community
                </h3>
                <p>
                  Join the Discussion on
                  <br />
                  NervosTalk →
                </p>
              </div>
            </a>
            <button className={styles.resourceCard} onClick={() => explainPreview('CKBA membership')}>
              <Icon name="newsletter-imgLayer1" size={60} />
              <div>
                <h3>
                  Become a CKBA
                  <br />
                  Member
                </h3>
                <p>Explore Membership →</p>
              </div>
            </button>
          </div>
        </div>
      </section>
      <PreviewNotice notice={notice} onClose={() => setNotice('')} />
    </>
  )
}
