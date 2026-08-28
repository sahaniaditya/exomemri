import { describe, expect, it } from "vitest"

import { isTrustedSender, isTrustedWebOrigin } from "../../src/lib/trusted-origin"

describe("isTrustedWebOrigin", () => {
  it("accepts localhost on any port", () => {
    expect(isTrustedWebOrigin("http://localhost:3000")).toBe(true)
    expect(isTrustedWebOrigin("http://localhost:3000/dashboard")).toBe(true)
    expect(isTrustedWebOrigin("http://localhost:3001/dashboard#spaces")).toBe(true)
    expect(isTrustedWebOrigin("http://localhost:5173")).toBe(true)
    expect(isTrustedWebOrigin("https://localhost:3000")).toBe(true)
  })

  it("accepts 127.0.0.1 on any port", () => {
    expect(isTrustedWebOrigin("http://127.0.0.1:3000")).toBe(true)
    expect(isTrustedWebOrigin("http://127.0.0.1:3001/login")).toBe(true)
  })

  it("accepts the production web origins", () => {
    expect(isTrustedWebOrigin("https://exomemri.com")).toBe(true)
    expect(isTrustedWebOrigin("https://exomemri.com/dashboard")).toBe(true)
    expect(isTrustedWebOrigin("https://www.exomemri.com/login")).toBe(true)
    expect(isTrustedWebOrigin("https://atlas-ai-puce-xi.vercel.app")).toBe(true)
    expect(isTrustedWebOrigin("https://atlas-ai-puce-xi.vercel.app/dashboard")).toBe(true)
  })

  it("rejects unrelated hosts", () => {
    expect(isTrustedWebOrigin("https://example.com")).toBe(false)
    expect(isTrustedWebOrigin("https://evil.com")).toBe(false)
    expect(isTrustedWebOrigin("https://localhost.evil.com")).toBe(false)
    expect(isTrustedWebOrigin("https://atlas.ai")).toBe(false)
    expect(isTrustedWebOrigin("chrome-extension://abcdef/popup.html")).toBe(false)
    expect(isTrustedWebOrigin("not a url")).toBe(false)
  })
})

describe("isTrustedSender", () => {
  it("reads origin first, then url, then tab.url", () => {
    expect(isTrustedSender({ origin: "http://localhost:3001" })).toBe(true)
    expect(isTrustedSender({ url: "http://localhost:3001/dashboard" })).toBe(true)
    expect(isTrustedSender({ tab: { url: "http://localhost:3001/dashboard" } })).toBe(true)
    expect(isTrustedSender({})).toBe(false)
    expect(isTrustedSender({ origin: "https://example.com" })).toBe(false)
  })
})
