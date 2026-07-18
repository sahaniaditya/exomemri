/**
 * Pure AI-chat extractor (ChatGPT first, per design §11.2).
 *
 * ChatGPT renders each turn inside an element carrying
 * `data-message-author-role` ("user" | "assistant"). Other products can be
 * added behind their own selectors later.
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

export function extractAiChat(doc: Document, url: string): ExtractedCapture | null {
  const nodes = Array.from(doc.querySelectorAll("[data-message-author-role]"))
  const messages: ChatMessage[] = nodes
    .map((el) => ({
      role: el.getAttribute("data-message-author-role") ?? "unknown",
      text: (el.textContent ?? "").trim(),
    }))
    .filter((m) => m.text.length > 0)

  if (messages.length === 0) return null

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
