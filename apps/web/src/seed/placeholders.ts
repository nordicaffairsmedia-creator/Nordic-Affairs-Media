/**
 * Development-only placeholder content, so the design can be reviewed before the
 * client's real articles arrive. Run with:  npm run seed:placeholders -w @nam/web
 *
 * Every item is flagged `isPlaceholder`, carries "[Placeholder]" in its title and
 * renders with a visible orange badge. Nothing here states a fact about Nordic Affairs
 * Media, its people or its history (master prompt §41). Delete it all before launch:
 * filter each collection by "isPlaceholder = true" in the admin and bulk-delete.
 */
import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '@payload-config'

const payload = await getPayload({ config })

const existing = await payload.count({
  collection: 'articles',
  where: { isPlaceholder: { equals: true } },
})
if (existing.totalDocs > 0) {
  payload.logger.info('Placeholder content already exists — nothing to do.')
  process.exit(0)
}

/** A flat grey image with the word PLACEHOLDER, so it can never pass as a real photo. */
async function placeholderImage(label: string, width: number, height: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#d9d5cc"/>
    <text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(width / 22)}" fill="#7a7a72"
      text-anchor="middle" dominant-baseline="middle" letter-spacing="4">PLACEHOLDER · ${label}</text>
  </svg>`
  const data = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer()
  return payload.create({
    collection: 'media',
    data: { alt: `Placeholder image (${label})`, isPlaceholder: true },
    file: {
      data,
      mimetype: 'image/jpeg',
      name: `placeholder-${label.toLowerCase()}.jpg`,
      size: data.length,
    },
  })
}

function paragraph(text: string) {
  return {
    type: 'paragraph',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    textFormat: 0,
    children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
  }
}

function body(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: paragraphs.map(paragraph),
    },
  }
}

const specimen = [
  'This is placeholder text used to review typography and layout. It will be replaced by a real article supplied by the Nordic Affairs Media editorial team.',
  'Body copy is set at a reading measure of roughly sixty-five characters per line, with generous line height, so long-form stories remain comfortable on phones and large screens alike.',
  'Pull quotes, inline images, video embeds and captions will be shown here once real stories are entered in the content manager.',
]

const sectionNames = ['Section A', 'Section B']
const categories = []
for (const [i, name] of sectionNames.entries()) {
  categories.push(
    await payload.create({
      collection: 'categories',
      data: {
        title: `[Placeholder] ${name}`,
        slug: `placeholder-section-${i + 1}`,
        showInNav: true,
      },
    }),
  )
}

const author = await payload.create({
  collection: 'authors',
  data: { name: '[Placeholder] Author', slug: 'placeholder-author', isPlaceholder: true },
})

const images = []
for (const [i, ratio] of (
  [
    [1600, 1067],
    [1600, 1067],
    [1200, 900],
    [1200, 800],
    [1200, 800],
    [1200, 900],
  ] as const
).entries()) {
  images.push(await placeholderImage(`${i + 1}`, ratio[0], ratio[1]))
}

const articles = []
for (let i = 0; i < 9; i++) {
  const category = categories[i % categories.length]!
  articles.push(
    await payload.create({
      collection: 'articles',
      draft: false,
      data: {
        title: `[Placeholder] Story headline number ${i + 1} for layout review`,
        slug: `placeholder-story-${i + 1}`,
        deck: 'Placeholder summary. One or two sentences that introduce the story will appear here.',
        body: body(specimen),
        heroImage: images[i % images.length]!.id,
        category: category.id,
        authors: [author.id],
        publishedAt: new Date(Date.now() - i * 36 * 60 * 60 * 1000).toISOString(),
        isPlaceholder: true,
        _status: 'published',
      },
    }),
  )
}

const cover = await placeholderImage('Cover', 800, 1200)
const issue = await payload.create({
  collection: 'publications',
  draft: false,
  data: {
    title: '[Placeholder] Publication title',
    slug: 'placeholder-issue',
    year: new Date().getFullYear(),
    issueNumber: '0',
    cover: cover.id,
    description:
      'Placeholder description of a magazine issue. Real issues will be created from the client PDFs.',
    isPlaceholder: true,
    _status: 'published',
  },
})

await payload.updateGlobal({
  slug: 'homepage',
  data: {
    leadStory: articles[0]!.id,
    featured: [articles[1]!.id, articles[2]!.id],
    showLatest: true,
    sections: categories.map((c, i) => ({
      category: c.id,
      layout: i === 0 ? ('leadWithList' as const) : ('threeUp' as const),
      limit: 4,
    })),
    showEvents: true,
    featuredPublication: issue.id,
    showNewsletter: true,
  },
})

await payload.updateGlobal({
  slug: 'navigation',
  data: {
    primary: categories.map((c) => ({ label: c.title, href: `/category/${c.slug}` })),
  },
})

payload.logger.info(
  `Created ${articles.length} placeholder articles, 1 issue, ${images.length + 1} images.`,
)
process.exit(0)
