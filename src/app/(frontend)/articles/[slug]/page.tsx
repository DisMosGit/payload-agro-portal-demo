import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArticleBody } from '@/components/articles/ArticleBody'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { ArticleTableOfContents } from '@/components/articles/ArticleTableOfContents'
import { VideoPreview } from '@/components/articles/VideoPreview'
import {
  absoluteURL,
  articleCanonicalPath,
  articleMetaDescription,
  articleMetaTitle,
  articleSocialImage,
  articleTagValues,
  getPublishedArticleBySlug,
  getRelatedArticles,
} from '@/lib/articles'
import {
  asMedia,
  buildTableOfContents,
  calculateReadingTime,
  formatArticleDate,
  getVideoState,
} from '@/lib/article-utils'

import styles from '../articles.module.css'

export const dynamic = 'force-dynamic'

type ArticleDetailPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedArticleBySlug(slug)

  if (!article) {
    return {
      title: 'Article not found',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const canonical = absoluteURL(articleCanonicalPath(article))
  const description = articleMetaDescription(article)
  const image = articleSocialImage(article)
  const imageURL = image?.url ? absoluteURL(image.url) : null
  const tags = articleTagValues(article)

  return {
    title: articleMetaTitle(article),
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'article',
      title: articleMetaTitle(article),
      description,
      url: canonical,
      publishedTime: article.publishedAt,
      authors: [article.authorName],
      tags,
      images: imageURL ? [{ url: imageURL, alt: image?.alt || article.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: articleMetaTitle(article),
      description,
      images: imageURL ? [imageURL] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params
  const article = await getPublishedArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const toc = buildTableOfContents(article.content)
  const readingTime = calculateReadingTime(article.content)
  const video = getVideoState(article.video, article.title)
  const tags = articleTagValues(article)
  const hero = asMedia(article.heroImage)
  const related = await getRelatedArticles(article.id, tags)
  const hasTOC = toc.length > 0

  return (
    <article className={styles.detail}>
      <Link href="/articles" className={styles.back}>
        ← All articles
      </Link>

      <header className={styles.articleHeader}>
        <p className={styles.eyebrow}>Article</p>
        <h1>{article.title}</h1>
        {article.summary ? <p className={styles.standfirst}>{article.summary}</p> : null}
        <p className={styles.articleMeta}>
          <span>By {article.authorName}</span>
          <span aria-hidden="true"> · </span>
          <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          <span aria-hidden="true"> · </span>
          <span>{readingTime} min read</span>
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
      </header>

      {hero ? (
        <figure className={styles.hero}>
          <Image
            src={hero.url ?? ''}
            alt={hero.alt || article.title}
            width={hero.width ?? 1600}
            height={hero.height ?? 900}
            sizes="(max-width: 64rem) 100vw, 64rem"
            className={styles.heroImage}
            priority
          />
        </figure>
      ) : null}

      {video.kind !== 'none' ? <VideoPreview fallbackTitle={article.title} state={video} /> : null}

      <div className={hasTOC ? styles.articleLayout : styles.articleLayoutSingle}>
        <div className={styles.articleMain}>
          <ArticleBody blocks={article.content} toc={toc} />
        </div>
        {hasTOC ? (
          <aside className={styles.articleAside}>
            <ArticleTableOfContents entries={toc} />
          </aside>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className={styles.related} aria-label="Related articles">
          <h2>Related articles</h2>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} compact headingLevel="h3" />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}
