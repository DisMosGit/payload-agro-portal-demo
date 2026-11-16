import Image from 'next/image'
import Link from 'next/link'

import type { Article } from '@/payload-types'
import {
  articleSummaryText,
  calculateReadingTime,
  formatArticleDate,
  getVideoState,
} from '@/lib/article-utils'
import { articleTagValues } from '@/lib/articles'

import styles from '@/app/(frontend)/articles/articles.module.css'

type ArticleCardProps = {
  article: Article
  compact?: boolean
  headingLevel?: 'h2' | 'h3'
}

export function ArticleCard({ article, compact = false, headingLevel = 'h2' }: ArticleCardProps) {
  const Heading = headingLevel
  const video = getVideoState(article.video, article.title)
  const poster = video.posterUrl ? video.poster : null
  const hero = typeof article.heroImage === 'object' ? article.heroImage : null
  const imageURL = poster?.url ?? hero?.url ?? null
  const imageAlt = poster?.alt ?? hero?.alt ?? article.title
  const readingTime = calculateReadingTime(article.content)
  const tags = articleTagValues(article)

  return (
    <article className={compact ? `${styles.card} ${styles.cardCompact}` : styles.card}>
      <Link href={`/articles/${article.slug}`} className={styles.cardLink}>
        <div className={styles.cardMedia}>
          {imageURL ? (
            <Image
              src={imageURL}
              alt={imageAlt}
              fill
              sizes={
                compact ? '(max-width: 48rem) 100vw, 18rem' : '(max-width: 48rem) 100vw, 22rem'
              }
              className={styles.cardImage}
            />
          ) : video.kind !== 'none' ? (
            <div className={styles.posterFallback}>
              <span>{video.title ?? article.title}</span>
              <span>{video.issues[0] ?? 'Video preview unavailable'}</span>
            </div>
          ) : null}

          {video.duration ? (
            <span className={styles.durationBadge} aria-label={`Video duration ${video.duration}`}>
              {video.duration}
            </span>
          ) : null}
        </div>

        <div className={styles.cardBody}>
          <p className={styles.cardKicker}>{readingTime} min read</p>
          <Heading className={styles.cardTitle}>{article.title}</Heading>
          <p className={styles.cardSummary}>{articleSummaryText(article)}</p>
          <p className={styles.cardMeta}>
            <span>{article.authorName}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          </p>
          {tags.length > 0 ? (
            <ul className={styles.tagList} aria-label="Tags">
              {tags.map((tag) => (
                <li key={tag} className={styles.tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
