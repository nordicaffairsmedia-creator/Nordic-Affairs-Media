import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Award,
  Camera,
  Crown,
  Eye,
  Globe,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient, isDoc } from '@/lib/payload'
import { getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { aboutFor } from '@/lib/i18n-content'
import { MediaImage } from '@/components/ui/MediaImage'
import { bebas, inter } from '@/lib/legacy-fonts'
import { ScrollEffects } from '@/components/motion/ScrollEffects'
import { storiesFor, storyPhotos } from '@/lib/about-stories'
import type { CSSProperties } from 'react'

/** Stagger index for [data-reveal] (n × 90 ms). */
const d = (n: number) => ({ '--d': n }) as CSSProperties

type Props = { params: Promise<{ locale: string }> }

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  crown: Crown,
  globe: Globe,
  users: Users,
  trophy: Trophy,
  sparkles: Sparkles,
  award: Award,
  eye: Eye,
  camera: Camera,
  'map-pin': MapPin,
}

/** CMS text where the editor filled it in, otherwise the old website's wording. */
async function getAbout(locale: Locale) {
  const payload = await getPayloadClient()
  // No English fallback here: an empty language shows the built-in translation instead.
  const g = await payload
    .findGlobal({
      slug: 'about-page',
      locale,
      fallbackLocale: false,
      depth: 1,
      overrideAccess: false,
    })
    .catch(() => null)
  const D = aboutFor(locale)
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)
  const list = <T,>(v: T[] | null | undefined, fallback: T[]) => (v && v.length ? v : fallback)
  return {
    title: str(g?.title, D.title),
    paragraphs: list(g?.paragraphs?.map((p) => p.text ?? '').filter(Boolean), D.paragraphs),
    image: g?.image && isDoc(g.image) ? g.image : null,
    expertiseEyebrow: str(g?.expertiseEyebrow, D.expertiseEyebrow),
    expertiseTitle: str(g?.expertiseTitle, D.expertiseTitle),
    expertise: list(
      g?.expertise
        ?.filter((e) => e.label)
        .map((e) => ({ label: e.label as string, icon: (e.icon ?? 'globe') as string })),
      D.expertise,
    ),
    eventsTitle: str(g?.eventsTitle, D.eventsTitle),
    eventsIntro: str(g?.eventsIntro, D.eventsIntro),
    events: list(g?.events?.map((e) => e.label ?? '').filter(Boolean), D.events),
    ministersTitle: str(g?.ministersTitle, D.ministersTitle),
    ministers: list(g?.ministers?.map((m) => m.name ?? '').filter(Boolean), D.ministers),
    ministersNote: str(g?.ministersNote, D.ministersNote),
    pillars: list(
      g?.pillars
        ?.filter((p) => p.title)
        .map((p) => ({
          title: p.title as string,
          text: p.text ?? '',
          icon: (p.icon ?? 'globe') as string,
        })),
      D.pillars,
    ),
    ctaTitle: str(g?.ctaTitle, D.ctaTitle),
    ctaText: str(g?.ctaText, D.ctaText),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const a = await getAbout(locale)
  return buildMetadata({
    locale,
    path: '/about-us',
    title: getDictionary(locale).navAbout,
    description: a.paragraphs[0],
  })
}

/** The old website's colours for this page. */
const BLUE = 'text-[#539ae6]'
const LIGHT_BLUE = 'text-[#6eabe4]'

function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Globe
  return <I aria-hidden="true" className={className} strokeWidth={1.5} />
}

/** The frame lines of the logo, drawn large and faint behind the page title. */
function FramePattern({ drift = false }: { drift?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-parallax={drift ? '0.18' : undefined}
      className="pointer-events-none absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 400"
      fill="none"
    >
      <g stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.5">
        <rect x="-40" y="40" width="300" height="180" />
        <rect x="290" y="40" width="380" height="180" />
        <rect x="-40" y="250" width="710" height="120" />
        <rect x="900" y="-30" width="260" height="160" />
        <rect x="860" y="160" width="400" height="220" />
      </g>
    </svg>
  )
}

