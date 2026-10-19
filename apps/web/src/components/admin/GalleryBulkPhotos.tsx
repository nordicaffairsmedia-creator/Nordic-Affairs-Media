'use client'

import { useRef, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { FastUpload } from '@/components/staff/FastUpload'

/**
 * "Add many photos at once" in the gallery editor. Choose or drop any number of photos: they go
 * straight to storage (resized in the browser, 8 at a time), land in the Media library, and are
 * put in the "Add many photos" box below. On Save / Publish the gallery adds them to the end of
 * the photo list in the order they were chosen — no more adding photos one by one.
 */
export function GalleryBulkPhotos() {
  const { value, setValue } = useField<(string | { id: string })[] | null>({ path: 'addPhotos' })
  const current = useRef(value)
  current.current = value
  const [added, setAdded] = useState(0)

  const onDone = (ids: string[]) => {
    const before = (current.current ?? []).map((v) => (typeof v === 'object' && v ? v.id : v))
    setValue([...before, ...ids])
    setAdded((n) => n + ids.length)
  }

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      <label className="field-label">Upload many photos at once</label>
      <FastUpload disabled={false} compact allowed={['media']} onDone={onDone} />
      {added > 0 ? (
        <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>
          {added} photo(s) uploaded and ready. Press <strong>Save Draft</strong> or <strong>Publish changes</strong> to
          add them to this gallery.
        </p>
      ) : (
        <p style={{ margin: '0.25rem 0 0', opacity: 0.75 }}>
          Select or drag as many photos as you like (hold Ctrl / ⌘ or Shift to pick many). They are added to the
          end of the photo list when you save.
        </p>
      )}
    </div>
  )
}
