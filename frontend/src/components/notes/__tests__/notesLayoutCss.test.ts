import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(__dirname, '../notes.module.css'), 'utf8')

/** The body of the `@media (max-width: 860px)` block (sidebar becomes a drawer). */
function drawerMediaBlock(source: string): string {
  const start = source.indexOf('@media (max-width: 860px)')
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error('unterminated media block')
}

describe('notes.module.css drawer layout', () => {
  it('keeps the fixed Pages button from covering the top bar', () => {
    const block = drawerMediaBlock(css)
    expect(block).toMatch(/\.drawerToggle\s*\{[^}]*position:\s*fixed/)
    expect(block).toMatch(/\.topbar\s*\{[^}]*padding-left:\s*\d+px/)
  })
})
