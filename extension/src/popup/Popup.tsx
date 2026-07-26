/**
 * Popup: space switcher + the primary Save action (dumb UI).
 *
 * Talks only to the background worker via typed messages. The background
 * captures the active tab's page; the popup just reflects status.
 */
import { useEffect, useState } from "react"

import type { SessionResponse } from "../lib/contracts"
import { sendMessage } from "../lib/messaging"

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function Popup() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [spaceId, setSpaceId] = useState("")
  const [error, setError] = useState("")
  const [spaceSaved, setSpaceSaved] = useState(false)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState("")

  async function refresh() {
    try {
      const s = await sendMessage("getSession", undefined)
      setSession(s)
      setSpaceId(s.active_space?.id ?? "")
      setError("")
    } catch {
      setError("Signed out — open atlas.ai to sign in.")
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function setActive() {
    setSpaceSaved(false)
    try {
      await sendMessage("setActiveSpace", spaceId)
      await refresh()
      setSpaceSaved(true)
      setTimeout(() => setSpaceSaved(false), 1500)
    } catch {
      setError("Couldn't set the space — reopen atlas.ai to refresh your session.")
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

  return (
    <div style={styles.root}>
      <h1 style={styles.h1}>Atlas</h1>
      {error && <div style={styles.error}>{error}</div>}
      {session && (
        <>
          <div style={styles.email}>{session.user.email}</div>

          {/* Primary action: save the current tab into the active space. */}
          <button
            onClick={saveCurrentPage}
            disabled={saveStatus === "saving" || !session.active_space}
            style={{ ...styles.primary, ...(saveStatus === "saved" ? styles.primarySaved : {}) }}
            data-testid="atlas-save"
          >
            {saveStatus === "idle" && "Save this page"}
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved ✓"}
            {saveStatus === "error" && "Retry"}
          </button>
          <div style={styles.saveTo}>
            into <strong>{session.active_space?.name ?? "no space"}</strong>
          </div>
          {saveStatus === "error" && (
            <div style={styles.error} data-testid="atlas-error">
              {saveError}
            </div>
          )}

          <hr style={styles.hr} />

          <label style={styles.label}>Space id</label>
          <input
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            style={styles.input}
          />
          <button onClick={setActive} style={styles.secondary}>
            {spaceSaved ? "Set ✓" : "Set active space"}
          </button>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { width: 280, padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 14 },
  h1: { fontSize: 16, margin: "0 0 12px" },
  email: { color: "#6b7280", fontSize: 12, marginBottom: 12 },
  saveTo: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 6 },
  error: { color: "#b91c1c", fontSize: 12, marginTop: 8 },
  hr: { border: "none", borderTop: "1px solid #e5e7eb", margin: "16px 0 12px" },
  label: { display: "block", fontSize: 12, color: "#6b7280" },
  input: { width: "100%", padding: 6, boxSizing: "border-box", marginTop: 4 },
  primary: {
    width: "100%",
    padding: "10px 0",
    border: "none",
    borderRadius: 8,
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  primarySaved: { background: "#16a34a" },
  secondary: {
    marginTop: 8,
    width: "100%",
    padding: "8px 0",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    color: "#111827",
    fontWeight: 600,
    cursor: "pointer",
  },
}
