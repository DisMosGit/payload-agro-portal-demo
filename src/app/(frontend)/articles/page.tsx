import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/articles/ArticleCard'
import { ArticlePagination } from '@/components/articles/ArticlePagination'
import { absoluteURL, getPublishedArticlesPage } from '@/lib/articles'
import { parseArticlePage } from '@/lib/article-utils'

import styles from './articles.module.css'

export const dynamic = 'force-dynamic'

type ArticlesPageProps = {
  searchParams: Promise<{ page?: string | string[] }>
}

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
  const page = parseArticlePage((await searchParams).page)
  const canonical = page <= 1 ? '/articles' : `/articles?page=${page}`
  const title = page <= 1 ? 'Articles' : `Articles – page ${page}`

  return {
    title,
    description: 'Long-form articles, field notes, and downloadable resources.',
    alternates: {
      canonical: absoluteURL(canonical),
    },
    openGraph: {
      type: 'website',
      title,
      description: 'Long-form articles, field notes, and downloadable resources.',
      url: absoluteURL(canonical),
    },
    twitter: {
      card: 'summary',
      title,
      description: 'Long-form articles, field notes, and downloadable resources.',
    },
  }
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const page = parseArticlePage((await searchParams).page)
  const { articles, totalDocs, totalPages } = await getPublishedArticlesPage(page)

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Long reads</p>
        <h1>Articles</h1>
        <p className={styles.pageIntro}>
          In-depth field notes, practical guides, and downloadable resources. Every article is
          readable without an account and without client-side editing controls.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className={styles.empty}>
          {totalDocs === 0 ? (
            <p>No articles have been published yet.</p>
          ) : (
            <>
              <p>No articles are available on page {page}.</p>
              <Link href="/articles">Back to the first page</Link>
            </>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <ArticlePagination page={page} totalPages={totalPages} />
    </section>
  )
}
