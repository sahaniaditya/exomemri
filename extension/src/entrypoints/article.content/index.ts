import { defineContentScript } from "#imports"

import { runArticle } from "../../content/article/collect"

export default defineContentScript({
  // Broad match, gated at runtime by the article-guard in runArticle.
  matches: ["<all_urls>"],
  async main(ctx) {
    await runArticle(ctx)
  },
})
