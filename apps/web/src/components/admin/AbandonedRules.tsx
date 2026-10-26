/** The promises the reminder keeps. */
export function AbandonedRules() {
  const rules: [string, string][] = [
    ['One email per buyer and event.', 'Never more, however many times they leave.'],
    ['Only people who said yes.', 'Buyers who ticked the marketing box at checkout. Anyone who unsubscribed is skipped.'],
    ['Not sent', 'if the buyer already bought, or the event has started.'],
    ['Only about the purchase.', 'The email is about the tickets they left and nothing else, and has a link to stop further ones.'],
  ]
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
      {rules.map(([a, b]) => (
        <li key={a} style={{ margin: '6px 0' }}>
          <span style={{ color: 'var(--theme-success-500)' }}>✓ </span>
          <strong>{a}</strong> <span style={{ opacity: 0.8 }}>{b}</span>
        </li>
      ))}
    </ul>
  )
}
