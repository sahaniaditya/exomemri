import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Node views create plain `note-*` class names at runtime. In a CSS module a class that is
 * not wrapped in `:global(...)` is hashed, so the rule would never match the DOM.
 */
const css = readFileSync(path.resolve(__dirname, '../note-blocks.module.css'), 'utf8')

function selectorsOutsideGlobal(source: string): string[] {
  const selectors = source.match(/^[^{}\n@/][^{}]*(?=\{)/gm) ?? []
  return selectors
    .map(selector => selector.replace(/:global\([^)]*\)/g, ''))
    .filter(selector => /\.note-[a-z-]+/.test(selector))
}

describe('note-blocks.module.css', () => {
  it('never hashes the runtime note-* class names used by node views', () => {
    expect(selectorsOutsideGlobal(css)).toEqual([])
  })

  it('styles the toggle arrow and callout emoji through global selectors', () => {
    expect(css).toContain(':global(.ProseMirror .note-toggle-arrow)')
    expect(css).toContain(':global(.ProseMirror .note-callout-emoji)')
  })
})
