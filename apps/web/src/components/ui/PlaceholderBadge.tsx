/**
 * Visible marker for development placeholder content (master prompt §41–42).
 * Deliberately loud so placeholder text can never be mistaken for real content.
 */
export function PlaceholderBadge({
  className = '',
  label = 'Placeholder',
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border border-placeholder bg-snow px-2 py-0.5 font-ui text-[0.6875rem] font-bold uppercase tracking-wider text-placeholder ${className}`}
    >
      {label}
    </span>
  )
}
