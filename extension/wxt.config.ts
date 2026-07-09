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
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      // Backend capture endpoint (dev). Phase 2: add "https://*.atlas.ai/*".
      "http://localhost:8000/*",
      // Supabase Storage host for the direct client-side PDF PUT.
      "https://*.supabase.co/*",
    ],
  },
})