/**
 * About Us — laid out like the old website (same sections, order, fonts and colours),
 * with the new site's workings underneath: every text editable in the CMS, four
 * languages, and gentle scroll animations.
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const [a, { settings }] = await Promise.all([getAbout(locale), getSiteChrome(locale)])
  const stats = settings.stats ?? []
  const press = settings.pressMentions ?? []
  const stories = storiesFor(locale)
  const heading = `${bebas.className} tracking-[1.2px] leading-none`

  return (
    <article className={`${inter.className} bg-[#0e2440] text-white`}>
      {/* Page banner: ABOUT US + breadcrumb, centred */}
      <header className="relative overflow-hidden bg-[linear-gradient(135deg,#05080f_0%,#1b2330_45%,#05080f_100%)]">
        <FramePattern drift />
        <div className="container-max relative py-20 text-center md:py-24">
          <h1 className={`${heading} rise-in text-[44px] md:text-[56px]`}>{t.navAbout}</h1>
          <nav aria-label="Breadcrumb" className="rise-in mt-4 text-[15px]" style={d(1)}>
            <Link href={href(locale, '/')} className="text-[#539ae6] hover:underline">
              {t.navHome}
            </Link>
            <span aria-hidden="true" className="mx-1.5 text-white/70">
              »
            </span>
            <span aria-current="page" className="text-white/90">
              {t.navAbout}
            </span>
          </nav>
        </div>
      </header>

      {/* Capturing History Through Excellence */}
      <section className="container-max py-16 md:py-24">
        <div
          className={
            a.image ? 'grid items-center gap-12 lg:grid-cols-12 lg:gap-16' : 'mx-auto max-w-4xl'
          }
        >
          <div className={a.image ? 'lg:col-span-7' : ''}>
            <h2 data-reveal="up" className={`${heading} text-[38px] md:text-[55px]`}>
              {a.title}
            </h2>
            <div className="mt-6 space-y-5">
              {a.paragraphs.map((p, i) => (
                <p
                  key={i}
                  data-reveal="up"
                  style={d(i + 1)}
                  className="text-[16px] leading-[29px] text-white md:text-[18px]"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
          {a.image ? (
            <div className="lg:col-span-5" data-reveal="right">
              <MediaImage media={a.image} ratio="4/5" sizes="(min-width: 1024px) 40vw, 100vw" />
            </div>
          ) : null}
        </div>
      </section>

      {/* Our Expertise — We proudly cover */}
      <section className="bg-white/[0.06]">
        <div className="container-max py-14 text-center md:py-16">
          <h2 data-reveal="up" className={`${heading} text-[30px] ${BLUE}`}>
            {a.expertiseEyebrow}
          </h2>
          <p data-reveal="up" style={d(1)} className="mt-2 text-[16px] text-white/60">
            {a.expertiseTitle}
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-6">
            {a.expertise.map((e, i) => (
              <li
                key={e.label}
                data-reveal="zoom"
                style={d(i)}
                className="group flex flex-col items-center gap-4"
              >
                <Icon
                  name={e.icon}
                  className="size-9 text-white transition-transform duration-500 group-hover:-translate-y-1 group-hover:text-[#539ae6]"
                />
                <span className="text-[16px] leading-6 text-white/60">{e.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Major Events Covered */}
      <section className="container-max py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 data-reveal="up" className={`${heading} text-[36px] md:text-[46px] ${BLUE}`}>
            {a.eventsTitle}
          </h2>
          <p
            data-reveal="up"
            style={d(1)}
            className="mt-5 text-[16px] leading-[31px] text-white md:text-[18px]"
          >
            {a.eventsIntro}
          </p>
          <ul className="mt-6 grid gap-x-12 gap-y-3 md:grid-cols-2">
            {a.events.map((e, i) => (
              <li
                key={e}
                data-reveal="up"
                style={d(i % 6)}
                className="flex gap-3 text-[16px] leading-7 text-white md:text-[17px]"
              >
                <span aria-hidden="true" className={`${BLUE} select-none`}>
                  *
                </span>
                {e}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Ministerial visits */}
      <section className="rounded-b-[30px] bg-white/[0.08]">
        <div className="container-max py-12 text-center md:py-14">
          <h2 data-reveal="up" className={`text-[24px] font-medium md:text-[32px] ${BLUE}`}>
            {a.ministersTitle}
          </h2>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {a.ministers.map((m, i) => (
              <li
                key={m}
                data-reveal="zoom"
                style={d(i)}
                className="inline-flex items-center gap-3 text-[20px] text-white md:text-[24px]"
              >
                <Sparkles aria-hidden="true" className="size-5 text-white" strokeWidth={1.5} />
                {m}
              </li>
            ))}
          </ul>
          <p data-reveal="up" className="mt-6 text-[16px] text-white">
            {a.ministersNote}
          </p>
        </div>
      </section>

      {/* Professional Standards · Our Vision · Based in Sweden */}
      <section className="container-max py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/40">
          {a.pillars.map((p, i) => (
            <div
              key={p.title}
              data-reveal="up"
              style={d(i)}
              className={i === 0 ? 'md:pr-8' : i === 2 ? 'md:pl-8' : 'md:px-8'}
            >
              <span className="inline-flex size-[65px] items-center justify-center rounded-full bg-[#539ae6] text-white">
                <Icon name={p.icon} className="size-9" />
              </span>
              <h3 className={`${bebas.className} mt-6 text-[26px] leading-tight tracking-[1.5px]`}>
                {p.title}
              </h3>
              <p className="mt-3 text-[16px] leading-6 text-[#bdbdbd]">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key figures band */}
      {stats.length ? (
        <section className="bg-[#194c76]">
          <dl className="container-max grid grid-cols-2 gap-y-10 py-12 text-center sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s, i) => (
              <div
                key={s.id ?? s.label}
                data-reveal="up"
                style={d(i)}
                className="flex flex-col-reverse items-center gap-2"
              >
                <dt className={`${bebas.className} text-[22px] leading-none md:text-[25px]`}>
                  {s.label}
                </dt>
                <dd
                  data-count
                  className={`${bebas.className} text-[46px] leading-none tracking-[1.6px] md:text-[55px] ${LIGHT_BLUE}`}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Our Visual Stories */}
      <section className="relative overflow-hidden">
        <div className="container-max relative py-16 md:py-24">
          <div className="text-center" data-reveal="up">
            <h2 className={`${bebas.className} text-[38px] leading-none tracking-[2.1px] md:text-[47px] ${LIGHT_BLUE}`}>
              {stories.eyebrow}
            </h2>
            <p className="mt-4 text-[20px] font-medium capitalize md:text-[26px]">{stories.title}</p>
          </div>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:items-start">
            {stories.items.map((item, i) => {
              const photo = storyPhotos[i]
              return (
                <li
                  key={item.title}
                  data-reveal="up"
                  style={d(i + 1)}
                  className={i % 2 === 1 ? 'lg:mt-20' : ''}
                >
                  <div className="group h-full overflow-hidden border border-white/10 bg-[#13294b] transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1.5 hover:border-[#539ae6]/60 hover:shadow-2xl">
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#0b1d36]">
                      {photo ? (
                        <div data-parallax="0.06" className="absolute -inset-[8%]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.src}
                            width={photo.width}
                            height={photo.height}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="settle size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                            style={{ objectPosition: photo.focus }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="p-5 md:p-6">
                      <h3 className={`${bebas.className} text-[26px] leading-tight tracking-[1.2px] text-white`}>
                        {item.title}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="mt-3 block h-px w-10 bg-[#539ae6] transition-[width] duration-700 group-hover:w-20"
                      />
                      <p className="mt-3 text-[14px] leading-[21px] text-white">{item.text}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Press releases */}
      {press.length ? (
        <section className="container-max pb-16 md:pb-24">
          <div className="text-center" data-reveal="up">
            <h2 className={`${bebas.className} text-[38px] leading-none tracking-[2.1px] md:text-[47px] ${LIGHT_BLUE}`}>
              {t.pressTitle}
            </h2>
            <p className="mt-4 text-[20px] font-medium md:text-[26px]">{t.pressSub}</p>
          </div>
          {/* As on the old site: the white logo tiles themselves, six in a row, the last row
              centred, 30 px apart. */}
          <ul className="mx-auto mt-10 flex max-w-[1300px] flex-wrap justify-center gap-x-4 gap-y-6 sm:gap-x-[30px] sm:gap-y-10">
            {press.map((p, i) => {
              const logo = isDoc(p.logo) ? p.logo : null
              return (
                <li
                  key={p.id ?? p.url}
                  data-reveal="up"
                  style={d(i % 6)}
                  className="w-[calc((100%-16px)/2)] sm:w-[calc((100%-60px)/3)] md:w-[calc((100%-90px)/4)] lg:w-[calc((100%-150px)/6)]"
                >
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={p.outlet}
                    className="block overflow-hidden rounded-lg transition-transform duration-300 hover:-translate-y-1"
                  >
                    {logo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo.url}
                        alt={p.outlet}
                        loading="lazy"
                        width={logo.width ?? undefined}
                        height={logo.height ?? undefined}
                        className="block h-auto w-full rounded-lg bg-white"
                      />
                    ) : (
                      <span className="flex aspect-[185/80] items-center justify-center rounded-lg bg-white px-3 text-center text-[15px] font-medium text-[#0e2440]">
                        {p.outlet}
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* Let's work together */}
      <section className="border-t border-white/10">
        <div
          data-reveal="up"
          className="container-max flex flex-col gap-8 py-14 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-start gap-5">
            <Send aria-hidden="true" className="mt-1 size-12 shrink-0 text-[#539ae6]" strokeWidth={1.25} />
            <div>
              <h2 className={`${heading} text-[34px] md:text-[40px]`}>{a.ctaTitle}</h2>
              <p className="mt-2 text-[16px] text-white/80">{a.ctaText}</p>
              <Link
                href={href(locale, '/contact')}
                className={`${bebas.className} mt-5 inline-flex min-h-11 items-center rounded-[4px] border-2 border-[#539ae6] px-5 text-[20px] tracking-[0.5px] text-white transition-colors hover:bg-[#539ae6]`}
              >
                {t.navContact}
              </Link>
            </div>
          </div>
          <ul className="space-y-3 text-[16px]">
            {settings.contactEmail ? (
              <li className="flex items-center gap-3">
                <Mail aria-hidden="true" className="size-5 text-[#539ae6]" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:underline">
                  {settings.contactEmail}
                </a>
              </li>
            ) : null}
            {settings.contactPhone ? (
              <li className="flex items-center gap-3">
                <Phone aria-hidden="true" className="size-5 text-[#539ae6]" />
                <a href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`} className="hover:underline">
                  {settings.contactPhone}
                </a>
              </li>
            ) : null}
            {settings.location ? (
              <li className="flex items-center gap-3">
                <MapPin aria-hidden="true" className="size-5 text-[#539ae6]" />
                {settings.location}
              </li>
            ) : null}
          </ul>
        </div>
      </section>
      <ScrollEffects />
    </article>
  )
}
