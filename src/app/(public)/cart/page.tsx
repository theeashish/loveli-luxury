import { CartPageClient } from '@/components/cart/CartPageClient'

export const metadata = {
  title: 'Cart',
  robots: { index: false, follow: false },
}

// The cart is fully client-state; the route exists so users can deep-link
// or refresh, but the rendering work all happens after hydration.
export default function CartPage() {
  return <CartPageClient />
}
