'use client'

import dynamic from 'next/dynamic'

const WhatsAppConcierge = dynamic(
  () => import('@/components/concierge/WhatsAppConcierge').then((m) => m.WhatsAppConcierge),
  { ssr: false, loading: () => null },
)

const WishlistHydrator = dynamic(
  () => import('@/components/wishlist/WishlistHydrator').then((m) => m.WishlistHydrator),
  { ssr: false, loading: () => null },
)

export function PublicDeferredWidgets() {
  return (
    <>
      <WhatsAppConcierge />
      <WishlistHydrator />
    </>
  )
}
