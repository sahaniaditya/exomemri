'use client'

import { useState, type ReactNode } from 'react'
import styles from './dashboard.module.css'
import {
  captureSectionPlate,
  splitSummaryParagraphs,
  topicCardsFromSummary,
  type StructuredSummary,
  type TopicDescription,
} from '@/lib/sources'

interface SourceSummaryProps {
  summary?: string | null
  sections: StructuredSummary
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
      <path d="M7 4.5h7.2L18 8.3V19.5H7z" />
      <path d="M14.2 4.5V8.3H18M9 12h6M9 15.2h4.5" />
    </svg>
  )
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

function TopicCards({ topics }: { topics: TopicDescription[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={styles.notesPages}>
      {topics.map((topic, i) => {
        const topicId = `topic-${i}`
        const open = openIds.has(topicId)
        const bodyId = `topic-body-${i}`
        const subtopics = topic.subtopics ?? []
        return (
          <div
            key={`${topic.name}-${i}`}
            className={`${styles.folderGroup}${open ? '' : ` ${styles.captureTopicClosed}`}`}
          >
            <div className={styles.folderHead}>
              <button
                type="button"
                className={styles.folderToggle}
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => toggle(topicId)}
              >
                <span className={styles.folderChevron} aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
                <span className={styles.folderTitle}>{topic.name}</span>
              </button>
            </div>
            {open ? (
              <div id={bodyId} className={styles.captureTopicBody}>
                {splitSummaryParagraphs(topic.description).map((paragraph, j) => (
                  <p key={j} className={styles.captureTopicDescription}>
                    {paragraph}
                  </p>
                ))}
                {subtopics.length > 0 ? (
                  <div className={styles.captureSubtopics}>
                    {subtopics.map((sub, s) => {
                      const subId = `${topicId}-sub-${s}`
                      const subOpen = openIds.has(subId)
                      const subBodyId = `topic-${i}-sub-body-${s}`
                      return (
                        <div
                          key={`${sub.name}-${s}`}
                          className={`${styles.folderGroup}${subOpen ? '' : ` ${styles.captureTopicClosed}`}`}
                        >
                          <div className={styles.folderHead}>
                            <button
                              type="button"
                              className={styles.folderToggle}
                              aria-expanded={subOpen}
                              aria-controls={subBodyId}
                              onClick={() => toggle(subId)}
                            >
                              <span className={styles.folderChevron} aria-hidden="true">
                                {subOpen ? '▾' : '▸'}
                              </span>
                              <span className={styles.folderTitle}>{sub.name}</span>
                            </button>
                          </div>
                          {subOpen ? (
                            <div id={subBodyId} className={styles.captureTopicBody}>
                              {splitSummaryParagraphs(sub.description).map((paragraph, j) => (
                                <p key={j} className={styles.captureTopicDescription}>
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default function SourceSummary({ summary, sections }: SourceSummaryProps) {
  const hasExamples = sections.examples.length > 0
  const topics = topicCardsFromSummary(sections, summary)
  const plate = (n: number) => captureSectionPlate(n, summary, sections)

  return (
    <div className={styles.captureBody}>
      {topics.length > 0 ? (
        <section className={styles.captureSection} style={{ animationDelay: '20ms' }}>
          <SectionHead index="01" title="Summary" icon={<IconDoc />} />
          <TopicCards topics={topics} />
        </section>
      ) : null}

      <section className={styles.captureSection} style={{ animationDelay: '60ms' }}>
        <SectionHead index={plate(1)} title="TL;DR" icon={<IconSpark />} />
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
        <SectionHead index={plate(2)} title="Key concepts" icon={<IconNodes />} />
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

      {hasExamples ? (
        <section className={styles.captureSection} style={{ animationDelay: '200ms' }}>
          <SectionHead index={plate(3)} title="Examples" icon={<IconFlask />} />
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
    </div>
  )
}
