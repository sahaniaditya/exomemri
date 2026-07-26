import { defineContentScript } from "#imports"

import { runBridge } from "../content/bridge"

// Dedicated bridge script: reads the web app's `atlas.session` from localStorage
// and relays it to the background worker. Kept separate from the <all_urls>
// extractor so localStorage reads only ever happen on the trusted Atlas origin.
//
// NOTE: keep `matches` in sync with the background's trusted-origin allowlist
// (src/background/index.ts). Add the real production web origin(s) here.
export default defineContentScript({
  matches: [
    "http://localhost:3000/*",
    "https://atlas-ai-puce-xi.vercel.app/*",
    "https://atlas.ai/*",
    "https://*.atlas.ai/*",
  ],
  runAt: "document_start",
  main() {
    runBridge()
  },
})
