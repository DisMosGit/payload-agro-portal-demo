import Link from 'next/link'

import { articlePageHref } from '@/lib/article-utils'

import styles from '@/app/(frontend)/articles/articles.module.css'

type ArticlePaginationProps = {
  page: number
  totalPages: number
}

export function ArticlePagination({ page, totalPages }: ArticlePaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav className={styles.pagination} aria-label="Article pagination">
      {page > 1 ? (
        <Link href={articlePageHref(page - 1)} className={styles.pageLink} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={styles.pageLinkDisabled}>Previous</span>
      )}

      <ol className={styles.pageList}>
        {pages.map((number) => (
          <li key={number}>
            <Link
              href={articlePageHref(number)}
              className={number === page ? styles.pageLinkCurrent : styles.pageLink}
              aria-current={number === page ? 'page' : undefined}
            >
              {number}
            </Link>
          </li>
        ))}
      </ol>

      {page < totalPages ? (
        <Link href={articlePageHref(page + 1)} className={styles.pageLink} rel="next">
          Next
        </Link>
      ) : (
        <span className={styles.pageLinkDisabled}>Next</span>
      )}
    </nav>
  )
}
