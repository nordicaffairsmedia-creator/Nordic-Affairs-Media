'use client'

import { useEffect } from 'react'
import { clearCart } from '@/lib/cart'

/** On the "booked" page the cart has been paid for, so it is emptied. */
export function ClearCart() {
  useEffect(() => clearCart(), [])
  return null
}
