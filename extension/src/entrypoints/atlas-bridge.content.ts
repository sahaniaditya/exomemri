import { defineContentScript } from "#imports"

import { runBridge } from "../content/bridge"
import { WEB_APP_MATCH_PATTERNS } from "../lib/trusted-origin"

// Dedicated bridge script: reads the web app's `atlas.session` from localStorage
// and relays it to the background worker. Kept separate from the <all_urls>
// extractor so localStorage reads only ever happen on the trusted exomemri origin.
//
// NOTE: keep `matches` in sync with `WEB_APP_MATCH_PATTERNS` /
// `isTrustedWebOrigin` (src/lib/trusted-origin.ts).
export default defineContentScript({
  matches: [...WEB_APP_MATCH_PATTERNS],
  runAt: "document_start",
  main() {
    runBridge()
  },
})
