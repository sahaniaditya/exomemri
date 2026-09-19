import type { ChatMessage } from '@/lib/sources'

/**
 * Module-level, in-memory cache of chat messages keyed by sourceId.
 * Lives outside React state so it updates synchronously the instant a
 * message is sent — independent of any network round-trip (like
 * router.refresh()) that might not finish before the tab closes.
 *
 * Resets on a hard page reload, which is fine: a hard reload already
 * re-fetches `initialMessages` fresh from the server.
 */
const cache = new Map<string, ChatMessage[]>()

export function getCachedMessages(sourceId: string): ChatMessage[] | undefined {
  return cache.get(sourceId)
}

export function setCachedMessages(sourceId: string, messages: ChatMessage[]) {
  cache.set(sourceId, messages)
}