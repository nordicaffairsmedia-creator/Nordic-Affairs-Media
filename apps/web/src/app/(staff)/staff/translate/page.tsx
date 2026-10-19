import { requireStaff } from '@/lib/staff'
import { translationReady } from '@/lib/translate'
import { StaffShell } from '@/components/staff/StaffShell'
import { TranslateRunner } from '@/components/staff/TranslateRunner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Translate' }

/** SuperAdmin only: fills Swedish, Tamil and Malayalam text of galleries and stories. */
export default async function TranslatePage() {
  const user = await requireStaff()
  const ready = translationReady()
  return (
    <StaffShell user={user} title="Translate galleries and stories">
      <div className="max-w-3xl space-y-4 font-text text-body">
        <p>
          Menus, buttons, the About page, the footer and key figures are already translated. This
          fills in the rest — every gallery&apos;s title and description and every story — in
          Swedish, Tamil and Malayalam, so the whole page changes when a visitor switches language.
        </p>
        <ul className="list-disc space-y-1 pl-6 font-ui text-caption text-charcoal">
          <li>
            Only empty language fields are filled. Text you have written or corrected is never
            replaced.
          </li>
          <li>
            It is machine translation: ask a native speaker to read the important pages and correct
            them in the content manager (switch “Locale” at the top right).
          </li>
          <li>Run it again after adding new galleries or stories.</li>
        </ul>
        {!ready ? (
          <p role="alert" className="border-l-2 border-alert pl-4 font-ui text-caption text-alert">
            No translation key is set. Add GEMINI_API_KEY (free) or OPENAI_API_KEY in the website's environment settings.
          </p>
        ) : null}
      </div>
      <div className="mt-10">
        <TranslateRunner disabled={!ready} />
      </div>
    </StaffShell>
  )
}
