/** Short guide above the editable email text. */
export function AbandonedTextHelp() {
  return (
    <div style={{ margin: '16px 0 4px' }}>
      <strong>The email text</strong>
      <p style={{ opacity: 0.75, margin: '6px 0 0' }}>
        Change the words below, then click Save. The preview and the test email use what you saved. In your text you can write <code>{'{name}'}</code> (the buyer&apos;s first name), <code>{'{event}'}</code> (the event) and <code>{'{code}'}</code> (the discount code). A blank line starts a new paragraph.
        If you set a discount below and do not write <code>{'{code}'}</code>, a line with the code is added at the end. The button, and the link to stop emails, are always included. Empty a box to go back to the standard text.
      </p>
    </div>
  )
}
