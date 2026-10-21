import { Mail, MapPin, Phone, Send } from 'lucide-react'

/** Where "Get In Touch" leads (requested address). */
const GET_IN_TOUCH_URL = 'https://www.nordicaffairsmedia.com/home/'

type Contact = {
  contactEmail?: string | null
  contactPhone?: string | null
  location?: string | null
}

/**
 * "Let's Work Together" band at the bottom of the home page. It replaces the newsletter
 * sign-up band and matches the layout of the previous nordicaffairsmedia.com website:
 * paper-plane icon, heading, one line of text and a "Get In Touch" button on the left,
 * email / phone / location on the right.
 */
export function WorkTogetherPanel({ contact }: { contact: Contact }) {
  const phone = contact.contactPhone
  return (
    <section aria-label="Let's Work Together" className="border-t border-rule bg-fjord-wash">
      <div className="container-wide grid gap-8 py-14 md:grid-cols-12 md:items-start">
        <div className="flex items-start gap-5 md:col-span-7">
          <Send aria-hidden="true" className="mt-1 size-14 shrink-0 text-fjord" strokeWidth={1.25} />
          <div>
            <h2 className="text-h2">Let&apos;s Work Together</h2>
            <p className="mt-3 max-w-lg text-charcoal">
              For media inquiries, event coverage, and collaboration
            </p>
            <a
              href={GET_IN_TOUCH_URL}
              className="mt-5 inline-flex items-center rounded-[6px] border border-fjord px-5 py-2.5 font-medium text-fjord transition-colors hover:bg-fjord hover:text-snow"
            >
              Get In Touch
            </a>
          </div>
        </div>
        <ul className="space-y-3 md:col-span-5 md:justify-self-end">
          {contact.contactEmail ? (
            <li className="flex items-center gap-3">
              <Mail aria-hidden="true" className="size-5 shrink-0 text-fjord" />
              <a href={`mailto:${contact.contactEmail}`} className="hover:underline">
                {contact.contactEmail}
              </a>
            </li>
          ) : null}
          {phone ? (
            <li className="flex items-center gap-3">
              <Phone aria-hidden="true" className="size-5 shrink-0 text-fjord" />
              <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="hover:underline">
                {phone}
              </a>
            </li>
          ) : null}
          {contact.location ? (
            <li className="flex items-center gap-3">
              <MapPin aria-hidden="true" className="size-5 shrink-0 text-fjord" />
              {contact.location}
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}
