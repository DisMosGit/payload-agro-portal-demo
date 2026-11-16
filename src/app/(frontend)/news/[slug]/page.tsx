import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { formatNewsDate, getPublishedNewsBySlug, newsSummary } from '@/lib/news'

import styles from '../news.module.css'

export const dynamic = 'force-dynamic'

type NewsDetailPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const item = await getPublishedNewsBySlug(slug)

  if (!item) {
    return { title: 'News item not found' }
  }

  return {
    title: item.title,
    description: newsSummary(item),
  }
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params
  const item = await getPublishedNewsBySlug(slug)

  if (!item) {
    notFound()
  }

  const image = typeof item.image === 'object' ? item.image : null

  return (
    <article className={styles.detail}>
      <Link href="/news" className={styles.back}>
        ← All news
      </Link>
      <h1>{item.title}</h1>
      <time dateTime={item.publishedAt} className={styles.date}>
        {formatNewsDate(item.publishedAt)}
      </time>
      {image?.url && image.width && image.height ? (
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className={styles.image}
        />
      ) : null}
      <div className={styles.body}>
        <RichText data={item.body as unknown as SerializedEditorState} />
      </div>
    </article>
  )
}
