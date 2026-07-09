import { describe, expect, it } from "vitest"

import { extractArticle } from "../../src/lib/extractors"
import { loadFixture } from "./helpers"

describe("extractArticle", () => {
  it("extracts a readable article", () => {
    const capture = extractArticle(
      loadFixture("article.html"),
      "https://example.com/wal",
    )
    expect(capture).not.toBeNull()
    expect(capture!.type).toBe("article")
    expect(capture!.title).toContain("Write-Ahead Logging")
    expect(capture!.content!.length).toBeGreaterThan(250)
    expect(capture!.raw_html).toBeTruthy()
  })

  it("returns null for a non-article page", () => {
    const capture = extractArticle(
      loadFixture("not-article.html"),
      "https://app.example.com/dashboard",
    )
    expect(capture).toBeNull()
  })
})
