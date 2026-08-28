import { defineConfig } from "wxt"

// exomemri capture extension (MV3). The design's logical layout
// (src/background, src/content, src/popup, src/lib) is preserved; WXT only
// requires the browser entrypoints to live under src/entrypoints/, which are
// thin adapters that delegate into those modules.
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "exomemri",
    description: "Capture what you learn online into a Learning Space.",
    action: {
      default_title: "exomemri",
      default_icon: {
        16: "/icon-16.png",
        32: "/icon-32.png",
        48: "/icon-48.png",
        128: "/icon-128.png",
      },
    },
    // The exomemri mark (public/icon.svg — identical to the web app's Mark),
    // rasterized per size so Chrome never has to downscale a 128px source.
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      // Backend capture endpoint. Keep localhost for `npm run dev`; the
      // production origin is required in the store zip (`npm run zip`).
      "http://localhost:8000/*",
      "https://atlas-ai-ni72.onrender.com/*",
      // Supabase Storage host for the direct client-side PDF PUT.
      "https://*.supabase.co/*",
      // The exomemri web app: the bridge content script (atlas-bridge.content.ts)
      // reads the logged-in session from its localStorage. Keep in sync with
      // WEB_APP_MATCH_PATTERNS in src/lib/trusted-origin.ts.
      // `http://localhost/*` matches every localhost port (3000, 3001, …).
      // Do not use `localhost:*` — that pattern is invalid in Chrome.
      "http://localhost/*",
      "http://localhost:3000/*",
      "http://localhost:3001/*",
      "http://127.0.0.1/*",
      "http://127.0.0.1:3000/*",
      "http://127.0.0.1:3001/*",
      "https://localhost/*",
      "https://127.0.0.1/*",
      "https://exomemri.com/*",
      "https://www.exomemri.com/*",
      "https://atlas-ai-puce-xi.vercel.app/*",
      // YouTube transcript capture (youtube.content.ts + youtube-main.content.ts).
      // No extra install warning: the <all_urls> content script already asks for
      // the broadest possible access.
      "*://*.youtube.com/*",
    ],
  },
})
