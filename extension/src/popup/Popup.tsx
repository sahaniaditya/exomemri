/**
 * Popup: space switcher + session status (dumb UI).
 *
 * Talks only to the background worker via typed messages.
 */
import { useEffect, useState } from "react"

import type { SessionResponse } from "../lib/contracts"
import { sendMessage } from "../lib/messaging"

export function Popup() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [spaceId, setSpaceId] = useState("")
  const [error, setError] = useState("")

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
    await sendMessage("setActiveSpace", spaceId)
    await refresh()
  }

  return (
    <div style={{ width: 280, padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
      <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>Atlas</h1>
      {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {session && (
        <>
          <div style={{ color: "#6b7280", fontSize: 12 }}>{session.user.email}</div>
          <div style={{ margin: "8px 0 4px" }}>
            Active space: <strong>{session.active_space?.name ?? "none"}</strong>
          </div>
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 8 }}>
            Space id
          </label>
          <input
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            style={{ width: "100%", padding: 6, boxSizing: "border-box" }}
          />
          <button
            onClick={setActive}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderRadius: 8,
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Set active space
          </button>
        </>
      )}
    </div>
  )
}
