import { defineConfig } from "wxt"

// Atlas capture extension (MV3). The design's logical layout
// (src/background, src/content, src/popup, src/lib) is preserved; WXT only
// requires the browser entrypoints to live under src/entrypoints/, which are
// thin adapters that delegate into those modules.
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Atlas",
    description: "Capture what you learn online into a Learning Space.",
    // The Atlas mark (public/icon.svg — identical to the web app's glyph),
    // rasterized per size so Chrome never has to downscale a 128px source.
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      // Backend capture endpoint (dev). In prod, add the deployed API origin.
      "http://localhost:8000/*",
      // Supabase Storage host for the direct client-side PDF PUT.
      "https://*.supabase.co/*",
      // The Atlas web app: the bridge content script (atlas-bridge.content.ts)
      // reads the logged-in session from its localStorage. Its `matches` cover
      // these origins; listed here too for prod clarity.
      "http://localhost:3000/*",
      "https://atlas-ai-puce-xi.vercel.app/*",
      "https://*.atlas.ai/*",
      // YouTube transcript capture (youtube.content.ts + youtube-main.content.ts).
      // No extra install warning: the <all_urls> content script already asks for
      // the broadest possible access.
      "*://*.youtube.com/*",
    ],
  },
})
