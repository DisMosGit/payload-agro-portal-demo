import { getPayload } from 'payload'
import { cache } from 'react'

import type { Article, Media } from '@/payload-types'
import type { Where } from 'payload'
import config from '@payload-config'

import {
  ARTICLE_PAGE_SIZE,
  articlePlainText,
  articleSummaryText,
  asMedia,
  plainTextExcerpt,
} from './article-utils'

export { articleSummaryText } from './article-utils'
export { absoluteURL, getSiteURL } from './site'

export type ArticleListPage = {
  articles: Article[]
  page: number
  totalDocs: number
  totalPages: number
}

export const getPublishedArticlesPage = cache(async (page: number): Promise<ArticleListPage> => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'articles',
    overrideAccess: false,
    depth: 1,
    limit: ARTICLE_PAGE_SIZE,
    page,
    sort: ['-publishedAt', '-createdAt'],
  })

  return {
    articles: result.docs,
    page,
    totalDocs: result.totalDocs,
    totalPages: Math.max(1, result.totalPages),
  }
})

/**
 * Public article lookup.
 *
 * `overrideAccess: false` is deliberate: the collection's read access rule is
 * the only public gate for published status and the publication date. Never add
 * a `_status` filter here; doing so would hide a broken access rule instead of
 * letting the access tests fail.
 */
export const getPublishedArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
})

export const getRelatedArticles = cache(
  async (articleId: number, tags: string[]): Promise<Article[]> => {
    const payload = await getPayload({ config })
    const notCurrent: Where = { id: { not_equals: articleId } }
    const resultLimit = 3

    if (tags.length > 0) {
      const tagged: Where = {
        'tags.tag': { in: tags },
      }
      const result = await payload.find({
        collection: 'articles',
        where: { and: [notCurrent, tagged] },
        sort: ['-publishedAt', '-createdAt'],
        limit: resultLimit,
        depth: 1,
        overrideAccess: false,
      })

      if (result.docs.length > 0) {
        return result.docs
      }
    }

    const fallback = await payload.find({
      collection: 'articles',
      where: notCurrent,
      sort: ['-publishedAt', '-createdAt'],
      limit: resultLimit,
      depth: 1,
      overrideAccess: false,
    })

    return fallback.docs
  },
)

export function articleTagValues(article: Article): string[] {
  return (article.tags ?? [])
    .map((tag) => tag.tag?.trim())
    .filter((tag): tag is string => Boolean(tag))
}

export function articleCanonicalPath(article: Pick<Article, 'slug'>): string {
  return `/articles/${article.slug}`
}

export function articleExcerpt(article: Article, maxLength = 160): string {
  return articleSummaryText(article, maxLength)
}

export function articleMetaDescription(article: Article): string {
  const override = article.seo?.metaDescription?.trim()

  if (override) {
    return override
  }

  const summary = article.summary?.trim()

  if (summary) {
    return plainTextExcerpt(summary, 160)
  }

  return plainTextExcerpt(articlePlainText(article.content), 160)
}

export function articleMetaTitle(article: Article): string {
  return article.seo?.metaTitle?.trim() || article.title
}

export function articleSocialImage(article: Article): Media | null {
  return (asMedia(article.seo?.socialImage) ??
    asMedia(article.heroImage) ??
    asMedia(article.video?.poster)) as Media | null
}
