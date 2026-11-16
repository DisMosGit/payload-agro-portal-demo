import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import Image from 'next/image'
import { Fragment } from 'react'

import type { Article, Media } from '@/payload-types'
import {
  asAttachment,
  asMedia,
  formatFileSize,
  slugifyArticleAnchor,
  type TocEntry,
} from '@/lib/article-utils'

import styles from '@/app/(frontend)/articles/articles.module.css'

type ArticleBodyProps = {
  blocks: Article['content']
  toc: TocEntry[]
}

export function ArticleBody({ blocks, toc }: ArticleBodyProps) {
  const anchors = new Map(toc.map((entry) => [entry.blockIndex, entry.id]))

  return (
    <div className={styles.articleBody}>
      {blocks.map((block, blockIndex) => {
        switch (block.blockType) {
          case 'section': {
            const id = anchors.get(blockIndex) ?? `section-${blockIndex + 1}`
            const Heading = block.level === 'h3' ? 'h3' : 'h2'

            return (
              <section key={block.id ?? id} id={id} className={styles.section}>
                <Heading>{block.heading}</Heading>
                <RichText data={block.body as unknown as SerializedEditorState} />
              </section>
            )
          }

          case 'image':
            return (
              <Fragment key={block.id ?? blockIndex}>
                <ArticleFigure
                  media={block.image}
                  caption={block.caption}
                  credit={block.credit}
                  wide={block.size === 'wide'}
                />
              </Fragment>
            )

          case 'gallery':
            return (
              <section
                key={block.id ?? blockIndex}
                className={styles.gallery}
                aria-label="Image gallery"
              >
                {block.images.map((item, imageIndex) => (
                  <ArticleFigure
                    key={item.id ?? imageIndex}
                    media={item.image}
                    caption={item.caption}
                  />
                ))}
              </section>
            )

          case 'table':
            return (
              <div key={block.id ?? blockIndex} className={styles.tableWrapper}>
                <table className={styles.table}>
                  {block.caption ? <caption>{block.caption}</caption> : null}
                  <thead>
                    <tr>
                      {block.columns.map((column) => (
                        <th key={column.id ?? column.label} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={row.id ?? rowIndex}>
                        {row.cells.map((cell, cellIndex) => (
                          <td key={cell.id ?? cellIndex}>{cell.value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'callout':
            return (
              <aside
                key={block.id ?? blockIndex}
                className={styles.callout}
                data-variant={block.variant}
              >
                {block.title ? <p className={styles.calloutTitle}>{block.title}</p> : null}
                <RichText data={block.body as unknown as SerializedEditorState} />
              </aside>
            )

          case 'footnotes':
            return (
              <aside
                key={block.id ?? blockIndex}
                className={styles.footnotes}
                aria-label="Footnotes"
              >
                <h2>Footnotes</h2>
                <ol>
                  {block.notes.map((note, noteIndex) => {
                    const suffix = slugifyArticleAnchor(block.id ?? '') || String(blockIndex + 1)

                    return (
                      <li key={note.id ?? noteIndex} id={`footnote-${suffix}-${noteIndex + 1}`}>
                        {note.note}
                      </li>
                    )
                  })}
                </ol>
              </aside>
            )

          case 'downloads':
            return (
              <section
                key={block.id ?? blockIndex}
                className={styles.downloads}
                aria-label="Downloads"
              >
                <h2>Downloads</h2>
                <ul>
                  {block.items.map((item, itemIndex) => {
                    const file = asAttachment(item.file)

                    return (
                      <li key={item.id ?? itemIndex} className={styles.downloadItem}>
                        {file ? (
                          <a
                            href={file.url ?? undefined}
                            download={file.filename ?? undefined}
                            className={styles.downloadLink}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <span className={styles.unavailable}>
                            Download unavailable: {item.label}
                          </span>
                        )}
                        {item.description ? (
                          <p className={styles.downloadDescription}>{item.description}</p>
                        ) : null}
                        {file ? (
                          <p className={styles.downloadMeta}>
                            {[file.mimeType, formatFileSize(file.filesize)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

type ArticleFigureProps = {
  caption?: null | string
  credit?: null | string
  media: Media | number | null
  wide?: boolean
}

function ArticleFigure({ caption, credit, media, wide = false }: ArticleFigureProps) {
  const image = asMedia(media) as Media | null

  if (!image) {
    return (
      <figure className={wide ? `${styles.figure} ${styles.figureWide}` : styles.figure}>
        <p className={styles.unavailable}>Image unavailable.</p>
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    )
  }

  return (
    <figure className={wide ? `${styles.figure} ${styles.figureWide}` : styles.figure}>
      <Image
        src={image.url ?? ''}
        alt={image.alt || caption || 'Article image'}
        width={image.width ?? 1200}
        height={image.height ?? 800}
        sizes={wide ? '(max-width: 64rem) 100vw, 64rem' : '(max-width: 48rem) 100vw, 48rem'}
        className={styles.figureImage}
      />
      {caption || credit ? (
        <figcaption>
          {caption}
          {credit ? <span className={styles.credit}> {credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  )
}
