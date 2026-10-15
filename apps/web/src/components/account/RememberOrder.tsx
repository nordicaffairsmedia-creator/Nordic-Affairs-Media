'use client'

import { useEffect } from 'react'
import { rememberOrder } from '@/lib/myOrders'

/** On the "booked" page: keep this order under My tickets on this device. */
export function RememberOrder({ orderRef, token }: { orderRef: string; token: string }) {
  useEffect(() => rememberOrder(orderRef, token), [orderRef, token])
  return null
}
