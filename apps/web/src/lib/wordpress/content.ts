/**
 * Fixed content copied from the old site's About, Contact and footer (October 2026).
 * The wording is Nordic Affairs Media's own; only spacing and obvious typos were tidied.
 */

type TextNode = {
  type: 'text'
  text: string
  format: number
  style: string
  mode: 'normal'
  detail: number
  version: 1
}

const text = (t: string): TextNode => ({
  type: 'text',
  text: t,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})

const base = { format: '' as const, indent: 0, version: 1, direction: 'ltr' as const }

export const paragraph = (t: string) => ({
  ...base,
  type: 'paragraph',
  textFormat: 0,
  children: [text(t)],
})

const heading = (t: string) => ({ ...base, type: 'heading', tag: 'h2', children: [text(t)] })

const list = (items: string[]) => ({
  ...base,
  type: 'list',
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  children: items.map((item, i) => ({
    ...base,
    type: 'listitem',
    value: i + 1,
    children: [text(item)],
  })),
})

export const richText = (children: object[]) => ({
  root: { ...base, type: 'root', children },
})

export const richTextFromParagraphs = (paragraphs: string[]) => richText(paragraphs.map(paragraph))

export const about = {
  slug: 'about-us',
  title: 'About Us',
  intro: 'Capturing History Through Excellence',
  body: richText([
    paragraph(
      'Nordic Affairs Media is a Sweden-based media organization specializing in high-level official visits, diplomatic events, government engagements, royal ceremonies, and international sports coverage across Sweden and worldwide.',
    ),
    paragraph(
      'With a strong commitment to professionalism, accuracy, and visual storytelling, we provide world-class photography and videography services for prestigious national and international events.',
    ),
    paragraph(
      'Our team works with precision, discretion, and dedication to document moments of historical, cultural, and global significance through powerful visual media.',
    ),
    heading('Our Expertise'),
    paragraph('We proudly cover:'),
    list([
      'Government & Diplomatic Visits',
      'Royal Events & State Ceremonies',
      'International Summits & Conferences',
      'Embassy & Official Delegations',
      'Sports Events & Tournaments',
      'Cultural & Public Celebrations',
    ]),
    heading('Major Events Covered'),
    paragraph(
      'Nordic Affairs Media has had the privilege of covering several high-profile international and royal events, including:',
    ),
    list([
      'Indian Prime Minister Narendra Modi’s visit to Sweden',
      'Former President of India Pranab Mukherjee’s visit to Sweden',
      'Official engagements involving Ulf Kristersson',
      'State visits by Frederik X',
      'Presidential visits from Halla Tómasdóttir',
      'The prestigious Nobel Prize events',
      'Royal celebrations and official events involving Carl XVI Gustaf',
      'Indo-Nordic Summit 2018',
      'Stockholm Kulturfestivalen',
    ]),
    paragraph('Ministerial visits from India, including:'),
    list(['Piyush Goyal', 'Nitin Gadkari', 'S. Jaishankar']),
    paragraph('…and many more distinguished international occasions.'),
    heading('Professional Standards'),
    paragraph(
      'Nordic Affairs Media operates with professionalism, integrity, and excellence in every assignment. Officially accredited by the Swedish Press Association, we provide trusted media coverage for diplomatic visits, royal ceremonies, government engagements, and prestigious international events with accuracy, discretion, and world-class visual storytelling.',
    ),
    heading('Our Vision'),
    paragraph(
      'Our vision is to create impactful visual stories that preserve important global moments and strengthen international connections. Through exceptional photography, videography, and cinematic storytelling, we aim to showcase diplomacy, leadership, culture, and sport while delivering meaningful media experiences that inspire audiences worldwide.',
    ),
    heading('Based in Sweden — Working Worldwide'),
    paragraph(
      'Headquartered in Stockholm, Nordic Affairs Media delivers premium international event coverage across Sweden and worldwide destinations. Through professionalism, creativity, and trusted media partnerships, we continue building a strong reputation for documenting historic moments, official engagements, cultural celebrations, and global events with excellence and authenticity.',
    ),
  ]),
}

export const settings = {
  tagline: 'Capturing Global Moments',
  description:
    'Nordic Affairs Media is a Sweden-based media organization specializing in diplomatic events, official visits, international summits, royal ceremonies, and sports coverage across Sweden and worldwide.',
  contactEmail: 'info@nordicaffairsmedia.com',
  contactPhone: '+46 73 300 26 65',
  whatsapp: '46733002665',
  location: 'Stockholm, Sweden',
  accreditation: 'Accredited by the Swedish Press Association',
  stats: [
    { value: '10+', label: 'Years of Excellence' },
    { value: '500+', label: 'Global Events Covered' },
    { value: '50+', label: 'International Assignments' },
    { value: '100+', label: 'Trusted Partnerships' },
    { value: '24/7', label: 'Media Coverage Support' },
  ],
}

const U = '/wp-content/uploads/2026/05/'

