/**
 * Pure AI-chat extractor (ChatGPT first, per design §11.2).
 *
 * ChatGPT's markup has changed over time, so extraction tries several
 * strategies in order and degrades instead of failing:
 *
 *  1. Current markup: each turn unit carries `data-chatgpt-search-unit-key`
 *     whose value ends in the role, e.g. "fallback-turn-0:1:assistant".
 *  2. Legacy markup: `data-message-author-role` ("user" | "assistant").
 *  3. Last resort: the visible text of <main> as a single "unknown" message.
 *
 * Other products can be added behind their own selectors later.
 */
import type { ExtractedCapture } from "../contracts"

export interface ChatMessage {
  role: string
  text: string
}

export interface ChatArtifact {
  title: string
  url: string
  messages: ChatMessage[]
}

const UNIT_SELECTORS = [
  "[data-chatgpt-search-unit-key]", // current markup
  "[data-message-author-role]", // legacy markup
]

const ROLE_FROM_KEY = /:(user|assistant|system|tool)$/

/** Below this, <main> is almost certainly an empty/new chat, not a conversation. */
const MIN_FALLBACK_CHARS = 200

function roleOf(el: Element): string {
  const key = el.getAttribute("data-chatgpt-search-unit-key") ?? ""
  const fromKey = ROLE_FROM_KEY.exec(key)
  if (fromKey) return fromKey[1]

  const legacy = el.getAttribute("data-message-author-role")
  if (legacy) return legacy

  return el.querySelector("[data-user-message-bubble]") ? "user" : "unknown"
}

/**
 * Visible text when the browser provides it (innerText follows rendered layout,
 * which matters because replies are split into per-word spans), otherwise
 * textContent (jsdom/happy-dom don't implement innerText).
 */
function visibleText(el: Element): string {
  const inner = (el as HTMLElement).innerText
  return (typeof inner === "string" ? inner : (el.textContent ?? "")).trim()
}

function dedupeKey(el: Element): string {
  const ids = el.getAttribute("data-chatgpt-search-message-ids") ?? ""
  const key = el.getAttribute("data-chatgpt-search-unit-key") ?? ""
  return ids || key ? `${ids}|${key}` : ""
}

function collectMessages(doc: Document, selector: string): ChatMessage[] {
  const seen = new Set<string>()
  const messages: ChatMessage[] = []

  for (const el of Array.from(doc.querySelectorAll(selector))) {
    const dk = dedupeKey(el)
    if (dk) {
      if (seen.has(dk)) continue
      seen.add(dk)
    }
    const text = visibleText(el)
    if (text) messages.push({ role: roleOf(el), text })
  }

  return messages
}

export function extractAiChat(doc: Document, url: string): ExtractedCapture | null {
  let messages: ChatMessage[] = []

  for (const selector of UNIT_SELECTORS) {
    messages = collectMessages(doc, selector)
    if (messages.length > 0) break
  }

  // Safety net for the next markup change: capture the main pane as one block
  // rather than failing. Roles are lost, but the content is saved.
  if (messages.length === 0) {
    const main = doc.querySelector("main")
    const text = main ? visibleText(main) : ""
    if (text.length < MIN_FALLBACK_CHARS) return null
    messages = [{ role: "unknown", text }]
  }

  const title = doc.title.replace(/\s*[-|]\s*ChatGPT\s*$/i, "").trim() || "AI chat"
  const artifact: ChatArtifact = { title, url, messages }

  return {
    type: "ai_chat",
    url,
    title,
    author: null,
    content: JSON.stringify(artifact),
  }
}