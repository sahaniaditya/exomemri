import { describe, expect, it, vi } from "vitest"

const executeScript = vi.fn()

vi.mock("wxt/browser", () => ({
  browser: { scripting: { executeScript: (...args: unknown[]) => executeScript(...args) } },
}))

const { readTabSession } = await import("../../src/lib/read-tab-session")
const { APP_MARKER_KEY, STORED_SESSION_KEY } = await import("../../src/lib/session-blob")

// No `mockReset` between tests on purpose: every test sets its own
// implementation, and resetting a mock that has returned a rejected promise
// trips Vitest 4 into reporting it as an unhandled error.
describe("readTabSession", () => {
  it("reads the session blob and the app marker from the page", async () => {
    executeScript.mockResolvedValue([{ result: { raw: '{"a":1}', isAppHost: true } }])

    expect(await readTabSession(7)).toEqual({ raw: '{"a":1}', isAppHost: true })
    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 7 },
        world: "MAIN",
        args: [STORED_SESSION_KEY, APP_MARKER_KEY],
      }),
    )
  })

  // The distinction the destructive clear hangs on: a signed-out web-app tab
  // reports the marker with no blob, and only that combination means "signed
  // out". Everything else must be unreadable/no-information.
  it("reports a signed-out app page as marker-present with no blob", async () => {
    executeScript.mockResolvedValue([{ result: { raw: null, isAppHost: true } }])
    expect(await readTabSession(1)).toEqual({ raw: null, isAppHost: true })
  })

  it("returns null when the tab cannot be scripted", async () => {
    executeScript.mockImplementation(async () => {
      throw new Error("Cannot access contents of the page")
    })
    expect(await readTabSession(1)).toBeNull()
  })

  it("returns null when the page's localStorage threw", async () => {
    executeScript.mockResolvedValue([{ result: null }])
    expect(await readTabSession(1)).toBeNull()
  })

  it("returns null when no frame produced a result", async () => {
    executeScript.mockResolvedValue([])
    expect(await readTabSession(1)).toBeNull()
  })

  it("normalizes a non-exomemri page to no blob and no marker", async () => {
    executeScript.mockResolvedValue([{ result: { raw: null, isAppHost: false } }])
    expect(await readTabSession(1)).toEqual({ raw: null, isAppHost: false })
  })

  it("coerces junk field types rather than trusting the page", async () => {
    executeScript.mockResolvedValue([{ result: { raw: 42, isAppHost: "yes" } }])
    expect(await readTabSession(1)).toEqual({ raw: null, isAppHost: false })
  })
})