/** "As seen in": outlets that published the agency's coverage, with the logo tiles from the old site. */
export const pressMentions: { outlet: string; url: string; logo: string }[] = [
  {
    outlet: 'The Hindu',
    logo: `${U}Group-490-1.png`,
    url: 'https://www.thehindu.com/news/national/eam-jaishankar-interacts-with-indian-community-in-sweden/article66852540.ece',
  },
  {
    outlet: 'Press Information Bureau (PIB)',
    logo: `${U}Group-491-1.png`,
    url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1830145&reg=3&lang=2',
  },
  {
    outlet: 'CNBC-TV18',
    logo: `${U}Group-492-1.png`,
    url: 'https://www.cnbctv18.com/world/external-affairs-minister-s-jaishankar-photo-from-his-sweden-visit-goes-viral-here-is-why-16667651.htm',
  },
  {
    outlet: 'ZEE5',
    logo: `${U}Group-493-1.png`,
    url: 'https://www.zee5.com/articles/jaishankar-meets-swedish-parliament-speaker-andreas-norlen-in-stockholm',
  },
  {
    outlet: 'Outlook India',
    logo: `${U}Group-494-1.png`,
    url: 'https://www.outlookindia.com/international/external-affairs-minister-s-jaishankar-boosts-india-sweden-ties-during-high-level-discussions-in-sweden-news-286489',
  },
  {
    outlet: 'JG Productions',
    logo: `${U}Group-495-1.png`,
    url: 'https://www.wwwjgproductions.com/new-page-5',
  },
  {
    outlet: 'ThePrint',
    logo: `${U}Group-496-1.png`,
    url: 'https://theprint.in/world/jaishankar-meets-swedens-defence-foreign-ministers-during-his-stockholm-trip/1574075/',
  },
  {
    outlet: 'Hindustan Times',
    logo: `${U}Group-497-1.png`,
    url: 'https://www.hindustantimes.com/india-news/in-sweden-s-jaishankars-ghee-shakkar-quip-leaves-audience-in-splits-watch-101684140620196.html',
  },
  {
    outlet: 'ANI',
    logo: `${U}Group-498-1.png`,
    url: 'https://www.aninews.in/topic/jaishankar-sweden-visit/',
  },
  {
    outlet: 'The Indian Express',
    logo: `${U}Group-499-1.png`,
    url: 'https://indianexpress.com/article/india/eam-jaishankar-popular-hindi-phrase-sweden-8610954/',
  },
  {
    outlet: 'The Daily Guardian',
    logo: `${U}Group-500-1.png`,
    url: 'https://thedailyguardian.com/eam-jaishankar-visits-stockholm-meets-swedish-parliament-speaker-norlen/',
  },
  {
    outlet: 'The Tribune',
    logo: `${U}Group-501-1.png`,
    url: 'https://www.tribuneindia.com/news/world/eams-visit-to-sweden-marks-75-years-of-diplomatic-ties-508152',
  },
  {
    outlet: 'iGlobal News',
    logo: `${U}Group-502-1.png`,
    url: 'https://www.iglobalnews.com/iheadlines/minister-jaishankar-meets-indian-diaspora-in-sweden',
  },
  {
    outlet: 'ABP Live',
    logo: `${U}Group-507-1.png`,
    url: 'https://www.abplive.com/news/india/india-external-affairs-minister-s-jaishankar-speech-three-days-sweden-visit-interaction-with-indian-2408913',
  },
  {
    outlet: 'EMEA Express',
    logo: `${U}Group-504-1.png`,
    url: 'https://emeaexpress.com/s-jaishankars-visit-to-sweden-for-eipmf/',
  },
  {
    outlet: 'The Telegraph India',
    logo: `${U}Group-505-1.png`,
    url: 'https://www.telegraphindia.com/world/s-jaishankar-discusses-indo-pacific-ukraine-war-with-his-8-counterparts-in-sweden/cid/1936771',
  },
  {
    outlet: 'Embassy of India, Stockholm',
    logo: `${U}Group-506-1.png`,
    url: 'https://www.indembassysweden.gov.in/news_detail/?newsid=88',
  },
  {
    outlet: 'Press Information Bureau (PIB)',
    logo: `${U}Group-509.png`,
    url: 'https://www.pib.gov.in/newsite/PrintRelease.aspx?relid=199409&reg=3&lang=2',
  },
  {
    outlet: 'Embassy of India, Stockholm',
    logo: `${U}Group-510.png`,
    url: 'https://www.indembassysweden.gov.in/page/make-in-india-sweden/',
  },
  {
    outlet: 'Suresh Prabhu on X',
    logo: `${U}Group-511.png`,
    url: 'https://x.com/sureshpprabhu/status/918370609884729344',
  },
  {
    outlet: 'The Indian Express',
    logo: `${U}Group-499-1.png`,
    url: 'https://indianexpress.com/article/cities/mumbai/maharashtra-cm-devendra-fadnavis-swedish-pm-discuss-investment-prospects-in-state-4888100/',
  },
  {
    outlet: 'LatestLY',
    logo: `${U}Group-513.png`,
    url: 'https://www.latestly.com/agency-news/world-news-eam-s-jaishankar-holds-meeting-with-sweden-pm-ulf-kristersson-5128689.html',
  },
]

