/**
 * Plain share links — no third-party scripts, no tracking pixels, nothing to consent to.
 * These are public share endpoints, not claims that the publication has these accounts.
 */
export function ShareLinks({ url, title, label }: { url: string; title: string; label: string }) {
  const u = encodeURIComponent(url)
  const tt = encodeURIComponent(title)
  const targets = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${tt}%20${u}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: 'X', href: `https://x.com/intent/post?url=${u}&text=${tt}` },
    { name: 'Email', href: `mailto:?subject=${tt}&body=${u}` },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="eyebrow text-slate">{label}</span>
      {targets.map((t) => (
        <a
          key={t.name}
          href={t.href}
          target={t.name === 'Email' ? undefined : '_blank'}
          rel="noopener noreferrer"
          className="font-ui text-meta font-semibold text-fjord hover:text-fjord-deep hover:underline"
        >
          {t.name}
        </a>
      ))}
    </div>
  )
}
