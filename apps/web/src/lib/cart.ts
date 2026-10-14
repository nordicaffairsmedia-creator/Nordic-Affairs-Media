/**
 * The My Booking cart: tickets (and an optional promo code) for ONE event, kept in this browser so a
 * buyer can come back and check out. Nothing is reserved until they pay.
 */
export type CartLine = { tierId: string; name: string; unitPrice: number; quantity: number }
export type Cart = {
  eventId: string
  eventSlug: string
  eventTitle: string
  currency: string
  locale: string
  lines: CartLine[]
  promoCode?: string
  savedAt: number
}

const KEY = 'nam-cart-v1'
const MAX_AGE_MS = 24 * 3600_000

export function readCart(): Cart | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cart
    if (!c || !Array.isArray(c.lines) || c.lines.length === 0) return null
    if (Date.now() - c.savedAt > MAX_AGE_MS) return null
    return c
  } catch {
    return null
  }
}

export function saveCart(cart: Omit<Cart, 'savedAt'>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...cart, savedAt: Date.now() }))
    window.dispatchEvent(new Event('nam-cart'))
  } catch {
    /* private mode: the checkout still works, only the Cart tab stays empty */
  }
}

export function clearCart(): void {
  try {
    window.localStorage.removeItem(KEY)
    window.dispatchEvent(new Event('nam-cart'))
  } catch {
    /* nothing to clear */
  }
}
