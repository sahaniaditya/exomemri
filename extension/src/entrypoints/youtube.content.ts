import { defineContentScript } from "#imports"

import { initYoutubeCollector } from "../content/youtube-collect"

// ISOLATED world half of transcript capture: owns the cache and the triggers,
// and exposes awaitTranscript() to the extractor via globalThis.__atlasYt.
// document_start so the bridge listener is up before the MAIN script starts
// forwarding intercepted responses.
export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  excludeMatches: ["*://music.youtube.com/*", "*://studio.youtube.com/*"],
  runAt: "document_start",
  allFrames: false,
  main() {
    initYoutubeCollector()
  },
})
