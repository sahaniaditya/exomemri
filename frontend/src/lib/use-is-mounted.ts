'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/** True after hydration — false during SSR and the first client render. */
export function useIsMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}
