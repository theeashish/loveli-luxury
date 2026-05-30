'use client'

/**
 * Client-side wishlist store. Mirrors the cart store pattern: Zustand
 * with localStorage persistence, cross-tab sync, hydration flag.
 *
 * Two operating modes, switched by the auth state:
 *
 *   GUEST:
 *     Local-only. Adds/removes update localStorage. No network calls.
 *
 *   SIGNED-IN:
 *     Local cache stays the UI source-of-truth (instant UI). Every
 *     mutation fires a debounced background POST/DELETE to /api/wishlist
 *     to mirror the change in `wishlist_items`. On hydration, the store
 *     fetches the server list and merges it with the local cache (see
 *     `mergeLists` — keeps earliest addedAt per key).
 *
 * Sign-in handoff:
 *   The (public)/layout.tsx renders a `<WishlistHydrator />` component
 *   that reads the auth session via the supabase browser client and
 *   triggers `pullAndMerge()` exactly once on mount. After that, the
 *   store assumes the merged list is canonical.
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import {
  addToList,
  isInList,
  mergeLists,
  removeFromList,
} from './logic'
import type { WishlistItem } from './types'
import { itemKey, wishlistKey } from './types'

const STORAGE_KEY = 'loveli-wishlist-v1'

type WishlistTarget = { productId?: number; bundleId?: number }

type Mode = 'guest' | 'signed_in'

interface WishlistState {
  items: WishlistItem[]
  mode: Mode
  hasHydrated: boolean
}

interface WishlistActions {
  /** Set the current auth mode. Called by the hydrator on mount and on
   *  auth-state changes. */
  setMode: (mode: Mode) => void
  /** Add an item (no-op if already present). Mirrors to server if signed in. */
  add: (target: WishlistTarget) => void
  /** Remove an item. Mirrors to server if signed in. */
  remove: (target: WishlistTarget) => void
  /** Toggle membership. Convenience for the heart button. */
  toggle: (target: WishlistTarget) => void
  /** Boolean check — does the wishlist contain this product/bundle? */
  has: (target: WishlistTarget) => boolean
  /** Replace the entire list (used by the hydrator after merging server data). */
  replace: (items: WishlistItem[]) => void
  /** Hard clear (used on sign-out if needed). */
  clear: () => void
}

type Store = WishlistState & WishlistActions

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useWishlistStore = create<Store>()(
  persist(
    (set, get) => ({
      items: [],
      mode: 'guest',
      hasHydrated: false,
      setMode: (mode) => set({ mode }),
      add: (target) => {
        const next = addToList(get().items, target)
        set({ items: next })
        if (get().mode === 'signed_in') void mirrorAdd(target)
      },
      remove: (target) => {
        const next = removeFromList(get().items, target)
        set({ items: next })
        if (get().mode === 'signed_in') void mirrorRemove(target)
      },
      toggle: (target) => {
        const has = isInList(get().items, target)
        if (has) get().remove(target)
        else get().add(target)
      },
      has: (target) => isInList(get().items, target),
      replace: (items) => set({ items }),
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

// Cross-tab sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useWishlistStore.persist.rehydrate()
  })
}

// ---------------------------------------------------------------------
// Network helpers — fire-and-forget. Failures are non-fatal (the local
// cache still reflects the change; admin can reconcile later if needed).
// ---------------------------------------------------------------------

async function mirrorAdd(target: WishlistTarget): Promise<void> {
  try {
    await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(target),
    })
  } catch {
    // ignore — UI already updated; we'll resync on next hydration
  }
}

async function mirrorRemove(target: WishlistTarget): Promise<void> {
  try {
    await fetch('/api/wishlist', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(target),
    })
  } catch {
    // ignore
  }
}

/**
 * Pull the server's wishlist and merge it with the local cache.
 * Called by the hydrator component when the user is signed in.
 */
export async function pullAndMergeFromServer(): Promise<void> {
  let serverItems: WishlistItem[] = []
  try {
    const res = await fetch('/api/wishlist', { cache: 'no-store' })
    if (!res.ok) return
    const json = (await res.json()) as { items?: WishlistItem[] }
    serverItems = json.items ?? []
  } catch {
    return
  }

  const localItems = useWishlistStore.getState().items

  // If the server is missing anything that local has, push the deltas.
  const serverKeys = new Set(serverItems.map(itemKey))
  for (const local of localItems) {
    if (!serverKeys.has(itemKey(local))) {
      void mirrorAdd({
        productId: local.productId ?? undefined,
        bundleId: local.bundleId ?? undefined,
      })
    }
  }

  const merged = mergeLists(localItems, serverItems)
  useWishlistStore.getState().replace(merged)
}

export { wishlistKey }
export type { WishlistItem }
