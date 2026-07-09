/**
 * Mounts the capture card into an isolated shadow root so page styles can't
 * bleed in and the card can't disturb the host page.
 */
import { createShadowRootUi } from "#imports"
import { createRoot, type Root } from "react-dom/client"
import type { ContentScriptContext } from "wxt/utils/content-script-context"

import { getActiveSpace, sendCapture } from "../shared"
import type { ExtractedCapture } from "../../lib/contracts"
import { CaptureCard } from "./CaptureCard"

export async function mountCaptureCard(
  ctx: ContentScriptContext,
  extracted: ExtractedCapture,
): Promise<void> {
  const ui = await createShadowRootUi(ctx, {
    name: "atlas-capture-card",
    position: "overlay",
    anchor: "body",
    onMount(container: HTMLElement) {
      const root = createRoot(container)
      root.render(
        <CaptureCard
          title={extracted.title}
          loadSpaceName={async () => (await getActiveSpace())?.name ?? null}
          onSave={() => sendCapture(extracted)}
          onDismiss={() => ui.remove()}
        />,
      )
      return root
    },
    onRemove(root: Root | undefined) {
      root?.unmount()
    },
  })
  ui.mount()
}
