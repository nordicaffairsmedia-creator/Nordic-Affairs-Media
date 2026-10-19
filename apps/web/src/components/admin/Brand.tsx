/* Brand graphics for the content manager (Payload admin): same gold logo and crest as the website. */

/** Large logo on the sign-in screen. */
export function Logo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/nam-logo-gold-480.png" alt="Nordic Affairs Media" width={180} height={123} />
      <span className="nam-admin-eyebrow">Content manager</span>
    </div>
  )
}

/** Small crest in the top corner of every admin screen. */
export function Icon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/nam-crest-gold-144.png" alt="Nordic Affairs Media" width={28} height={29} />
  )
}
