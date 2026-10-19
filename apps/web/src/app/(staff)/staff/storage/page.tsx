import { requireStaff } from '@/lib/staff'
import { StaffShell } from '@/components/staff/StaffShell'
import { StorageCheck } from '@/components/staff/StorageCheck'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Storage check' }

/** SuperAdmin only: checks the photo/video bucket and repairs "Failed to fetch" on upload. */
export default async function StoragePage() {
  const user = await requireStaff()
  return (
    <StaffShell user={user} title="Photo & video storage check">
      <div className="max-w-3xl space-y-4 font-text text-body">
        <p>
          Use this page when a photo, video or document will not upload in the content manager
          (the message says <strong>Failed to fetch</strong>). It checks the storage bucket from this
          website, and can fix the bucket setting that blocks uploads.
        </p>
      </div>
      <div className="mt-8 max-w-3xl">
        <StorageCheck />
      </div>
    </StaffShell>
  )
}
