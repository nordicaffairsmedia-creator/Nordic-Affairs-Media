/**
 * Orders bought on this device. The thank-you page saves each paid order's reference and
 * secret link token here, so "My tickets" can show them at once without any sign-in.
 */
const KEY = 'nam-my-orders'
export type SavedOrder = { ref: string; token: string; savedAt: number }

export function readMyOrders(): SavedOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as SavedOrder[]) : []
    return Array.isArray(list) ? list.filter((o) => o && o.ref && o.token) : []
  } catch {
    return []
  }
}

export function rememberOrder(ref: string, token: string): void {
  try {
    const rest = readMyOrders().filter((o) => o.ref !== ref)
    window.localStorage.setItem(KEY, JSON.stringify([{ ref, token, savedAt: Date.now() }, ...rest].slice(0, 50)))
  } catch {
    /* storage blocked: the order is still reachable from the e-mail link */
  }
}

export function forgetOrder(ref: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(readMyOrders().filter((o) => o.ref !== ref)))
  } catch {
    /* nothing to do */
  }
}
