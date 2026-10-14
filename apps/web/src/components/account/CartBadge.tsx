'use client'

import { useEffect, useState } from 'react'
import { readCart } from '@/lib/cart'

/** Number of tickets in the cart, shown next to the Cart tab. Renders nothing when empty. */
export function CartBadge() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const read = () => setN(readCart()?.lines.reduce((s, x) => s + x.quantity, 0) ?? 0)
    read()
    window.addEventListener('nam-cart', read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener('nam-cart', read)
      window.removeEventListener('storage', read)
    }
  }, [])
  return n > 0 ? (
    <span data-testid="cart-badge" className="ml-2 inline-flex min-w-5 items-center justify-center rounded-pill bg-fjord px-1.5 font-ui text-meta font-semibold text-snow">
      {n}
    </span>
  ) : null
}
