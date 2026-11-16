import type { TocEntry } from '@/lib/article-utils'

import styles from '@/app/(frontend)/articles/articles.module.css'

export function ArticleTableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) {
    return null
  }

  return (
    <nav className={styles.toc} aria-label="Table of contents">
      <p className={styles.tocLabel}>In this article</p>
      <ol className={styles.tocList}>
        {entries.map((entry) => (
          <li key={entry.id} className={entry.level === 'h3' ? styles.tocNested : undefined}>
            <a href={`#${entry.id}`}>{entry.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
