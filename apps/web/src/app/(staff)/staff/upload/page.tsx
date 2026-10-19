import { requireStaff } from '@/lib/staff'
import { StaffShell } from '@/components/staff/StaffShell'
import { FastUpload } from '@/components/staff/FastUpload'
import { storageEnabled } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fast upload' }

/** Editors and managers: add many photos and videos at once. */
export default async function UploadPage() {
  const user = await requireStaff('admin', 'editor')
  return (
    <StaffShell user={user} title="Fast upload">
      <div className="max-w-3xl space-y-4 font-text text-body">
        <p>
          Choose or drop as many photos and videos as you like. They are sent all at the same time,
          straight to the file storage, and appear at the top of the Media / Videos list in the order
          you chose them.
        </p>
        {!storageEnabled() ? (
          <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
            File storage is not set up yet (S3_BUCKET is empty), so uploads cannot work.
          </p>
        ) : null}
      </div>
      <div className="mt-8 max-w-3xl">
        <FastUpload disabled={!storageEnabled()} />
      </div>
    </StaffShell>
  )
}
