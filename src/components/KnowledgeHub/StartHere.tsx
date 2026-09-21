import { CSSProperties } from 'react'
import { Icon } from './Icon'
import { guideSteps } from './guide-data'
import { Breadcrumb, PreviewPage, RelatedHubs, useActiveSection } from './Shared'
import { SubjectCard, StepSection } from './Components'
import { useHeroScroll } from './useHeroScroll'
import styles from './pages-v2.module.scss'

export function StartHere() {
  const active = useActiveSection(guideSteps.map(step => step.id))
  const { heroFade, breadcrumbHeight, breadcrumbRef } = useHeroScroll()
  const fadeStyle = { '--heroFade': heroFade, '--breadcrumbHeight': `${breadcrumbHeight}px` } as CSSProperties

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
        <div className={styles.stepsRail} style={{ paddingTop: `${48 * (1 - heroFade)}px` }}>
          <div className={styles.stepsLabel}>
            <Icon name="steps-layers" size={24} /> Steps
          </div>
          <nav className={styles.stepNav} aria-label="Guide steps">
            {guideSteps.map((step, index) => (
              <SubjectCard
                key={step.id}
                title={step.title}
                step={index + 1}
                href={`#${step.id}`}
                selected={active === step.id}
              />
            ))}
          </nav>
        </div>
        <div className={styles.guideSteps}>
          {guideSteps.map((step, index) => (
            <StepSection key={step.id} step={step} index={index} />
          ))}
        </div>
        <RelatedHubs revision />
      </div>
    </PreviewPage>
  )
}
