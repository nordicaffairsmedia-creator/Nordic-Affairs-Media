/**
 * Shown above the Media and Videos lists: the quick way to add many files at once.
 * (The built-in "Bulk Upload" processes files one after another on the server and shows
 * "uploading 1 of 30"; this one sends them all at the same time, straight to storage.)
 */
export function FastUploadBanner() {
  return (
    <p style={{ margin: '0 0 1rem' }}>
      <a
        href="/staff/upload"
        style={{
          display: 'inline-block',
          padding: '0.55rem 1rem',
          border: '1px solid currentColor',
          borderRadius: 4,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Fast upload — many photos and videos at once →
      </a>
    </p>
  )
}
