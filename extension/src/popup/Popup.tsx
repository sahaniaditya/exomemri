/**
 * Popup: space switcher + the primary Save action (dumb UI).
 *
 * Talks only to the background worker via typed messages. The background
 * captures the active tab's page; the popup just reflects status.
 *
 * Styling mirrors the web app's design system (see ./theme.ts) so the
 * extension reads as the same product as exomemri.
 */
import { useEffect, useState } from "react"
import { browser } from "wxt/browser"

import type { SessionResponse, SpaceSummary } from "../lib/contracts"
import { sendMessage } from "../lib/messaging"
import { readTabSession } from "../lib/read-tab-session"
import { parseStoredSession, STORED_SESSION_KEY } from "../lib/session-blob"
import { ContourBg, Glyph, Wordmark } from "./Glyph"
import { color, font } from "./theme"

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function Popup() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null)
  const [spacesError, setSpacesError] = useState("")
  const [error, setError] = useState("")
  const [spaceSaved, setSpaceSaved] = useState(false)
  const [switching, setSwitching] = useState(false)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState("")

  function wipeUi() {
    setSession(null)
    setSpaces(null)
    setSpacesError("")
    setError("Signed out — open exomemri to sign in.")
    setSpaceSaved(false)
    setSwitching(false)
    setSaveStatus("idle")
    setSaveError("")
  }

  async function refresh(): Promise<boolean> {
    try {
      const s = await sendMessage("getSession", undefined)
      setSession(s)
      setError("")
      return true
    } catch {
      wipeUi()
      return false
    }
  }

  async function refreshSpaces() {
    try {
      setSpaces(await sendMessage("listSpaces", undefined))
      setSpacesError("")
    } catch {
      setSpaces(null)
      setSpacesError("Couldn't load spaces.")
    }
  }

  useEffect(() => {
    // Opening the popup grants `activeTab`, so the tab the user is looking at
    // can always be read — even if its content script was never injected or was
    // orphaned by an extension reload. This is the path that makes a fresh
    // login show up without the user refreshing the page.
    async function pullFromActiveTab(): Promise<void> {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      const url = tab?.url ?? tab?.pendingUrl
      if (!tab?.id || !url) return

      const read = await readTabSession(tab.id)
      if (!read) return // Not scriptable — the background sweep is the fallback.

      await sendMessage("ingestPageSession", { ...read, url }).catch(() => undefined)
    }

    async function boot() {
      await pullFromActiveTab()
      await sendMessage("resyncSession", undefined).catch(() => undefined)
      const signedIn = await refresh()
      if (signedIn) await refreshSpaces()
    }
    void boot()

    const onStorageChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "local" || !(STORED_SESSION_KEY in changes)) return
      const next = parseStoredSession(changes[STORED_SESSION_KEY]?.newValue)
      if (!next) {
        wipeUi()
        return
      }
      setSpaces(null)
      setSpacesError("")
      void refresh().then((ok) => {
        if (ok) void refreshSpaces()
      })
    }
    browser.storage.onChanged.addListener(onStorageChanged)
    return () => browser.storage.onChanged.removeListener(onStorageChanged)
  }, [])

  async function selectSpace(spaceId: string) {
    if (!spaceId || spaceId === session?.active_space?.id) return
    setSpaceSaved(false)
    setSwitching(true)
    try {
      await sendMessage("setActiveSpace", spaceId)
      await refresh()
      setSpaceSaved(true)
      setTimeout(() => setSpaceSaved(false), 1500)
    } catch {
      setError("Couldn't switch space — reopen exomemri to refresh your session.")
    } finally {
      setSwitching(false)
    }
  }

  async function saveCurrentPage() {
    setSaveStatus("saving")
    setSaveError("")
    const result = await sendMessage("captureActiveTab", undefined)
    if (result.ok) {
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } else {
      setSaveError(result.error)
      setSaveStatus("error")
    }
  }

  const saveDisabled = saveStatus === "saving" || !session?.active_space

  return (
    <div style={styles.root}>
      <ContourBg />

      <div style={styles.content}>
        {/* Brand row — the exact mark and wordmark from the web app. */}
        <header style={styles.brand}>
          <Glyph size={22} />
          <Wordmark size={17} />
          <span style={styles.spacer} />
          <span style={styles.status}>
            <span
              style={{
                ...styles.dot,
                background: session ? color.green : color.clay,
              }}
            />
            {session ? "Connected" : "Signed out"}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => window.close()}
            style={styles.close}
            onMouseOver={(e) => (e.currentTarget.style.color = color.ink)}
            onMouseOut={(e) => (e.currentTarget.style.color = color.sage)}
          >
            ×
          </button>
        </header>

        {error && <div style={styles.error}>{error}</div>}

        {session && (
          <>
            {/* Plate label — the numbered mono eyebrow used across exomemri. */}
            <div style={styles.plate}>
              <span style={styles.plateNum}>01</span>
              <span style={styles.plateLabel}>Capture</span>
              <span style={styles.rule} />
            </div>

            <section style={styles.card}>
              <h1 style={styles.h1}>Save this page.</h1>
              <p style={styles.sub}>
                Into <strong style={styles.strong}>{session.active_space?.name ?? "no space"}</strong>
              </p>

              {/* Primary action: save the current tab into the active space. */}
              <button
                onClick={saveCurrentPage}
                disabled={saveDisabled}
                style={{
                  ...styles.primary,
                  background:
                    saveStatus === "saved"
                      ? color.greenDeep
                      : saveDisabled
                        ? color.greenSoft
                        : color.green,
                  cursor: saveDisabled ? "not-allowed" : "pointer",
                }}
                onMouseOver={(e) => {
                  if (!saveDisabled) e.currentTarget.style.background = color.greenDeep
                }}
                onMouseOut={(e) => {
                  if (!saveDisabled && saveStatus !== "saved")
                    e.currentTarget.style.background = color.green
                }}
                data-testid="exomemri-save"
              >
                {saveStatus === "idle" && (
                  <>
                    Save this page <span aria-hidden="true">→</span>
                  </>
                )}
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved ✓"}
                {saveStatus === "error" && "Retry"}
              </button>

              {saveStatus === "error" && (
                <div style={styles.error} data-testid="exomemri-error">
                  {saveError}
                </div>
              )}
            </section>

            <div style={styles.plate}>
              <span style={styles.plateNum}>02</span>
              <span style={styles.plateLabel}>Active space</span>
              <span style={styles.rule} />
            </div>

            <section style={styles.card}>
              <label htmlFor="space-picker" style={styles.label}>
                {spaceSaved ? "Switched ✓" : "Capturing into"}
              </label>

              {spaces === null && !spacesError && (
                <div style={styles.hint}>Loading spaces…</div>
              )}

              {spacesError && <div style={styles.hint}>{spacesError}</div>}

              {spaces !== null && spaces.length === 0 && (
                <div style={styles.hint}>
                  No spaces yet — create one on exomemri to start capturing.
                </div>
              )}

              {spaces !== null && spaces.length > 0 && (
                <select
                  id="space-picker"
                  value={session.active_space?.id ?? ""}
                  disabled={switching}
                  onChange={(e) => void selectSpace(e.target.value)}
                  style={styles.input}
                  data-testid="exomemri-space-picker"
                  onFocus={(e) => (e.target.style.borderColor = color.green)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(27,26,22,.16)")}
                >
                  {/* Only reachable when the session has no active space. */}
                  {!session.active_space && <option value="">Choose a space…</option>}
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              )}
            </section>

            <footer style={styles.footer}>{session.user.email}</footer>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    width: 330,
    background: color.paper,
    color: color.ink,
    fontFamily: font.sans,
    fontSize: 14,
    overflow: "hidden",
    WebkitFontSmoothing: "antialiased",
  },
  content: { position: "relative", zIndex: 1, padding: "16px 18px 14px" },

  brand: { display: "flex", alignItems: "center", gap: 9, marginBottom: 18 },
  spacer: { flex: 1 },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: color.sage,
  },
  dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  close: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    marginLeft: 2,
    padding: 0,
    border: "none",
    borderRadius: 4,
    background: "transparent",
    color: color.sage,
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
  },

  plate: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  plateNum: { fontFamily: font.mono, fontSize: 11, fontWeight: 500, color: color.green },
  plateLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: color.sage,
  },
  rule: { height: 1, flex: 1, background: "rgba(27,26,22,.14)" },

  card: {
    background: color.surface,
    border: `1px solid ${color.line}`,
    borderRadius: 8,
    boxShadow: "0 1px 0 rgba(27,26,22,.04), 0 18px 40px -28px rgba(27,26,22,.22)",
    padding: 16,
    marginBottom: 18,
  },

  h1: {
    fontFamily: font.serif,
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    color: color.ink,
    margin: "0 0 4px",
  },
  sub: { fontSize: 13, color: color.inkMuted, margin: "0 0 14px" },
  strong: { color: color.ink, fontWeight: 600 },

  primary: {
    width: "100%",
    padding: "11px 16px",
    border: "none",
    borderRadius: 4,
    color: color.paper,
    fontFamily: font.sans,
    fontSize: 14.5,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "background .18s",
  },
  label: {
    display: "block",
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: color.sage,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    boxSizing: "border-box",
    background: color.paper,
    border: "1px solid rgba(27,26,22,.16)",
    borderRadius: 4,
    fontFamily: font.sans,
    fontSize: 13.5,
    color: color.ink,
    outline: "none",
    transition: "border-color .15s",
  },
  hint: { fontSize: 13, lineHeight: 1.45, color: color.inkMuted },

  error: {
    fontFamily: font.mono,
    fontSize: 11.5,
    lineHeight: 1.45,
    color: color.clay,
    marginTop: 10,
  },
  footer: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: "0.06em",
    color: color.sageLight,
    textAlign: "center",
  },
}
