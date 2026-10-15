import { MessageCircle } from 'lucide-react'

/** "Enquire Now" — opens a WhatsApp chat with the agency in a new tab. */
export function EnquireButton({
  href,
  label,
  className = '',
}: {
  href: string
  label: string
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center gap-2 border border-fjord-deep bg-fjord-wash px-5 font-ui text-caption font-semibold uppercase tracking-[0.06em] text-ink hover:bg-fjord-deep hover:text-snow ${className}`}
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      {label}
    </a>
  )
}
