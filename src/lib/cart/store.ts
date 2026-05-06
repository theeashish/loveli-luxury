'use client'

/**
 * Zustand cart store with localStorage persistence and cross-tab sync.
 *
 * Hydration:
 *   - On the server, lines start empty and cartId is ''. Components must check
 *     `useCartStore((s) => s.hasHydrated)` before rendering anything that
 *     would diverge between server and client (qty badges, totals).
 *   - On first hydration in the browser, a fresh `cartId` UUID is minted if
 *     the persisted state didn't carry one. The id remains stable across
 *     reloads and is the link to the future order row.
 *
 * Cross-tab sync:
 *   - The browser fires a 'storage' event on every other tab when localStorage
 *     changes. We rehydrate the store on that event so two tabs stay in sync.
 *   - The current tab does not receive its own 'storage' event; its in-memory
 *     state is already authoritative.
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { addLine, lineKey, removeLine, setQty } from './logic'
import type { CartLine, CartLineInput, CartState } from './types'

const STORAGE_KEY = 'loveli-cart-v1'

type CartActions = {
  add: (input: CartLineInput, qty?: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  openDrawer: () => void
  closeDrawer: () => void
  /** Becomes true after the persist middleware has finished its first read. */
  hasHydrated: boolean
}

type CartUiState = {
  isDrawerOpen: boolean
}

type Store = CartState & CartUiState & CartActions

// Server-side stub. localStorage is undefined during SSR.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useCartStore = create<Store>()(
  persist(
    (set) => ({
      cartId: '',
      lines: [],
      hasHydrated: false,
      isDrawerOpen: false,
      add: (input, qty = 1) => set((s) => ({ lines: addLine(s.lines, input, qty) })),
      setQty: (key, qty) => set((s) => ({ lines: setQty(s.lines, key, qty) })),
      remove: (key) => set((s) => ({ lines: removeLine(s.lines, key) })),
      clear: () => set({ lines: [] }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : window.localStorage,
      ),
      partialize: (s): CartState => ({ cartId: s.cartId, lines: s.lines }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.cartId) {
          state.cartId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : fallbackUuid()
        }
        state.hasHydrated = true
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useCartStore.persist.rehydrate()
  })
}

function fallbackUuid(): string {
  // Last-resort UUIDv4-ish for very old runtimes. crypto.randomUUID is
  // available in all browsers we target; this is just defensive.
  const r = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`
}

export { lineKey }
export type { CartLine, CartLineInput, CartState }
