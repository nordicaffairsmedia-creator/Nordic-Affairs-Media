'use client'

import { Button, useDocumentInfo, useForm, useFormProcessing, useTranslation } from '@payloadcms/ui'

/**
 * Payload's own Save button stays disabled while the form is still syncing with the server in the
 * background — and on a slow server that is several seconds, during which every click is ignored
 * (which looked like "Save only works after five clicks"). This one reacts to the first click,
 * and says "Saving…" while the save runs, so it is always clear that the click was received.
 */
export function InstantSave() {
  const { submit } = useForm()
  const processing = useFormProcessing()
  const { uploadStatus } = useDocumentInfo()
  const { t } = useTranslation()
  const busy = processing || uploadStatus === 'uploading'
  return (
    <Button
      id="action-save"
      buttonStyle="primary"
      size="medium"
      type="button"
      disabled={busy}
      onClick={() => {
        if (!busy) void submit()
      }}
    >
      {busy ? 'Saving…' : t('general:save')}
    </Button>
  )
}
