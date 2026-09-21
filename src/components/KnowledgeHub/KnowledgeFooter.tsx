import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Logo from '../Footer/logo.svg'
import styles from './footer-v2.module.scss'

const groups = [
  {
    title: 'Discover',
    links: [
      ['CKB', '/ckbpage'],
      ['Mining', '/mining'],
      ['Wallets', '/wallets'],
      ['Wiki', 'https://www.wikiwand.com/en/Nervos_Network'],
      ['Press Kit', '/media-kit'],
    ],
  },
  {
    title: 'Developers',
    links: [
      ['Documentation', 'https://docs.nervos.org/'],
      ['Github', 'https://github.com/nervosnetwork/'],
      ['Explorer', 'https://explorer.nervos.org/'],
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      ['Nervos Foundation', '/foundation'],
      ['Cryptape', 'https://cryptape.com/'],
      ['Godwoken', ''],
      ['Nervina Labs', ''],
      ['Tunnel Vision Labs', 'https://tunnelvisionlabs.xyz/'],
    ],
  },
  {
    title: 'Community',
    links: [
      ['Community Fund DAO', 'https://dao.ckb.community/'],
      ['Nervos Talk Forum', 'https://talk.nervos.org/'],
      ['RFCs', 'https://github.com/nervosnetwork/rfcs/'],
    ],
  },
  {
    title: 'Learn',
    links: [
      ['Knowledge Base', '/kb'],
      ['Blog', ''],
      ['Medium', 'https://medium.com/nervosnetwork'],
      ['Youtube', 'https://www.youtube.com/c/NervosNetwork'],
    ],
  },
]
const socials = [
  { label: 'Twitter', href: 'https://x.com/NervosNetwork', icon: 'twitter', height: 16.168 },
  { label: 'Discord', href: 'https://discord.gg/FKh8Zzvwqa', icon: 'discord', height: 14.4 },
  { label: 'Telegram', href: 'https://t.me/NervosNetwork', icon: 'telegram', height: 16.49 },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/nervos', icon: 'linkedin', height: 19.116 },
  { label: 'Reddit', href: 'https://www.reddit.com/r/NervosNetwork/', icon: 'reddit', height: 20 },
  { label: 'Youtube', href: 'https://www.youtube.com/c/NervosNetwork', icon: 'youtube', height: 20 },
  { label: 'Nervos Talk', href: 'https://talk.nervos.org/', icon: 'talk', height: 18 },
]

// Match the design markers explicitly; some preview destinations are still internal or pending.
const unmarkedLinks = new Set(['CKB', 'Mining', 'Wallets', 'Knowledge Base'])

function FooterArrow({ kind = 'external' }: { kind?: 'external' | 'chevron' | 'heading-external' }) {
  return (
    <Image
      className={styles.linkArrow}
      src={`/images/knowledge-hub/footer-${kind}.svg`}
      alt=""
      width={kind === 'chevron' ? 4.036 : kind === 'external' ? 5.7 : 6.7}
      height={kind === 'chevron' ? 7 : kind === 'external' ? 5.7 : 6.7}
      unoptimized
    />
  )
}

export function KnowledgeFooter() {
  const [status, setStatus] = useState('')
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <nav className={styles.groups} aria-label="Footer navigation">
          {groups.map(group => (
            <div key={group.title}>
              <h2>
                {group.title}
                {group.title !== 'Discover' && (
                  <FooterArrow kind={group.title === 'Ecosystem' ? 'heading-external' : 'chevron'} />
                )}
              </h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    {href ? (
                      <Link href={href}>
                        {label}
                        {!unmarkedLinks.has(label ?? '') && <FooterArrow />}
                      </Link>
                    ) : (
                      <button onClick={() => setStatus(`${label ?? 'This link'} is awaiting its final destination.`)}>
                        {label}
                        {!unmarkedLinks.has(label ?? '') && <FooterArrow />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.subscribe}>
          <h2>Be a part of the journey.</h2>
          <p>
            The Nervos Network is an ambitious project with a strong mission that is always moving forward. Signing up
            to our monthly newsletter will give you all the updates you need.
          </p>
          <form
            onSubmit={event => {
              event.preventDefault()
              setStatus('Static preview only. Your email was not sent or stored.')
            }}
          >
            <input type="email" required aria-label="Footer email address" placeholder="Your Email" />
            <button aria-label="Preview newsletter subscription">
              <Image src="/images/knowledge-hub/footer-submit.svg" width={20} height={14.286} alt="" unoptimized />
            </button>
          </form>
          <div className={styles.socials}>
            {socials.map(({ label, href, icon, height }) => (
              <a key={label} href={href} aria-label={label}>
                <Image
                  src={`/images/knowledge-hub/footer-${icon}.svg`}
                  width={icon === 'talk' ? 18 : 20}
                  height={height}
                  alt=""
                  unoptimized
                />
              </a>
            ))}
          </div>
          <span className={styles.socialRule} aria-hidden="true" />
          {status && (
            <p role="status" className={styles.status}>
              {status}
            </p>
          )}
        </div>
      </div>
      <div className={styles.bottom}>
        <Logo />
        <p>
          ©Nervos is an open-source project funded by the Nervos Foundation.
          <br />
          All Rights Reserved.
        </p>
      </div>
    </footer>
  )
}
