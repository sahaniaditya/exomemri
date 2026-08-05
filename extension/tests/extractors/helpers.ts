import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const FIXTURE_DIR = resolve(process.cwd(), "tests/extractors/fixtures")

/** Parse a saved HTML fixture into a Document (jsdom-backed in vitest). */
export function loadFixture(name: string): Document {
  const html = readFileSync(resolve(FIXTURE_DIR, name), "utf-8")
  return new DOMParser().parseFromString(html, "text/html")
}

/** Load a saved JSON fixture. Returns `unknown` — parsers take unknown too. */
export function loadJsonFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), "utf-8"))
}
