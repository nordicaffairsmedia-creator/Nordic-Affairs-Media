'use client'

import { useEffect } from 'react'
import { FastUpload, type Kind } from '@/components/staff/FastUpload'

/**
 * Replaces Payload's own "Bulk Upload" (one file after another through the server, "uploading 1 of
 * 30") on the Media, Videos and Documents lists: choose or drop any number of files and they all go
 * straight to storage at the same time; the list then reloads with the new files on page 1.
 */
function ListUpload({ kind, path }: { kind: Kind; path: string }) {
  useEffect(() => {
    // The list used to be sorted by hand-made position (sort=_order); a saved copy of that link
    // would hide new files on the last page. Switch it to newest first once.
    const url = new URL(window.location.href)
    if (url.searchParams.get('sort') === '_order') {
      url.searchParams.set('sort', '-createdAt')
      url.searchParams.set('page', '1')
      url.searchParams.set('limit', '25')
      window.location.replace(url.toString())
    }
  }, [])
  return <FastUpload disabled={false} compact allowed={[kind]} listPath={path} />
}

export const MediaListUpload = () => <ListUpload kind="media" path="/admin/collections/media" />
export const VideosListUpload = () => <ListUpload kind="videos" path="/admin/collections/videos" />
export const DocumentsListUpload = () => <ListUpload kind="documents" path="/admin/collections/documents" />