/** Old site-furniture addresses → new pages. Gallery and story addresses are added per item. */
export const fixedRedirects: { from: string; to: string }[] = [
  { from: '/home', to: '/en' },
  { from: '/contact-us', to: '/en/contact' },
  { from: '/gallery', to: '/en/gallery' },
  { from: '/video', to: '/en/media' },
  { from: '/concerts-events', to: '/en/events' },
]

/**
 * Real event dates for galleries whose photo file names carry none (the old site was
 * rebuilt in 2026, so WordPress dates are upload days). Sources: camera data in the
 * photos (EXIF), or the public record where the photos have none.
 * Keyed by the old WordPress slug. Editors can still change any date in Admin.
 */
export const eventDates: Record<string, string> = {
  'marcus-wandt': '2024-02-19T12:00:00.000Z', // camera date
  'larz-kristerz': '2024-04-20T12:00:00.000Z', // camera date
  'm-g-sreekumar-live-concert-2026': '2026-09-26T12:00:00.000Z', // camera date
  'nobel-prize-oslo-2023': '2023-12-10T12:00:00.000Z', // Nobel Peace Prize ceremony, Oslo
  'tobias-billstrom-pal-jonson-dr-s-jaishanker-visit-2023': '2023-05-14T12:00:00.000Z', // Jaishankar met Billström and Jonson
  'sweden-pm-ulf-kristersson-dr-s-jaishankar': '2023-05-15T12:00:00.000Z', // Jaishankar met PM Kristersson
}

export const navLinks = [
  { label: 'Gallery', href: '/gallery' },
  { label: 'Events', href: '/events' },
  { label: 'About', href: '/about-us' },
  { label: 'Contact', href: '/contact' },
]

/** About page wording from the old site — shown wherever the "About page" global is empty. */
export const aboutDefaults = {
  title: 'Capturing History Through Excellence',
  paragraphs: [
    'Nordic Affairs Media is a Sweden-based media organization specializing in high-level official visits, diplomatic events, government engagements, royal ceremonies, and international sports coverage across Sweden and worldwide.',
    'With a strong commitment to professionalism, accuracy, and visual storytelling, we provide world-class photography and videography services for prestigious national and international events.',
    'Our team works with precision, discretion, and dedication to document moments of historical, cultural, and global significance through powerful visual media.',
  ],
  expertiseEyebrow: 'Our Expertise',
  expertiseTitle: 'We Proudly Cover',
  expertise: [
    { label: 'Government & Diplomatic Visits', icon: 'landmark' },
    { label: 'Royal Events & State Ceremonies', icon: 'crown' },
    { label: 'International Summits & Conferences', icon: 'globe' },
    { label: 'Embassy & Official Delegations', icon: 'users' },
    { label: 'Sports Events & Tournaments', icon: 'trophy' },
    { label: 'Cultural & Public Celebrations', icon: 'sparkles' },
  ],
  eventsTitle: 'Major Events Covered',
  eventsIntro:
    'Nordic Affairs Media has had the privilege of covering several high-profile international and royal events, including:',
  events: [
    'Indian Prime Minister Narendra Modi’s visit to Sweden',
    'Former President of India Pranab Mukherjee’s visit to Sweden',
    'Official engagements involving Ulf Kristersson',
    'State visits by Frederik X',
    'Presidential visits from Halla Tómasdóttir',
    'The prestigious Nobel Prize events',
    'Royal celebrations and official events involving Carl XVI Gustaf',
    'Indo-Nordic Summit 2018',
    'Stockholm Kulturfestivalen',
  ],
  ministersTitle: 'Ministerial visits from India, including',
  ministers: ['Piyush Goyal', 'Nitin Gadkari', 'S. Jaishankar'],
  ministersNote: '…and many more distinguished international occasions.',
  pillars: [
    {
      title: 'Professional Standards',
      icon: 'award',
      text: 'Nordic Affairs Media operates with professionalism, integrity, and excellence in every assignment. Officially accredited by the Swedish Press Association, we provide trusted media coverage for diplomatic visits, royal ceremonies, government engagements, and prestigious international events with accuracy, discretion, and world-class visual storytelling.',
    },
    {
      title: 'Our Vision',
      icon: 'eye',
      text: 'Our vision is to create impactful visual stories that preserve important global moments and strengthen international connections. Through exceptional photography, videography, and cinematic storytelling, we aim to showcase diplomacy, leadership, culture, and sport while delivering meaningful media experiences that inspire audiences worldwide.',
    },
    {
      title: 'Based in Sweden — Working Worldwide',
      icon: 'globe',
      text: 'Headquartered in Stockholm, Nordic Affairs Media delivers premium international event coverage across Sweden and worldwide destinations. Through professionalism, creativity, and trusted media partnerships, we continue building a strong reputation for documenting historic moments, official engagements, cultural celebrations, and global events with excellence and authenticity.',
    },
  ],
  ctaTitle: 'Let’s Work Together',
  ctaText: 'For media inquiries, event coverage, and collaboration.',
}
