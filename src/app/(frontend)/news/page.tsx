import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { formatNewsDate, getPublishedNews, newsSummary } from '@/lib/news'

import styles from './news.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'News',
  description: 'Published news and announcements.',
}

export default async function NewsListPage() {
  const items = await getPublishedNews()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>News</h1>
        <p>Announcements and updates from the team.</p>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>No news has been published yet.</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const image = typeof item.image === 'object' ? item.image : null
            const href = `/news/${item.slug}`

            return (
              <article key={item.id} className={styles.card}>
                <Link href={href} className={styles.cardLink}>
                  {image?.url && image.width && image.height ? (
                    <Image
                      src={image.url}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      className={styles.image}
                    />
                  ) : null}
                  <h2 className={styles.title}>{item.title}</h2>
                  <time dateTime={item.publishedAt} className={styles.date}>
                    {formatNewsDate(item.publishedAt)}
                  </time>
                  <p className={styles.summary}>{newsSummary(item)}</p>
                </Link>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
