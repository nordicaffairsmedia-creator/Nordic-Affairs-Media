import { requireStaff } from '@/lib/staff'
import { StaffShell } from '@/components/staff/StaffShell'
import { ImportRunner } from '@/components/staff/ImportRunner'
import { WP_BASE, storageReady } from '@/lib/wordpress/importer'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Import old website' }

/** SuperAdmin only: moves the WordPress site's galleries, stories and settings into the CMS. */
export default async function ImportPage() {
  const user = await requireStaff()
  const storage = storageReady()
  return (
    <StaffShell user={user} title="Import from the old website">
      <div className="max-w-3xl space-y-4 font-text text-body">
        <p>
          This copies everything from <strong>{WP_BASE.replace(/^https?:\/\//, '')}</strong> into
          the new site: every photo gallery (with all photos), the video stories, the About page,
          contact details, press logos and the old web addresses (so Google and old links keep
          working).
        </p>
        <ul className="list-disc space-y-1 pl-6 font-ui text-caption text-charcoal">
          <li>The old site is only read, never changed.</li>
          <li>
            It moves a few photos at a time. About 3,300 photos can take one to several hours — keep
            this tab open. You can stop and press Start again later; it continues where it left off
            and never copies a photo twice.
          </li>
          <li>Anything already edited in the CMS is not overwritten.</li>
        </ul>
        {!storage.ok ? (
          <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
            {storage.message}
          </p>
        ) : null}
      </div>
      <div className="mt-10">
        <ImportRunner disabled={!storage.ok} />
      </div>
    </StaffShell>
  )
}
