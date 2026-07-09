import { defineContentScript } from "#imports"

import { runAiChat } from "../../content/ai-chat/collect"

export default defineContentScript({
  matches: ["*://chatgpt.com/*", "*://chat.openai.com/*"],
  async main(ctx) {
    await runAiChat(ctx)
  },
})
