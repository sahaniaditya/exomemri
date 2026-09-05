import { apiFetch } from '@/lib/api'

export interface SubtopicDescription {
  name: string
  description: string
}

export interface TopicDescription {
  name: string
  description: string
  subtopics?: SubtopicDescription[]
}

export interface StructuredSummary {
  topics?: TopicDescription[]
  tldr: string[]
  key_concepts: string[]
  examples: string[]
}

export interface SummaryResponse {
  summary: string | null
  sections: StructuredSummary | null
  generated: boolean
  model: string | null
  summarized_at: string | null
}

const ATX_HEADING = /^(#{1,6})\s+(.+)$/
const EM_DASH_SEP = ' — '

export function splitSummaryParagraphs(summary: string | null | undefined): string[] {
  const prose = summary?.trim() ?? ''
  if (!prose) return []
  return prose.split(/\n\n+/).filter(Boolean)
}

function stripHeadingMarks(name: string): string {
  return name.replace(/^#{1,6}\s+/, '').trim()
}

function cardsFromMarkdownHeadings(prose: string): TopicDescription[] {
  const cards: TopicDescription[] = []
  let currentName: string | null = null
  const body: string[] = []

  const flush = () => {
    if (currentName == null) return
    const description = body.join('\n').trim()
    if (description) cards.push({ name: currentName, description })
    body.length = 0
  }

  for (const line of prose.split('\n')) {
    const match = line.match(ATX_HEADING)
    if (match) {
      flush()
      currentName = match[2].trim()
      continue
    }
    if (currentName != null) body.push(line)
  }
  flush()
  return cards
}

function cardsFromEmDashBlocks(prose: string): TopicDescription[] {
  const blocks = splitSummaryParagraphs(prose)
  if (blocks.length === 0) return []
  const cards: TopicDescription[] = []
  for (const block of blocks) {
    const idx = block.indexOf(EM_DASH_SEP)
    if (idx < 2) return []
    const name = stripHeadingMarks(block.slice(0, idx))
    const description = block.slice(idx + EM_DASH_SEP.length).trim()
    if (!name || !description) return []
    cards.push({ name, description })
  }
  return cards
}

function cardsFromNumberedList(prose: string): TopicDescription[] {
  const heading = /^(?:#{1,6}\s*)?(\d{1,2})\.\s+(.{2,160})\s*$/
  const sequences: TopicDescription[][] = []
  let current: TopicDescription[] = []
  let expected = 1
  const body: string[] = []

  const flushBody = () => {
    if (current.length === 0) return
    const description = body.join('\n').trim()
    if (description) current[current.length - 1] = {
      ...current[current.length - 1],
      description,
    }
    body.length = 0
  }

  const startSequence = () => {
    flushBody()
    if (current.length > 0) sequences.push(current)
    current = []
    expected = 1
  }

  for (const raw of prose.split('\n')) {
    const line = raw.trim()
    const match = line.match(heading)
    if (match) {
      const number = Number(match[1])
      const name = stripHeadingMarks(match[2])
      if (number !== expected) {
        startSequence()
        if (number !== 1) {
          expected = 1
          continue
        }
      }
      flushBody()
      current.push({ name, description: '.' })
      expected = number + 1
      continue
    }
    if (current.length > 0) body.push(raw)
  }
  startSequence()
  if (sequences.length === 0) return []
  const primary = sequences.reduce((best, seq) => (seq.length > best.length ? seq : best))
  return primary.filter(item => item.description.trim().length >= 40)
}

function expandSingleTopic(topic: TopicDescription): TopicDescription[] {
  const subtopics = topic.subtopics ?? []
  if (subtopics.length >= 2) {
    return subtopics.map(sub => ({
      name: stripHeadingMarks(sub.name),
      description: sub.description,
    }))
  }
  const headingCards = cardsFromMarkdownHeadings(topic.description)
  if (headingCards.length >= 2) return headingCards
  const numbered = cardsFromNumberedList(topic.description)
  if (numbered.length >= 3) return numbered
  return [
    {
      name: stripHeadingMarks(topic.name),
      description: topic.description,
      subtopics,
    },
  ]
}

/** Topic cards for the capture summary: structured topics, else parsed prose. */
export function topicCardsFromSummary(
  sections?: StructuredSummary | null,
  summary?: string | null
): TopicDescription[] {
  if (sections?.topics?.length) {
    const topics = sections.topics.map(topic => ({
      name: stripHeadingMarks(topic.name),
      description: topic.description,
      subtopics: topic.subtopics ?? [],
    }))
    if (topics.length === 1) return expandSingleTopic(topics[0])
    return topics
  }
  const prose = summary?.trim() ?? ''
  if (!prose) return []
  const numbered = cardsFromNumberedList(prose)
  if (numbered.length >= 3) return numbered
  const headingCards = cardsFromMarkdownHeadings(prose)
  if (headingCards.length > 1) return headingCards
  if (headingCards.length === 1) return expandSingleTopic(headingCards[0])
  const dashCards = cardsFromEmDashBlocks(prose)
  if (dashCards.length > 0) return dashCards
  return expandSingleTopic({ name: 'Summary', description: prose })
}

export function hasCaptureLeadSection(
  summary: string | null | undefined,
  sections?: StructuredSummary | null
): boolean {
  return topicCardsFromSummary(sections, summary).length > 0
}

/** Capture-page notes plate: 05 when topics or prose sit above it, else 04. */
export function captureNotesPlateNum(
  summary: string | null | undefined,
  sections?: StructuredSummary | null
): string {
  return hasCaptureLeadSection(summary, sections) ? '05' : '04'
}

export function captureSectionPlate(
  index: number,
  summary: string | null | undefined,
  sections?: StructuredSummary | null
): string {
  const shift = hasCaptureLeadSection(summary, sections) ? 1 : 0
  return String(index + shift).padStart(2, '0')
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export async function getSourceSummary(
  token: string,
  sourceId: string
): Promise<SummaryResponse | null> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/summary`, {}, token)
    if (!res.ok) return null
    const body = (await res.json()) as SummaryResponse
    if (!body.sections) return null
    return body
  } catch (error) {
    console.error('Failed to load source summary:', error)
    return null
  }
}

export async function listSourceMessages(token: string, sourceId: string): Promise<ChatMessage[]> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/messages`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { messages: ChatMessage[] }).messages
  } catch (error) {
    console.error('Failed to load source messages:', error)
    return []
  }
}