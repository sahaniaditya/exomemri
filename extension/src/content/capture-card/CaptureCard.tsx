/**
 * The auto-surfacing capture card (dumb UI).
 *
 * Holds no session and makes no network/auth calls itself — it invokes the
 * callbacks the content script wired to typed background messages.
 */
import { useEffect, useState } from "react"

import type { CaptureResult } from "../../lib/messaging"

type Status = "idle" | "saving" | "saved" | "error"

export interface CaptureCardProps {
  title: string
  loadSpaceName: () => Promise<string | null>
  onSave: () => Promise<CaptureResult>
  onDismiss: () => void
}

export function CaptureCard({ title, loadSpaceName, onSave, onDismiss }: CaptureCardProps) {
  const [status, setStatus] = useState<Status>("idle")
  const [spaceName, setSpaceName] = useState<string | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    loadSpaceName()
      .then(setSpaceName)
      .catch(() => setSpaceName(null))
  }, [loadSpaceName])

  async function handleSave() {
    setStatus("saving")
    const result = await onSave()
    if (result.ok) {
      setStatus("saved")
      setTimeout(onDismiss, 1500)
    } else {
      setError(result.error)
      setStatus("error")
    }
  }

  return (
    <div style={styles.card} data-testid="atlas-capture-card">
      <div style={styles.header}>
        <span style={styles.brand}>Atlas</span>
        <button
          style={styles.close}
          onClick={onDismiss}
          aria-label="Dismiss"
          data-testid="atlas-dismiss"
        >
          ×
        </button>
      </div>
      <div style={styles.space}>
        {spaceName ? `Saving to “${spaceName}”` : "Signed out"}
      </div>
      <div style={styles.title} title={title}>
        {title}
      </div>
      {status === "error" && (
        <div style={styles.error} data-testid="atlas-error">
          {error}
        </div>
      )}
      <button
        style={{ ...styles.save, ...(status === "saved" ? styles.saved : {}) }}
        onClick={handleSave}
        disabled={status === "saving" || status === "saved" || !spaceName}
        data-testid="atlas-save"
      >
        {status === "idle" && "Save"}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved ✓"}
        {status === "error" && "Retry"}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "280px",
    padding: "14px 16px",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    zIndex: 2147483647,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  brand: { fontWeight: 700, letterSpacing: "0.02em" },
  close: {
    border: "none",
    background: "transparent",
    fontSize: "18px",
    cursor: "pointer",
    color: "#6b7280",
    lineHeight: 1,
  },
  space: { marginTop: "6px", fontSize: "12px", color: "#6b7280" },
  title: {
    marginTop: "4px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  error: { marginTop: "8px", fontSize: "12px", color: "#b91c1c" },
  save: {
    marginTop: "12px",
    width: "100%",
    padding: "8px 0",
    border: "none",
    borderRadius: "8px",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  saved: { background: "#16a34a" },
}
