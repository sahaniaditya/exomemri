/**
 * Background service worker boot: wires the typed message router.
 *
 * This is the extension's only network/auth surface. Content scripts and the
 * popup reach it exclusively through these typed messages.
 */
import { onMessage } from "../lib/messaging"
import { capturePdf, captureText } from "./capture"
import { fetchSession, getActiveSpace, setActiveSpace } from "./session"

export function bootBackground(): void {
  onMessage("capture", ({ data }) => captureText(data))
  onMessage("capturePdf", ({ data }) => capturePdf(data))
  onMessage("getSession", () => fetchSession())
  onMessage("getActiveSpace", () => getActiveSpace())
  onMessage("setActiveSpace", async ({ data }) => {
    await setActiveSpace(data)
    return { ok: true }
  })
}
