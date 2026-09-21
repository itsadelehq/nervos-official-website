import clsx from 'clsx'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { guideSteps } from './guide-data'
import styles from './components.module.scss'

const numbers = ['One', 'Two', 'Three', 'Four', 'Five', 'Six']
const articleHref = (title: string) => `/kb/article?title=${encodeURIComponent(title)}`

export function ArrowButton({
  children,
  href,
  className,
  onClick,
}: {
  children: ReactNode
  href?: string
  className?: string
  onClick?: () => void
}) {
  const content = (
    <>
      {children}
      <span className={styles.arrowButtonIcon} aria-hidden="true">
        →
      </span>
    </>
  )
  const classes = clsx(styles.arrowButton, className)

  return href ? (
    <Link className={classes} href={href}>
      {content}
    </Link>
  ) : (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  )
}

export function SubjectCard({
  title,
  icon,
  step,
  selected,
  href,
  onClick,
}: {
  title: string
  icon?: string
  step?: number
  selected: boolean
  href?: string
  onClick?: () => void
}) {
  const content = (
    <>
      {step ? (
        <span className={styles.stepIndex}>{String(step).padStart(2, '0')}</span>
      ) : (
        icon && <Icon name={icon} size={40} />
      )}
      <span>{title}</span>
    </>
  )
  const className = clsx(styles.subject, selected && styles.selected)
  return href ? (
    <a href={href} className={className} aria-current={selected ? 'step' : undefined}>
      {content}
    </a>
  ) : (
    <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
      {content}
    </button>
  )
}

export function ReadingList({ titles, compact = false }: { titles: string[]; compact?: boolean }) {
  return (
    <ul className={clsx(styles.readingList, compact && styles.compactReading)}>
      {titles.map((title, index) => (
        <li key={`${title}-${index}`}>
          <Link href={articleHref(title)}>
            <span className={styles.readingTitle}>{title}</span>
            <span className={styles.readingAction}>
              <small>
                <Icon name="topics-imgLayer15" size={12} />
                {compact ? '5m' : '5 min read'}
              </small>
              <span className={styles.readingArrow} aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function HubCard({
  name,
  description,
  index,
  titles,
}: {
  name: string
  description: string
  index: number
  titles: string[]
}) {
  return (
    <article className={styles.hubCard}>
      <Icon name={`topics-imgNumber${numbers[index] ?? 'One'}Circle`} />
      <div className={styles.hubContent}>
        <h3>{name}</h3>
        <p>{description}</p>
        <ReadingList titles={titles} compact />
      </div>
      <Link className={styles.count} href={`/kb/topic?hub=${encodeURIComponent(name)}`}>
        14 Articles <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}

export function StepSection({ step, index }: { step: (typeof guideSteps)[number]; index: number }) {
  return (
    <section id={step.id} className={styles.stepSection}>
      <div className={styles.stepTop}>
        <div className={styles.stepLabel}>
          Step <Icon name={`topics-imgNumber${numbers[index] ?? 'One'}Circle`} size={25} />
        </div>
        <h2>{step.title}</h2>
        <p className={styles.callout}>
          <strong>{step.summary.slice(0, step.summary.indexOf(':') + 1)}</strong>
          {step.summary.slice(step.summary.indexOf(':') + 1)}
        </p>
        <p className={styles.stepBody}>{step.body}</p>
        {!!step.points.length && (
          <ul className={styles.points}>
            {step.points.map(point => (
              <li key={point}>
                <Icon name="startBody-imgArrowArrowCircleRight" size={24} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.deeper}>
        <h3>
          Go deeper <Icon name="startBody-imgArrowArrowSubRightDown" size={24} />
        </h3>
        <ReadingList titles={step.reading} />
      </div>
    </section>
  )
}

export function CardMeta({ author = false }: { author?: boolean }) {
  return (
    <div className={styles.meta}>
      <Icon name="articleBody-imgGroup58" size={18} />
      {author && (
        <>
          <span>Nervos</span>
          <span>·</span>
        </>
      )}
      <span>February 28, 2023</span>
      <span>·</span>
      <Icon name="topics-imgLayer15" size={12} />
      <span>5 min read</span>
    </div>
  )
}

export function ArticleCard({
  title,
  tag,
  size = 'medium',
  className,
  horizontal = false,
}: {
  title: string
  tag?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
  horizontal?: boolean
}) {
  if (horizontal)
    return (
      <Link href={articleHref(title)} className={styles.horizontalCard}>
        <div>
          <h3>{title}</h3>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua...
          </p>
          <div className={styles.tags}>
            {['Nervos', 'Blockchain', 'Crypto', 'PoW'].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <CardMeta author />
        </div>
        <div className={styles.horizontalCover} aria-label="Article cover placeholder" />
      </Link>
    )
  return (
    <Link href={articleHref(title)} className={clsx(styles.articleCard, styles[size], className)}>
      <div className={styles.cover}>
        <span>Cover image</span>
        {tag && <span className={styles.tag}>{tag}</span>}
      </div>
      <h3>{title}</h3>
      <CardMeta />
    </Link>
  )
}
