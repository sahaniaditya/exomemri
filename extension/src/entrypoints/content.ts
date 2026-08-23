import { defineContentScript } from "#imports"

import { registerExtractor } from "../content/collect"

// Single content script: no UI, just an on-demand extractor the popup drives
// through the background worker. The session bridge deliberately lives in its
// own entrypoint (atlas-bridge.content.ts) so localStorage reads only ever
// happen on the trusted exomemri origin.
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    registerExtractor()
  },
})
