import { defineContentScript } from "#imports"

import { runYouTube } from "../../content/youtube/collect"

export default defineContentScript({
  matches: ["*://*.youtube.com/watch*"],
  async main(ctx) {
    await runYouTube(ctx)
  },
})
