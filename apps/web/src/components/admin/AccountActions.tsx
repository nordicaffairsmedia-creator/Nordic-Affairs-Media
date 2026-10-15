'use client'

import { useAuth, useDocumentInfo } from '@payloadcms/ui'

/*
 * Shown on your own Account page: a clear "Log out" button and a short note on the two
 * language settings, so nobody has to hunt for them in the left menu.
 */
export function AccountActions() {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  if (!user || String(user.id) !== String(id)) return null
  return (
    <div className="nam-account">
      <div>
        <p className="nam-account__title">Signed in as {user.email}</p>
        <p className="nam-account__text">
          <strong>Language</strong> (below, under Payload Settings) changes the buttons and menus of
          this panel — English or Svenska. <strong>Content language</strong> (top right) chooses
          which translation of the website you are editing: English, Svenska, தமிழ் or മലയാളം.
        </p>
      </div>
      <a href="/admin/logout" className="nam-btn nam-btn--gold">
        Log out
      </a>
    </div>
  )
}
