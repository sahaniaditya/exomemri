import { defineContentScript } from "#imports"

import { registerExtractor } from "../content/collect"

// Single content script: no UI, just an on-demand extractor the popup drives
// through the background worker.
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    registerExtractor()
  },
})
