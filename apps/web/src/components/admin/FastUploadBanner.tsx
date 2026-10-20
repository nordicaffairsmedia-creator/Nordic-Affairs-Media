'use client'

import { FastUpload, type Kind } from '@/components/staff/FastUpload'

/**
 * Replaces Payload's own "Bulk Upload" (one file after another through the server, "uploading 1 of
 * 30") on the Media, Videos and Documents lists: choose or drop any number of files and they all go
 * straight to storage at the same time; the list then reloads with the new files on page 1.
 */
function ListUpload({ kind, path }: { kind: Kind; path: string }) {
  return <FastUpload disabled={false} compact allowed={[kind]} listPath={path} />
}

export const MediaListUpload = () => <ListUpload kind="media" path="/admin/collections/media" />
export const VideosListUpload = () => <ListUpload kind="videos" path="/admin/collections/videos" />
export const DocumentsListUpload = () => <ListUpload kind="documents" path="/admin/collections/documents" />
