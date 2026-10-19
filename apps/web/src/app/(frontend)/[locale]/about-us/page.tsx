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
  ArrowRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { isLocale, type Locale } from '@/i18n/config'
import { getDictionary } from '@/i18n/getDictionary'
import { getPayloadClient, isDoc } from '@/lib/payload'
import { getSiteChrome } from '@/lib/queries'
import { buildMetadata } from '@/lib/seo'
import { href } from '@/lib/site'
import { aboutFor, localizedSettings } from '@/lib/i18n-content'
import { pressMentions as defaultPressMentions } from '@/lib/wordpress/content'
import { MediaImage } from '@/components/ui/MediaImage'
import { PublicationCard } from '@/components/editorial/PublicationCard'
import { listPublications } from '@/lib/listings'
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
    paragraphs: list(g?.paragraphs?.map((p: any) => p.text ?? '').filter(Boolean), D.paragraphs),
    image: g?.image && isDoc(g.image) ? g.image : null,
    expertiseEyebrow: str(g?.expertiseEyebrow, D.expertiseEyebrow),
    expertiseTitle: str(g?.expertiseTitle, D.expertiseTitle),
    expertise: list(
      g?.expertise
        ?.filter((e: any) => e.label)
        .map((e: any) => ({ label: e.label as string, icon: (e.icon ?? 'globe') as string })),
      D.expertise,
    ),
    eventsTitle: str(g?.eventsTitle, D.eventsTitle),
    eventsIntro: str(g?.eventsIntro, D.eventsIntro),
    events: list(g?.events?.map((e: any) => e.label ?? '').filter(Boolean), D.events),
    ministersTitle: str(g?.ministersTitle, D.ministersTitle),
    ministers: list(g?.ministers?.map((m: any) => m.name ?? '').filter(Boolean), D.ministers),
    ministersNote: str(g?.ministersNote, D.ministersNote),
    pillars: list(
      g?.pillars
        ?.filter((p: any) => p.title)
        .map((p: any) => ({
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

/** The website's signature blue palette for headings & accents. */
const BLUE = 'text-[#539ae6]'
const LIGHT_BLUE = 'text-[#6eabe4]'

function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Globe
  return <I aria-hidden="true" className={className} strokeWidth={1.5} />
}

/** Animated emojis for the expertise boxes matching diplomatic categories */
const EXPERTISE_EMOJIS: Record<string, { emoji: string; animClass: string }> = {
  landmark: { emoji: '🏛️', animClass: 'animate-emoji-float' },
  crown: { emoji: '👑', animClass: 'animate-emoji-sway' },
  globe: { emoji: '🌐', animClass: 'animate-emoji-pulse' },
  users: { emoji: '🤝', animClass: 'animate-emoji-bounce' },
  trophy: { emoji: '🏆', animClass: 'animate-emoji-bounce' },
  sparkles: { emoji: '✨', animClass: 'animate-emoji-twinkle' },
  award: { emoji: '🎖️', animClass: 'animate-emoji-float' },
  camera: { emoji: '📸', animClass: 'animate-emoji-pulse' },
  eye: { emoji: '👁️', animClass: 'animate-emoji-float' },
  'map-pin': { emoji: '📍', animClass: 'animate-emoji-bounce' },
}

function ExpertiseEmoji({ name, label }: { name: string; label: string }) {
  const item = EXPERTISE_EMOJIS[name] ?? { emoji: '🌐', animClass: 'animate-emoji-float' }
  return (
    <span
      className={`text-[22px] sm:text-[24px] leading-none select-none inline-block filter drop-shadow-md ${item.animClass} transition-transform duration-300 group-hover:scale-110`}
      role="img"
      aria-label={label}
    >
      {item.emoji}
    </span>
  )
}

/** Animated emojis for the core institutional pillar boxes */
function PillarEmoji({ icon, title }: { icon: string; title: string }) {
  const lower = title.toLowerCase()
  let emoji = '🌐'
  let animClass = 'animate-emoji-pulse'

  if (icon === 'award' || lower.includes('standard') || lower.includes('profession') || lower.includes('accredit')) {
    emoji = '🎖️'
    animClass = 'animate-emoji-float'
  } else if (icon === 'eye' || lower.includes('vision') || lower.includes('sight')) {
    emoji = '👁️'
    animClass = 'animate-emoji-pulse'
  } else if (icon === 'globe' || lower.includes('sweden') || lower.includes('world') || lower.includes('global')) {
    emoji = '🌍'
    animClass = 'animate-emoji-bounce'
  } else if (EXPERTISE_EMOJIS[icon]) {
    emoji = EXPERTISE_EMOJIS[icon].emoji
    animClass = EXPERTISE_EMOJIS[icon].animClass
  }

  return (
    <span
      className={`text-[24px] sm:text-[26px] leading-none select-none inline-block filter drop-shadow-md ${animClass} transition-transform duration-300 group-hover:scale-110`}
      role="img"
      aria-label={title}
    >
      {emoji}
    </span>
  )
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
 * Formats the headline exactly like the reference design:
 * "CAPTURING" in pure white, "HISTORY THROUGH" in sky-blue-to-pink gradient,
 * and "EXCELLENCE" in pure white on the next line.
 */
function FormattedHeroTitle({ title, className }: { title: string; className?: string }) {
  const enRegex = /^(Capturing)\s+(History\s+Through)\s+(Excellence)$/i
  const enMatch = title.trim().match(enRegex)

  const gradientStyle = {
    backgroundImage:
      'linear-gradient(90deg, #3bb2f8 0%, #569dfa 25%, #937ef6 55%, #c070f4 78%, #ff72a5 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  }

  if (enMatch) {
    return (
      <h2 data-reveal="up" className={className}>
        <span className="text-white drop-shadow-sm">{enMatch[1]} </span>
        <span
          className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#937ef6] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
          style={gradientStyle}
        >
          {enMatch[2]}
        </span>
        <span className="block text-white mt-0.5 sm:mt-1 drop-shadow-sm">{enMatch[3]}</span>
      </h2>
    )
  }

  const svRegex = /^(Vi fångar)\s+(historien\s+med)\s+(kvalitet)$/i
  const svMatch = title.trim().match(svRegex)
  if (svMatch) {
    return (
      <h2 data-reveal="up" className={className}>
        <span className="text-white drop-shadow-sm">{svMatch[1]} </span>
        <span
          className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#937ef6] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
          style={gradientStyle}
        >
          {svMatch[2]}
        </span>
        <span className="block text-white mt-0.5 sm:mt-1 drop-shadow-sm">{svMatch[3]}</span>
      </h2>
    )
  }

  const words = title.trim().split(/\s+/)
  if (words.length >= 3) {
    const first = words[0]
    const last = words[words.length - 1]
    const middle = words.slice(1, words.length - 1).join(' ')
    return (
      <h2 data-reveal="up" className={className}>
        <span className="text-white drop-shadow-sm">{first} </span>
        <span
          className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#937ef6] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
          style={gradientStyle}
        >
          {middle}
        </span>
        <span className="block text-white mt-0.5 sm:mt-1 drop-shadow-sm">{last}</span>
      </h2>
    )
  }

  return (
    <h2 data-reveal="up" className={className}>
      <span className="text-white drop-shadow-sm">{title}</span>
    </h2>
  )
}

/**
 * Formats "OUR EXPERTISE" headline matching the reference design:
 * "OUR" in solid white, "EXPERTISE" in sky-blue-to-pink gradient,
 * glowing cyan-to-gold underline directly below EXPERTISE,
 * followed by "• WE PROUDLY COVER •" with glowing cyan and purple dots.
 */
function FormattedExpertiseHeader({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string
  title: string
  className?: string
}) {
  const words = eyebrow.trim().split(/\s+/)
  const firstWord = words[0] ?? eyebrow
  const restWords = words.slice(1).join(' ')

  return (
    <div className="flex flex-col items-center text-center">
      <h2 data-reveal="up" className={className}>
        <span className="text-white drop-shadow-sm">{firstWord} </span>
        {restWords ? (
          <span
            className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#a470f5] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #3bb2f8 0%, #689df9 28%, #a470f5 62%, #ff72a5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {restWords}
          </span>
        ) : null}
      </h2>

      {/* Subtitle: WE PROUDLY COVER without dots */}
      <p
        data-reveal="up"
        style={d(1)}
        className="mt-3 text-[13px] sm:text-[15px] font-semibold tracking-[3px] uppercase text-white/85"
      >
        {title}
      </p>
    </div>
  )
}

/** Formats section titles with the first word in solid white and remaining words in the signature gradient */
function FormattedTwoToneTitle({ title, className }: { title: string; className?: string }) {
  const words = title.trim().split(/\s+/)
  const firstWord = words[0] ?? title
  const restWords = words.slice(1).join(' ')

  return (
    <h2 data-reveal="up" className={className}>
      {restWords ? (
        <>
          <span className="text-white drop-shadow-sm">{firstWord} </span>
          <span
            className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#a470f5] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #3bb2f8 0%, #689df9 28%, #a470f5 62%, #ff72a5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {restWords}
          </span>
        </>
      ) : (
        <span
          className="inline-block bg-gradient-to-r from-[#3bb2f8] via-[#a470f5] to-[#ff72a5] bg-clip-text text-transparent drop-shadow-sm"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #3bb2f8 0%, #689df9 28%, #a470f5 62%, #ff72a5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {firstWord}
        </span>
      )}
    </h2>
  )
}

const FormattedEventsTitle = FormattedTwoToneTitle

/** Formats Ministerial Visits heading with Bricolage Grotesque, two-tone color pattern, and word merge animation */
function MinisterialHeading({ title }: { title: string }) {
  const words = title.trim().split(/\s+/)
  const isEn =
    words.length >= 4 &&
    words[0]?.toLowerCase() === 'ministerial' &&
    words[1]?.toLowerCase() === 'visits'

  const whiteWords = isEn ? words.slice(0, 2) : words.slice(0, 1)
  const gradientWords = isEn ? words.slice(2) : words.slice(1)

  const allWords = [...whiteWords, ...gradientWords]
  const total = allWords.length
  const center = (total - 1) / 2

  return (
    <h2
      data-reveal="up"
      style={d(1)}
      className="font-bricolage mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[32px] font-extrabold uppercase tracking-[1px] leading-[1.1] sm:text-[42px] md:text-[52px] lg:text-[58px]"
    >
      {/* Subject words in pure white with subtle drop-shadow */}
      {whiteWords.map((word, idx) => {
        const offset = Math.round((idx - center) * 26)
        return (
          <span
            key={`w-${idx}`}
            className="animate-word-merge font-bricolage inline-block text-white drop-shadow-sm transition-transform duration-300 hover:scale-105"
            style={
              {
                '--merge-x': `${offset}px`,
                '--w-delay': idx,
              } as CSSProperties
            }
          >
            {word}
          </span>
        )
      })}

      {/* Prepositional/context words in signature two-tone multi-color gradient */}
      {gradientWords.map((word, idx) => {
        const globalIdx = whiteWords.length + idx
        const offset = Math.round((globalIdx - center) * 26)
        const posPercent =
          gradientWords.length > 1
            ? Math.round((idx / (gradientWords.length - 1)) * 100)
            : 50

        return (
          <span
            key={`g-${idx}`}
            className="animate-word-merge font-bricolage inline-block drop-shadow-sm transition-transform duration-300 hover:scale-105"
            style={
              {
                '--merge-x': `${offset}px`,
                '--w-delay': globalIdx,
                backgroundImage:
                  'linear-gradient(90deg, #3bb2f8 0%, #689df9 28%, #a470f5 62%, #ff72a5 100%)',
                backgroundSize: `${gradientWords.length * 100}% 100%`,
                backgroundPosition: `${posPercent}% 0%`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              } as CSSProperties
            }
          >
            {word}
          </span>
        )
      })}
    </h2>
  )
}

/**
 * About Us — Enhanced with high-fidelity glassmorphism, refined editorial typography,
 * interactive card elevations, and authentic diplomatic accents, while keeping the
 * exact content and signature Nordic navy background intact.
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  const [a, { settings }, issues] = await Promise.all([
    getAbout(locale),
    getSiteChrome(locale),
    // Every issue the team publishes in the CMS (newest first) appears in the Publications section below.
    listPublications(locale, null, 1).then((r) => r.docs).catch(() => []),
  ])
  const defaultStats = [
    { id: '1', value: '10+', label: 'Years of Excellence' },
    { id: '2', value: '500+', label: 'Global Events Covered' },
    { id: '3', value: '50+', label: 'International Assignments' },
    { id: '4', value: '100+', label: 'Trusted Partnerships' },
    { id: '5', value: '24/7', label: 'Media Coverage Support' },
  ]
  const stats =
    settings.stats && settings.stats.length === 5
      ? settings.stats
      : localizedSettings({ stats: defaultStats } as any, locale).stats ?? defaultStats
  const press =
    settings.pressMentions && settings.pressMentions.length >= 20
      ? settings.pressMentions
      : defaultPressMentions.map((p: any, i: number) => ({
          id: String(i + 1),
          outlet: p.outlet,
          url: p.url,
          logo: { id: String(i + 1), url: p.logo, alt: p.outlet },
        }))
  const stories = storiesFor(locale)
  const heading = `${bebas.className} tracking-[1.4px] leading-none`

  return (
    <article className={`${inter.className} bg-[#0e2440] text-white selection:bg-[#539ae6]/30`}>
      {/* Only this page uses the Bricolage font, so only this page loads it. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"
        precedence="default"
      />
      {/* 1. Page banner: ABOUT US + breadcrumb, with user's about us background.jpg */}
      <header className="relative overflow-hidden border-b border-white/10 bg-[#0e2440]">
        {/* User-supplied background image with elegant cinematic gradient overlay */}
        <div aria-hidden="true" className="absolute inset-0 size-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/about-us-background.jpg"
            alt="About Us Banner Background"
            className="size-full object-cover object-center"
          />
          {/* Clean, light vignette so image details remain 100% sharp and clear */}
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#0e2440]/80" />
        </div>

        <div className="container-max relative z-10 py-20 text-center md:py-28">
          <h1
            className={`${heading} rise-in text-[50px] sm:text-[64px] md:text-[80px] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]`}
          >
            {t.navAbout}
          </h1>

          <nav
            aria-label="Breadcrumb"
            className="rise-in mt-12 sm:mt-14 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-5 py-2 text-[14px] backdrop-blur-md shadow-md"
            style={d(1)}
          >
            <Link href={href(locale, '/')} className="text-[#539ae6] hover:text-white transition-colors">
              {t.navHome}
            </Link>
            <span aria-hidden="true" className="text-white/40">
              /
            </span>
            <span aria-current="page" className="text-white/90 font-medium">
              {t.navAbout}
            </span>
          </nav>
        </div>
      </header>

      {/* 2. Capturing History Through Excellence */}
      <section className="container-max py-20 md:py-28">
        <div
          className={
            a.image ? 'grid items-center gap-12 lg:grid-cols-12 lg:gap-16' : 'mx-auto max-w-4xl'
          }
        >
          <div className={a.image ? 'lg:col-span-7' : ''}>

            <div className="relative mb-6">
              {/* Subtle blueprint grid matching the reference screenshot */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-y-3 -inset-x-5 rounded-2xl bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_90%_80%_at_40%_50%,#000_60%,transparent_100%)] opacity-80"
              />
              <FormattedHeroTitle
                title={a.title}
                className={`${heading} relative text-[46px] sm:text-[60px] md:text-[72px] lg:text-[80px] leading-[0.94] tracking-[1.4px]`}
              />
            </div>

            <div className="mt-8 space-y-5">
              {a.paragraphs.map((p, i) => (
                <div
                  key={i}
                  data-reveal="up"
                  style={d(i + 1)}
                  className={
                    i === 0
                      ? 'border-l-2 border-[#539ae6] pl-5 text-[18px] md:text-[20px] font-normal leading-relaxed text-white'
                      : 'rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm text-[16px] leading-[28px] text-white/90 md:text-[17px]'
                  }
                >
                  <p>{p}</p>
                </div>
              ))}
            </div>
          </div>

          {a.image ? (
            <div className="lg:col-span-5" data-reveal="right">
              <div className="relative rounded-2xl border border-white/15 bg-white/[0.04] p-2.5 shadow-2xl backdrop-blur-md">
                <div className="overflow-hidden rounded-xl">
                  <MediaImage media={a.image} ratio="4/5" sizes="(min-width: 1024px) 40vw, 100vw" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* 3. Our Expertise — We proudly cover (Dark Theme) */}
      <section className="relative overflow-hidden border-y border-white/10 bg-[#071322]">
        {/* Subtle ambient spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(83,154,230,0.08),transparent_75%)]"
        />

        <div className="container-max relative z-10 py-18 text-center md:py-24">
          <FormattedExpertiseHeader
            eyebrow={a.expertiseEyebrow}
            title={a.expertiseTitle}
            className={`${heading} text-[44px] sm:text-[54px] md:text-[64px] tracking-[1.6px]`}
          />

          <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 sm:gap-6">
            {a.expertise.map((e, i) => (
              <li
                key={e.label}
                data-reveal="zoom"
                style={d(i)}
                className="group relative flex flex-col items-center justify-start rounded-2xl border border-white/10 bg-[#08121f]/95 p-6 text-center shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-[#539ae6]/70 hover:bg-[#0d1c2f] hover:shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(83,154,230,0.2)]"
              >
                {/* Subtle top specular highlight */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-opacity duration-300 group-hover:via-[#539ae6]/80"
                />

                <div className="mb-4 flex size-13 sm:size-14 items-center justify-center rounded-2xl border border-white/15 bg-[#03070f] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:border-[#539ae6]/90 group-hover:bg-[#050c18] group-hover:shadow-[0_0_24px_rgba(83,154,230,0.4)]">
                  <ExpertiseEmoji name={e.icon} label={e.label} />
                </div>
                <span className="text-[15px] font-semibold leading-snug text-white/90 transition-colors group-hover:text-white">
                  {e.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Major Events Covered */}
      <section className="container-max py-20 md:py-26">
        <div className="mx-auto max-w-5xl">
          <FormattedEventsTitle
            title={a.eventsTitle}
            className={`${heading} text-[40px] sm:text-[50px] md:text-[60px] leading-[1.05] tracking-[1.5px]`}
          />
          <p
            data-reveal="up"
            style={d(1)}
            className="mt-4 text-[16px] leading-[30px] text-white/90 md:text-[18px]"
          >
            {a.eventsIntro}
          </p>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {a.events.map((e, i) => (
              <li
                key={e}
                data-reveal="up"
                style={d(i % 6)}
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4.5 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:translate-x-1"
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#539ae6]/40 bg-[#539ae6]/15 text-[#6eabe4] font-bold text-xs shadow-sm transition-colors group-hover:bg-[#539ae6] group-hover:text-white"
                >
                  ✓
                </span>
                <span className="text-[15px] font-medium leading-snug text-white md:text-[16px]">
                  {e}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Ministerial visits */}
      <section className="font-bricolage rounded-b-[30px] border-b border-white/10 bg-white/[0.06] backdrop-blur-md">
        <div className="font-bricolage container-max py-14 text-center md:py-20">

          <MinisterialHeading title={a.ministersTitle} />

          <ul className="font-bricolage mt-10 flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
            {a.ministers.map((m, i) => (
              <li
                key={m}
                data-reveal="zoom"
                style={d(i)}
                className="font-bricolage group inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-[#539ae6]/60 hover:bg-white/[0.12] hover:scale-[1.03]"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-[#539ae6]/20 text-[#6eabe4] text-xs transition-colors group-hover:bg-[#539ae6] group-hover:text-white">
                  ✦
                </span>
                <span className="font-bricolage text-[17px] md:text-[20px] font-semibold text-white tracking-wide">
                  {m}
                </span>
              </li>
            ))}
          </ul>

          <div
            data-reveal="up"
            style={d(3)}
            className="font-bricolage mt-10 inline-block max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3.5 text-[14px] md:text-[15px] text-white/80 backdrop-blur-sm leading-relaxed"
          >
            <p className="font-bricolage">{a.ministersNote}</p>
          </div>
        </div>
      </section>

      {/* 6. Professional Standards · Our Vision · Based in Sweden */}
      <section className="container-max py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {a.pillars.map((p, i) => (
            <div
              key={p.title}
              data-reveal="up"
              style={d(i)}
              className="group relative flex flex-col justify-between rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 md:p-10 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-[#539ae6]/60 hover:shadow-[#539ae6]/10"
            >
              {/* Subtle top accent line */}
              <div
                aria-hidden="true"
                className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#539ae6]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <div>
                <span className="inline-flex size-13 sm:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#539ae6]/25 via-[#1f4a7c]/45 to-[#0e2440]/80 border border-white/20 shadow-lg shadow-[#539ae6]/20 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-[#539ae6]/80 group-hover:shadow-[0_0_24px_rgba(83,154,230,0.35)]">
                  <PillarEmoji icon={p.icon} title={p.title} />
                </span>
                <h3
                  className={`${bebas.className} mt-6 text-[28px] leading-tight tracking-[1.5px] text-white group-hover:text-[#6eabe4] transition-colors`}
                >
                  {p.title}
                </h3>
                <p className="mt-4 text-[16px] leading-[26px] text-white/80">{p.text}</p>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#6eabe4]/80">
                <ShieldCheck className="size-4 text-[#539ae6]" />
                <span>Core Institutional Pillar</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Key figures band */}
      {stats.length ? (
        <section className="relative overflow-hidden border-y border-white/15 bg-[#143c63]">
          {/* Subtle background ambient light */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(255,255,255,0.06),transparent_80%)]"
          />

          <dl className="container-max relative grid grid-cols-2 gap-x-4 gap-y-10 py-14 text-center sm:grid-cols-3 lg:grid-cols-5 md:py-16">
            {stats.map((s, i) => (
              <div
                key={s.id ?? s.label}
                data-reveal="up"
                style={d(i)}
                className="flex flex-col items-center justify-center gap-1.5 px-3"
              >
                <dd
                  data-count
                  className={`${bebas.className} text-[52px] sm:text-[58px] md:text-[66px] leading-none tracking-[1.5px] text-[#539ae6] drop-shadow-sm`}
                >
                  {s.value}
                </dd>
                <dt
                  className={`${bebas.className} mt-1 text-[17px] sm:text-[19px] md:text-[21px] tracking-[1.4px] uppercase text-white leading-tight`}
                >
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* 8. Our Visual Stories */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="container-max relative">
          <div className="text-center" data-reveal="up">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1 text-xs font-semibold tracking-wider uppercase text-[#6eabe4]">
              <Camera className="size-3.5 text-[#539ae6]" />
              <span>Media Archives</span>
            </div>

            <FormattedTwoToneTitle
              title={stories.eyebrow}
              className={`${bebas.className} text-[40px] leading-none tracking-[2.1px] md:text-[52px]`}
            />
            <p className="mt-3 text-[18px] font-medium capitalize text-white/90 md:text-[24px]">
              {stories.title}
            </p>
          </div>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:items-start">
            {stories.items.map((item, i) => {
              const photo = storyPhotos[i]
              return (
                <li
                  key={item.title}
                  data-reveal="up"
                  style={d(i + 1)}
                  className={i % 2 === 1 ? 'lg:mt-16' : ''}
                >
                  <div className="group h-full overflow-hidden rounded-2xl border border-white/15 bg-[#13294b]/85 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:border-[#539ae6] hover:shadow-2xl hover:shadow-[#539ae6]/15">
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
                            className="settle size-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
                            style={{ objectPosition: photo.focus }}
                          />
                        </div>
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e2440] via-transparent to-transparent opacity-60" />
                    </div>
                    <div className="p-6">
                      <h3
                        className={`${bebas.className} text-[26px] leading-tight tracking-[1.2px] text-white group-hover:text-[#6eabe4] transition-colors`}
                      >
                        {item.title}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="mt-3 block h-[2px] w-10 bg-[#539ae6] transition-[width] duration-500 group-hover:w-20"
                      />
                      <p className="mt-3.5 text-[14px] leading-[22px] text-white/80">{item.text}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* 9. Press releases & Outlets */}
      {press.length ? (
        <section className="container-max pb-20 md:pb-28">
          <div className="text-center" data-reveal="up">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1 text-xs font-semibold tracking-wider uppercase text-[#6eabe4]">
              <Award className="size-3.5 text-[#539ae6]" />
              <span>Accreditations & Mentions</span>
            </div>
            <FormattedTwoToneTitle
              title={t.pressTitle}
              className={`${bebas.className} text-[38px] leading-none tracking-[2.1px] md:text-[48px]`}
            />
            <p className="mt-3 text-[18px] font-medium text-white/90 md:text-[24px]">{t.pressSub}</p>
          </div>

          <ul className="mx-auto mt-12 flex max-w-[1360px] flex-wrap justify-center gap-3.5 sm:gap-4.5">
            {press.map((p, i) => {
              const logoUrl =
                typeof p.logo === 'string'
                  ? p.logo
                  : (p.logo as any)?.url ?? ''

              return (
                <li
                  key={p.id ?? p.url ?? i}
                  data-reveal="up"
                  style={d(i % 6)}
                  className="w-[calc((100%-14px)/2)] sm:w-[calc((100%-28px)/3)] md:w-[calc((100%-54px)/4)] lg:w-[calc((100%-110px)/6)]"
                >
                  <a
                    href={p.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={p.outlet}
                    className="group flex h-[78px] sm:h-[84px] md:h-[88px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-3 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-[#539ae6] hover:shadow-xl hover:shadow-[#539ae6]/20"
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={p.outlet}
                        loading="lazy"
                        className="max-h-[50px] sm:max-h-[56px] max-w-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex items-center justify-center text-center text-[15px] font-bold text-[#0e2440] transition-colors group-hover:text-[#194c76]">
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

      {/* Publications — every published issue from the CMS */}
      {issues.length > 0 ? (
        <section id="publications" className="container-max scroll-mt-24 py-16 md:py-20">
          <FormattedTwoToneTitle
            title={t.publications}
            className={`${heading} text-[34px] md:text-[44px] leading-tight`}
          />
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {issues.map((p) => (
              <li key={p.id}>
                <PublicationCard publication={p} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 10. Let's work together */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="container-max py-16 md:py-20">
          <div
            data-reveal="up"
            className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 md:p-14 backdrop-blur-xl shadow-2xl flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between"
          >
            {/* Ambient subtle glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-[#539ae6]/15 blur-3xl"
            />

            <div className="relative z-10 flex items-start gap-6 max-w-2xl">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-[#539ae6] to-[#1f4a7c] text-white shadow-lg shadow-[#539ae6]/25">
                <Send aria-hidden="true" className="size-8" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className={`${heading} text-[36px] md:text-[46px] text-white leading-tight`}>
                  {a.ctaTitle}
                </h2>
                <p className="mt-3 text-[16px] md:text-[18px] leading-relaxed text-white/80">
                  {a.ctaText}
                </p>
                <Link
                  href={href(locale, '/contact')}
                  className="mt-6 inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-white/20 bg-gradient-to-r from-[#539ae6] to-[#3a78bf] px-7 font-display text-[18px] font-bold tracking-wide text-white shadow-lg shadow-[#539ae6]/30 transition-all duration-300 hover:scale-105 hover:shadow-[#539ae6]/50"
                >
                  <span>{t.navContact}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="relative z-10 lg:border-l lg:border-white/15 lg:pl-10">
              <p className="mb-4 text-xs font-bold uppercase tracking-[2px] text-[#6eabe4]">
                Direct Diplomatic Desk
              </p>
              <ul className="space-y-4 text-[16px]">
                {settings.contactEmail ? (
                  <li className="flex items-center gap-3.5 group">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-[#6eabe4] group-hover:bg-[#539ae6] group-hover:text-white transition-colors">
                      <Mail aria-hidden="true" className="size-4" />
                    </span>
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="text-white/90 hover:text-white transition-colors"
                    >
                      {settings.contactEmail}
                    </a>
                  </li>
                ) : null}
                {settings.contactPhone ? (
                  <li className="flex items-center gap-3.5 group">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-[#6eabe4] group-hover:bg-[#539ae6] group-hover:text-white transition-colors">
                      <Phone aria-hidden="true" className="size-4" />
                    </span>
                    <a
                      href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`}
                      className="text-white/90 hover:text-white transition-colors"
                    >
                      {settings.contactPhone}
                    </a>
                  </li>
                ) : null}
                {settings.location ? (
                  <li className="flex items-center gap-3.5">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-[#6eabe4]">
                      <MapPin aria-hidden="true" className="size-4" />
                    </span>
                    <span className="text-white/90">{settings.location}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <ScrollEffects />
    </article>
  )
}
