/** Name of the tracking link the visitor came through (set by /api/go/<name>), or undefined. Browser only. */
export function readTrackingSource(): string | undefined {
  try {
    const m = document.cookie.match(/(?:^|; )nam_src=([a-z0-9-]{1,60})/)
    return m ? m[1] : undefined
  } catch {
    return undefined
  }
}
