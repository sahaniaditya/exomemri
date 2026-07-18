import { describe, expect, it } from "vitest"

import type { ChatArtifact } from "../../src/lib/extractors"
import { extractAiChat } from "../../src/lib/extractors"
import { loadFixture } from "./helpers"

const URL = "https://chatgpt.com/c/xyz"

describe("extractAiChat", () => {
  it("extracts an ordered message thread with roles", () => {
    const capture = extractAiChat(loadFixture("chatgpt.html"), URL)
    expect(capture).not.toBeNull()
    expect(capture!.type).toBe("ai_chat")

    const artifact = JSON.parse(capture!.content!) as ChatArtifact
    expect(artifact.messages).toHaveLength(4)
    expect(artifact.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ])
    expect(artifact.messages[0]?.text).toContain("cache invalidation strategies")
  })

  it("returns null when there are no messages", () => {
    const empty = new DOMParser().parseFromString("<html><body></body></html>", "text/html")
    expect(extractAiChat(empty, URL)).toBeNull()
  })
})
