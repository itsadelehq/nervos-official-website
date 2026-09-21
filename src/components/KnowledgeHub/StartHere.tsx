import { Icon } from './Icon'
import { guideSteps } from './guide-data'
import { Breadcrumb, PreviewPage, RelatedHubs, useActiveSection } from './Shared'
import { SubjectCard, StepSection } from './Components'
import styles from './pages-v2.module.scss'

export function StartHere() {
  const active = useActiveSection(guideSteps.map(step => step.id))
  return (
    <PreviewPage title="Start Here" revision>
      <div className={styles.container}>
        <header className={styles.startHero}>
          <Breadcrumb current="Start here" revision />
          <h1>Understand Nervos CKB in five steps.</h1>
          <strong>Inspired by Bitcoin’s foundations. Built for what comes next.</strong>
          <p>
            Nervos CKB explores what becomes possible when Bitcoin’s design principles meet open-ended programmability.
            Discover a blockchain built for people who want to push the technology further.
          </p>
        </header>
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
