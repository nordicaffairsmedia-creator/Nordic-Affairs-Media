/*
 * "Howdy, <name> · Log out" at the top right, as on the old WordPress panel. The name is
 * the Name saved on the signed-in person's own account (Account → Name).
 */
export function HeaderGreeting({ user }: { user?: unknown }) {
  const u = user as { name?: string | null } | undefined
  const name = u?.name?.trim()
  return (
    <span className="nam-howdy">
      {name ? <span>Howdy, {name}</span> : null}
      <a href="/admin/account" className="nam-howdy__link">
        Account
      </a>
      <a href="/admin/logout" className="nam-howdy__link">
        Log out
      </a>
    </span>
  )
}
