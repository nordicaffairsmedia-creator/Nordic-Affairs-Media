/**
 * The agency's social channels. Instagram is live; the others open our own
 * "Coming soon" page until a profile URL is added in Admin → Navigation → Social
 * (once added there, the icon links straight to it).
 */
export const SOCIALS = ['instagram', 'x', 'facebook', 'youtube'] as const
export type SocialKey = (typeof SOCIALS)[number]

export const socialNames: Record<SocialKey, string> = {
  instagram: 'Instagram',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
}

export const INSTAGRAM_URL = 'https://www.instagram.com/nordicaffairsmedia/'

export const isSocialKey = (v: string): v is SocialKey =>
  (SOCIALS as readonly string[]).includes(v)

type CmsSocial = { platform?: string | null; url?: string | null }[] | null | undefined

/** The live profile address, or null while the channel is not open yet. */
export function socialUrl(key: SocialKey, cms?: CmsSocial): string | null {
  const fromCms = cms?.find((s) => s.platform === key && s.url)?.url
  if (fromCms) return fromCms
  return key === 'instagram' ? INSTAGRAM_URL : null
}
