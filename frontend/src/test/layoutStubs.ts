/**
 * jsdom has no layout engine. ProseMirror's coordsAtPos (used by floating menus) needs
 * Range#getClientRects / getBoundingClientRect, so give them empty-rect implementations.
 * Import for side effects from tests that mount floating menus.
 */
const rect = (): DOMRect => new DOMRect(0, 0, 0, 0)

if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= rect
  Range.prototype.getClientRects ??= () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
}

export {}
