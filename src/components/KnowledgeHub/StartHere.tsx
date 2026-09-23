import { CSSProperties, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { guideSteps } from './guide-data'
import { Breadcrumb, PreviewPage, RelatedHubs, useActiveSection } from './Shared'
import { SubjectCard, StepSection } from './Components'
import { useHeroScroll } from './useHeroScroll'
import styles from './pages-v2.module.scss'
import type { KBCatalog } from './content'
import { trackKBEvent } from './analytics'

// Initial editorial proposals; exact source IDs, never fuzzy title matches.
const readingIds = [
  ['nervos_overview_of_a_layered_blockchain', 'ckb_blockchain_developers_dream'],
  ['what_is_riscv', 'account_abstraction_where_we_are_going'],
  ['bitcoin_and_ckb_security_models', 'ultimate_guide_to_rgb_rgbpp_and_client_side_validation', 'what_is_fiber'],
  ['quantum_resistance', 'comparison_of_post_quantum_cryptographic_algorithms'],
  ['pi400_ckb_node_setup_guide', 'ckb_blockchain_developers_dream'],
]

export function StartHere({ catalog }: { catalog: KBCatalog }) {
  const active = useActiveSection(
    guideSteps.map(step => step.id),
    true,
  )
  const { heroFade, breadcrumbHeight, breadcrumbRef } = useHeroScroll()
  const railRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [railHeight, setRailHeight] = useState(152)
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (railRef.current) setRailHeight(railRef.current.getBoundingClientRect().height)
    })
    if (railRef.current) observer.observe(railRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const revealActive = () => {
      if (!window.matchMedia('(max-width: 750px)').matches) return
      const nav = navRef.current
      const selected = nav?.querySelector<HTMLElement>('[aria-current="step"]')
      if (!nav || !selected) return
      const bounds = nav.getBoundingClientRect()
      const item = selected.getBoundingClientRect()
      if (item.left < bounds.left || item.right > bounds.right)
        nav.scrollTo({ left: nav.scrollLeft + item.left - bounds.left - 10, behavior: 'auto' })
    }
    revealActive()
    window.addEventListener('resize', revealActive)
    return () => window.removeEventListener('resize', revealActive)
  }, [active])
  const fadeStyle = {
    '--heroFade': heroFade,
    '--breadcrumbHeight': `${breadcrumbHeight}px`,
    '--stepsRailHeight': `${railHeight}px`,
  } as CSSProperties

  return (
    <PreviewPage title="Start Here" revision headerClassName={styles.scrollingHeader}>
      <div className={styles.container} style={fadeStyle}>
        <div className={styles.breadcrumbDock} ref={breadcrumbRef}>
          <Breadcrumb current="Start here" revision />
        </div>
        <header className={styles.startHero}>
          <div className={styles.startHeroCopy}>
            <h1>Understand Nervos CKB in five steps.</h1>
            <strong>Inspired by Bitcoin’s foundations. Built for what comes next.</strong>
            <p>
              Nervos CKB explores what becomes possible when Bitcoin’s design principles meet open-ended
              programmability. Discover a blockchain built for people who want to push the technology further.
            </p>
          </div>
        </header>
        <div className={styles.stepsRail} ref={railRef} style={{ paddingTop: `${48 * (1 - heroFade)}px` }}>
          <div className={styles.stepsLabel}>
            <Icon name="steps-layers" size={24} /> Steps
          </div>
          <nav className={styles.stepNav} ref={navRef} aria-label="Guide steps">
            {guideSteps.map((step, index) => (
              <SubjectCard
                key={step.id}
                title={step.title}
                step={index + 1}
                href={`#${step.id}`}
                selected={active === step.id}
                onClick={() => trackKBEvent('kb_step_select', { step: index + 1 })}
              />
            ))}
          </nav>
        </div>
        <div className={styles.guideSteps}>
          {guideSteps.map((step, index) => (
            <StepSection
              key={step.id}
              step={step}
              index={index}
              articles={(readingIds[index] ?? []).flatMap(id => catalog.articles.filter(a => a.id === id))}
            />
          ))}
        </div>
        <RelatedHubs revision />
      </div>
    </PreviewPage>
  )
}
