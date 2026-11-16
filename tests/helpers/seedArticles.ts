import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config.js'

import type { Article } from '@/payload-types'

export type ArticleRichText = Extract<Article['content'][number], { blockType: 'section' }>['body']

export function articleRichText(text: string): ArticleRichText {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          children: [{ type: 'text', text, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/** A per-run slug suffix keeps fixtures from colliding on the unique slug index. */
export function uniqueArticleSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface ArticleRef {
  bodyText: string
  id: number
  slug: string
  title: string
}

export interface ArticleAssets {
  attachmentFilename: string
  attachmentId: number
  attachmentUrl: string
  galleryImageId: number
  galleryImageUrl: string
  heroImageId: number
  heroImageUrl: string
}

export interface SeededArticles {
  assets: ArticleAssets
  draft: ArticleRef
  future: ArticleRef
  published: ArticleRef
  related: ArticleRef
  scheduled: ArticleRef
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0kAAAAASUVORK5CYII=',
  'base64',
)

const minimalPdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 0>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n',
)

export async function getArticlesPayload(): Promise<Payload> {
  const payloadConfig = await config
  return getPayload({ config: payloadConfig })
}

export async function seedArticleAssets(payload: Payload): Promise<ArticleAssets> {
  const suffix = uniqueArticleSlug('asset')

  const hero = await payload.create({
    collection: 'media',
    data: { alt: `Article hero ${suffix}` },
    file: {
      data: onePixelPng,
      mimetype: 'image/png',
      name: `article-hero-${suffix}.png`,
      size: onePixelPng.length,
    },
  })

  const gallery = await payload.create({
    collection: 'media',
    data: { alt: `Article gallery ${suffix}` },
    file: {
      data: onePixelPng,
      mimetype: 'image/png',
      name: `article-gallery-${suffix}.png`,
      size: onePixelPng.length,
    },
  })

  const attachment = await payload.create({
    collection: 'article-attachments',
    data: {
      title: `Attachment ${suffix}`,
      description: `Downloadable fixture ${suffix}`,
    },
    file: {
      data: minimalPdf,
      mimetype: 'application/pdf',
      name: `article-attachment-${suffix}.pdf`,
      size: minimalPdf.length,
    },
  })

  return {
    attachmentFilename: attachment.filename ?? '',
    attachmentId: attachment.id,
    attachmentUrl: attachment.url ?? '',
    galleryImageId: gallery.id,
    galleryImageUrl: gallery.url ?? '',
    heroImageId: hero.id,
    heroImageUrl: hero.url ?? '',
  }
}

export function completeArticleBlocks(assets: ArticleAssets, bodyText: string): Article['content'] {
  return [
    {
      blockType: 'section',
      heading: 'Why soil health matters',
      level: 'h2',
      body: articleRichText(bodyText),
    },
    {
      blockType: 'image',
      image: assets.heroImageId,
      caption: 'Field trial caption',
      credit: 'Demo photography',
      size: 'wide',
    },
    {
      blockType: 'gallery',
      images: [
        {
          image: assets.galleryImageId,
          caption: 'Gallery caption one',
        },
        {
          image: assets.heroImageId,
          caption: 'Gallery caption two',
        },
      ],
    },
    {
      blockType: 'table',
      caption: 'Trial results',
      columns: [{ label: 'Treatment' }, { label: 'Yield' }],
      rows: [
        {
          cells: [{ value: 'Compost' }, { value: '+12%' }],
        },
        {
          cells: [{ value: 'Control' }, { value: 'Baseline' }],
        },
      ],
    },
    {
      blockType: 'callout',
      variant: 'warning',
      title: 'Before you apply',
      body: articleRichText('Check local guidance before changing any application rate.'),
    },
    {
      blockType: 'footnotes',
      notes: [
        { note: 'Trial results are illustrative demo data.' },
        { note: 'Figures are rounded to the nearest whole percent.' },
      ],
    },
    {
      blockType: 'downloads',
      items: [
        {
          file: assets.attachmentId,
          label: 'Download the trial guide',
          description: 'PDF summary of the demonstration trial.',
        },
      ],
    },
    {
      blockType: 'section',
      heading: 'Field notes',
      level: 'h2',
      body: articleRichText(
        'Escaped script-like text: <script>alert("article-xss")</script> stays visible as text.',
      ),
    },
    {
      blockType: 'section',
      heading: 'Field notes',
      level: 'h3',
      body: articleRichText('The repeated heading proves that anchors stay distinct.'),
    },
    {
      blockType: 'section',
      heading: 'Résultats et perspectives',
      level: 'h2',
      body: articleRichText('Special characters in headings still get a URL-safe anchor.'),
    },
  ]
}

/**
 * Seeds one published article with every block, a related published article, a
 * draft, a future-dated published article, and a scheduled draft.
 */
export async function seedArticles(payload?: Payload): Promise<SeededArticles> {
  const instance = payload ?? (await getArticlesPayload())
  const assets = await seedArticleAssets(instance)
  const unique = uniqueArticleSlug('fixture')
  const publishedSlug = uniqueArticleSlug('published-article')
  const relatedSlug = uniqueArticleSlug('related-article')
  const draftSlug = uniqueArticleSlug('draft-article')
  const futureSlug = uniqueArticleSlug('future-article')
  const scheduledSlug = uniqueArticleSlug('scheduled-article')
  const bodyText = `Published article body ${unique}`
  const publishedAt = new Date().toISOString()
  const futureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const createPublishedArticle = async (
    slug: string,
    title: string,
    tag: string,
    extra: Partial<Article> = {},
  ) =>
    instance.create({
      collection: 'articles',
      data: {
        title,
        slug,
        summary: `Summary for ${title}`,
        authorName: 'Demo Agronomist',
        publishedAt,
        tags: [{ tag }],
        content: completeArticleBlocks(assets, bodyText),
        _status: 'published',
        ...extra,
      },
    })

  const published = await instance.create({
    collection: 'articles',
    data: {
      title: `Published article ${unique}`,
      slug: publishedSlug,
      summary: `Summary for ${publishedSlug}`,
      authorName: 'Demo Agronomist',
      publishedAt,
      heroImage: assets.heroImageId,
      tags: [{ tag: 'soil-health' }, { tag: `tag-${unique}` }],
      video: {
        enabled: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Resilient field trial video',
        poster: assets.heroImageId,
        duration: '3:45',
        externalUrl: 'https://example.com/watch/field-trial',
        alternativeSourceUrl: 'https://example.com/media/field-trial.mp4',
        alternativeMimeType: 'video/mp4',
      },
      content: completeArticleBlocks(assets, bodyText),
      seo: {
        metaTitle: `SEO ${publishedSlug}`,
        metaDescription: `SEO description for ${publishedSlug}`,
        socialImage: assets.heroImageId,
      },
      _status: 'published',
    },
  })

  const related = await createPublishedArticle(
    relatedSlug,
    `Related article ${unique}`,
    'soil-health',
    {
      publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      heroImage: assets.galleryImageId,
      content: [
        {
          blockType: 'section',
          heading: 'Related reading',
          level: 'h2',
          body: articleRichText(`Related article body ${unique}`),
        },
      ],
    },
  )

  const draft = await instance.create({
    collection: 'articles',
    data: {
      title: `Draft article ${unique}`,
      slug: draftSlug,
      summary: `Summary for ${draftSlug}`,
      authorName: 'Demo Agronomist',
      publishedAt,
      tags: [{ tag: 'soil-health' }, { tag: 'draft-only' }],
      content: [
        {
          blockType: 'section',
          heading: 'Draft section',
          level: 'h2',
          body: articleRichText(`Draft article body ${unique}`),
        },
      ],
    },
    draft: true,
  })

  const future = await instance.create({
    collection: 'articles',
    data: {
      title: `Future article ${unique}`,
      slug: futureSlug,
      summary: `Summary for ${futureSlug}`,
      authorName: 'Demo Agronomist',
      publishedAt: futureAt,
      tags: [{ tag: 'soil-health' }],
      content: [
        {
          blockType: 'section',
          heading: 'Future section',
          level: 'h2',
          body: articleRichText(`Future article body ${unique}`),
        },
      ],
      _status: 'published',
    },
  })

  const scheduled = await instance.create({
    collection: 'articles',
    data: {
      title: `Scheduled article ${unique}`,
      slug: scheduledSlug,
      summary: `Summary for ${scheduledSlug}`,
      authorName: 'Demo Agronomist',
      publishedAt: futureAt,
      tags: [{ tag: 'soil-health' }],
      content: [
        {
          blockType: 'section',
          heading: 'Scheduled section',
          level: 'h2',
          body: articleRichText(`Scheduled article body ${unique}`),
        },
      ],
    },
    draft: true,
  })

  return {
    assets,
    published: {
      bodyText,
      id: published.id,
      slug: publishedSlug,
      title: published.title,
    },
    related: {
      bodyText: `Related article body ${unique}`,
      id: related.id,
      slug: relatedSlug,
      title: related.title,
    },
    draft: {
      bodyText: `Draft article body ${unique}`,
      id: draft.id,
      slug: draftSlug,
      title: draft.title,
    },
    future: {
      bodyText: `Future article body ${unique}`,
      id: future.id,
      slug: futureSlug,
      title: future.title,
    },
    scheduled: {
      bodyText: `Scheduled article body ${unique}`,
      id: scheduled.id,
      slug: scheduledSlug,
      title: scheduled.title,
    },
  }
}

/**
 * Adds enough published articles to cross the nine-card page boundary.
 */
export async function seedPaginationArticles(payload: Payload, count = 10): Promise<ArticleRef[]> {
  const refs: ArticleRef[] = []

  for (let index = 0; index < count; index += 1) {
    const slug = uniqueArticleSlug(`page-article-${index}`)
    const bodyText = `Pagination article body ${slug}`
    const created = await payload.create({
      collection: 'articles',
      data: {
        title: `Pagination article ${index} ${slug}`,
        slug,
        summary: `Pagination summary ${slug}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
        tags: [{ tag: `pagination-${slug}` }],
        content: [
          {
            blockType: 'section',
            heading: `Pagination section ${index}`,
            level: 'h2',
            body: articleRichText(bodyText),
          },
        ],
        _status: 'published',
      },
    })

    refs.push({ bodyText, id: created.id, slug, title: created.title })
  }

  return refs
}

export async function cleanupArticles(seeded: SeededArticles, payload?: Payload): Promise<void> {
  const instance = payload ?? (await getArticlesPayload())

  for (const ref of [
    seeded.published,
    seeded.related,
    seeded.draft,
    seeded.future,
    seeded.scheduled,
  ]) {
    await instance.delete({ collection: 'articles', id: ref.id }).catch(() => undefined)
  }

  for (const id of [seeded.assets.heroImageId, seeded.assets.galleryImageId]) {
    await instance.delete({ collection: 'media', id }).catch(() => undefined)
  }

  await instance
    .delete({ collection: 'article-attachments', id: seeded.assets.attachmentId })
    .catch(() => undefined)
}

export async function cleanupArticleRefs(refs: ArticleRef[], payload?: Payload): Promise<void> {
  const instance = payload ?? (await getArticlesPayload())

  for (const ref of refs) {
    await instance.delete({ collection: 'articles', id: ref.id }).catch(() => undefined)
  }
}
