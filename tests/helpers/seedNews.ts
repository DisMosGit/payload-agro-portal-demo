import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * Builds a minimal, valid Lexical document with a single paragraph so news
 * fixtures do not need the admin editor.
 */
export function newsBody(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          children: [{ type: 'text', text, version: 1 }],
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

/** A per-run slug suffix keeps fixtures from colliding on the unique slug index. */
export function uniqueNewsSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface SeededNews {
  published: { id: number; slug: string; title: string; bodyText: string }
  draft: { id: number; slug: string; title: string; bodyText: string }
}

export async function getNewsPayload(): Promise<Payload> {
  const payloadConfig = await config
  return getPayload({ config: payloadConfig })
}

/**
 * Seeds one published and one draft news item with unique slugs.
 */
export async function seedNewsItems(payload?: Payload): Promise<SeededNews> {
  const instance = payload ?? (await getNewsPayload())

  const publishedSlug = uniqueNewsSlug('published-fixture')
  const draftSlug = uniqueNewsSlug('draft-fixture')
  const publishedBodyText = `Published fixture body ${publishedSlug}`
  const draftBodyText = `Draft fixture body ${draftSlug}`
  const publishedAt = new Date().toISOString()

  const published = await instance.create({
    collection: 'news',
    data: {
      title: `Published fixture ${publishedSlug}`,
      slug: publishedSlug,
      listingDescription: `Listing description for ${publishedSlug}`,
      body: newsBody(publishedBodyText),
      publishedAt,
      _status: 'published',
    },
  })

  const draft = await instance.create({
    collection: 'news',
    data: {
      title: `Draft fixture ${draftSlug}`,
      slug: draftSlug,
      listingDescription: `Listing description for ${draftSlug}`,
      body: newsBody(draftBodyText),
      publishedAt,
    },
    draft: true,
  })

  return {
    published: {
      id: published.id,
      slug: publishedSlug,
      title: published.title,
      bodyText: publishedBodyText,
    },
    draft: {
      id: draft.id,
      slug: draftSlug,
      title: draft.title,
      bodyText: draftBodyText,
    },
  }
}

export async function cleanupNewsItems(seeded: SeededNews, payload?: Payload): Promise<void> {
  const instance = payload ?? (await getNewsPayload())

  for (const id of [seeded.published.id, seeded.draft.id]) {
    try {
      await instance.delete({ collection: 'news', id })
    } catch {
      // Already removed by a test; nothing to clean up.
    }
  }
}
