'use client'

/**
 * Recently-viewed Zustand store. localStorage only, cap 10, cross-tab
 * sync via the standard `storage` event.
 *
 * Usage:
 *   - PDP server component renders a small client child that calls
 *     `useRecentlyViewedStore.getState().record(productId, slug)` on
 *     mount.
 *   - The strip component reads the list via `useRecentlyViewed(excludeId)`
 *     and renders horizontal cards.
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { recordView } from './logic'
import type { RecentlyViewedItem } from './logic'

const STORAGE_KEY = 'loveli-recently-viewed-v1'
const CAP = 10

interface State {
  items: RecentlyViewedItem[]
  hasHydrated: boolean
}

interface Actions {
  record: (input: { productId: number; slug: string }) => void
  clear: () => void
}

type Store = State & Actions

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useRecentlyViewedStore = create<Store>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      record: (input) =>
        set({ items: recordView(get().items, input, Date.now(), CAP) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : window.localStorage,
      ),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useRecentlyViewedStore.persist.rehydrate()
  })
}

export type { RecentlyViewedItem }
