import { defineContentScript } from "#imports"

import { runYoutubeMain } from "../content/youtube-main"

// MAIN world, document_start: the taps have to be installed before YouTube's
// bundle caches its own reference to `fetch`. Everything else about this
// feature degrades gracefully; losing this race just means the panel tier does
// all the work.
export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  excludeMatches: ["*://music.youtube.com/*", "*://studio.youtube.com/*"],
  runAt: "document_start",
  world: "MAIN",
  allFrames: false,
  // Anonymous IIFE: this runs in the page realm, so a named global would be
  // page-visible surface on a site that does not need to know we exist.
  globalName: false,
  noScriptStartedPostMessage: true,
  main() {
    runYoutubeMain()
  },
})
