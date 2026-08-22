import type { ReactNode } from 'react'
import styles from './dashboard.module.css'
import type { StructuredSummary } from '@/lib/sources'

interface SourceSummaryProps {
  sections: StructuredSummary
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3.5 13.8 9l5.7 1.2-4.4 3.8 1.2 5.7L12 16.8 7.7 19.7l1.2-5.7-4.4-3.8L10.2 9 12 3.5Z" />
    </svg>
  )
}

function IconNodes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
      <circle cx="6.5" cy="7" r="2.2" />
      <circle cx="17.5" cy="7" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="M8.4 8.4 10.6 15M15.6 8.4 13.4 15M8.7 7h6.6" />
    </svg>
  )
}

function IconFlask() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
      <path d="M9 3h6M10 3v6.2L5.8 18.5A2.4 2.4 0 0 0 8 22h8a2.4 2.4 0 0 0 2.2-3.5L14 9.2V3" />
      <path d="M8.2 14h7.6" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </svg>
  )
}

function SectionHead({
  index,
  title,
  icon,
}: {
  index: string
  title: string
  icon: ReactNode
}) {
  return (
    <div className={styles.capturePlate}>
      <span className={styles.capturePlateIcon}>{icon}</span>
      <div className={styles.capturePlateCopy}>
        <span className={styles.capturePlateNum}>{index}</span>
        <span className={styles.capturePlateTitle}>{title}</span>
      </div>
      <span className={styles.capturePlateLine} />
    </div>
  )
}

export default function SourceSummary({ sections }: SourceSummaryProps) {
  const hasExamples = sections.examples.length > 0
  const hasInterview = sections.interview_points.length > 0

  return (
    <div className={styles.captureBody}>
      <section className={styles.captureSection} style={{ animationDelay: '60ms' }}>
        <SectionHead index="01" title="TL;DR" icon={<IconSpark />} />
        <ol className={styles.capturePoints}>
          {sections.tldr.map((point, i) => (
            <li key={i} style={{ animationDelay: `${120 + i * 55}ms` }}>
              <span className={styles.capturePointNum}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.captureSection} style={{ animationDelay: '140ms' }}>
        <SectionHead index="02" title="Key concepts" icon={<IconNodes />} />
        <ul className={styles.captureConceptGrid}>
          {sections.key_concepts.map((concept, i) => (
            <li
              key={i}
              className={styles.captureConcept}
              style={{ animationDelay: `${180 + i * 40}ms` }}
            >
              <span className={styles.captureConceptDot} aria-hidden="true" />
              {concept}
            </li>
          ))}
        </ul>
      </section>

      {hasExamples || hasInterview ? (
        <div className={styles.captureSplit}>
          {hasExamples ? (
            <section className={styles.captureSection} style={{ animationDelay: '200ms' }}>
              <SectionHead index="03" title="Examples" icon={<IconFlask />} />
              <ul className={styles.captureExamples}>
                {sections.examples.map((example, i) => (
                  <li key={i} style={{ animationDelay: `${220 + i * 45}ms` }}>
                    <span className={styles.captureExampleMark} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                        <path d="M7 12h10M12 7v10" />
                      </svg>
                    </span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasInterview ? (
            <section className={styles.captureSection} style={{ animationDelay: '240ms' }}>
              <SectionHead index="04" title="Interview points" icon={<IconMic />} />
              <ul className={styles.captureInterview}>
                {sections.interview_points.map((point, i) => (
                  <li key={i} style={{ animationDelay: `${260 + i * 45}ms` }}>
                    <span className={styles.captureInterviewQ} aria-hidden="true">
                      Q
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
