import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { News } from '@/payload-types'
import config from '@payload-config'

/**
 * Public news reads.
 *
 * `overrideAccess: false` is deliberate: the collection's `read` access rule
 * (published items only for anonymous callers) must run for these queries.
 * Never add a `_status` filter here — that would hide a broken access rule
 * instead of letting the access tests fail.
 */
export const getPublishedNews = cache(async (): Promise<News[]> => {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'news',
    overrideAccess: false,
    depth: 1,
    pagination: false,
    sort: ['-publishedAt', '-createdAt'],
  })

  return docs
})

export const getPublishedNewsBySlug = cache(async (slug: string): Promise<News | null> => {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'news',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: false,
  })

  return docs[0] ?? null
})

const newsDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatNewsDate(value: string): string {
  return newsDateFormatter.format(new Date(value))
}

export function newsExcerpt(body: News['body'], maxLength = 180): string {
  const plain = convertLexicalToPlaintext({
    data: body as unknown as SerializedEditorState,
  })
    .replace(/\s+/g, ' ')
    .trim()

  return plain.length <= maxLength ? plain : `${plain.slice(0, maxLength).trimEnd()}…`
}

export function newsSummary(item: News): string {
  const description = item.listingDescription?.trim()

  return description ? description : newsExcerpt(item.body)
}
