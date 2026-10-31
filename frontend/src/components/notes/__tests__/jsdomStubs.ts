/** jsdom lacks layout APIs ProseMirror calls when it scrolls or measures the selection. */
export function installLayoutStubs(): void {
  const emptyRects = Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getClientRects = () => emptyRects
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  Element.prototype.scrollIntoView = () => {}
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
