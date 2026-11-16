import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

/**
 * Pure article presentation helpers.
 *
 * This module deliberately has no Payload config or database imports so the
 * collection config can reuse the URL/duration validators without creating a
 * circular dependency on `@payload-config`.
 */

export const ARTICLE_PAGE_SIZE = 9
export const ARTICLE_WORDS_PER_MINUTE = 200

export type ArticleMediaLike = {
  alt?: null | string
  filename?: null | string
  filesize?: null | number
  height?: null | number
  id?: number | string
  mimeType?: null | string
  url?: null | string
  width?: null | number
}

export type ArticleAttachmentLike = ArticleMediaLike & {
  description?: null | string
  title?: null | string
}

export type ArticleVideoLike =
  | null
  | undefined
  | {
      alternativeMimeType?: null | string
      alternativeSourceUrl?: null | string
      duration?: null | string
      enabled?: boolean | null
      externalUrl?: null | string
      poster?: ArticleMediaLike | number | string | null
      title?: null | string
      youtubeUrl?: null | string
    }

export type ArticleBlockLike = {
  blockType?: null | string
  [key: string]: unknown
}

export type TocEntry = {
  blockIndex: number
  id: string
  label: string
  level: 'h2' | 'h3'
}

export type VideoState = {
  alternativeMimeType: null | string
  alternativeUrl: null | string
  duration: null | string
  externalUrl: null | string
  issues: string[]
  kind: 'incomplete' | 'none' | 'ready'
  poster: ArticleMediaLike | null
  posterAlt: string
  posterUrl: null | string
  title: null | string
  youtubeId: null | string
  youtubeUrl: null | string
}

const articleDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatArticleDate(value: null | string | undefined): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : articleDateFormatter.format(date)
}

export function asMedia(value: unknown): ArticleMediaLike | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const media = value as ArticleMediaLike

  return typeof media.url === 'string' && media.url.length > 0 ? media : null
}

export function asAttachment(value: unknown): ArticleAttachmentLike | null {
  const attachment = asMedia(value)

  return attachment ? (attachment as ArticleAttachmentLike) : null
}

/**
 * Produces a URL-safe slug from a heading, or an empty string when the heading
 * has no Latin alphanumeric characters. Callers then use the positional
 * `section-N` fallback.
 */
export function slugifyArticleAnchor(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildTableOfContents(blocks: readonly unknown[] | null | undefined): TocEntry[] {
  if (!Array.isArray(blocks)) {
    return []
  }

  const used = new Set<string>()
  const entries: TocEntry[] = []
  let sectionNumber = 0

  blocks.forEach((raw, blockIndex) => {
    const block = asBlock(raw)

    if (block?.blockType !== 'section') {
      return
    }

    sectionNumber += 1
    const heading = typeof block.heading === 'string' ? block.heading : ''
    const anchor = typeof block.anchor === 'string' ? block.anchor : ''
    const base = slugifyArticleAnchor(anchor || heading) || `section-${sectionNumber}`
    let id = base
    let suffix = 2

    while (used.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }

    used.add(id)
    entries.push({
      blockIndex,
      id,
      label: heading || `Section ${sectionNumber}`,
      level: block.level === 'h3' ? 'h3' : 'h2',
    })
  })

  return entries
}

export function lexicalToPlainText(value: unknown): string {
  if (!value || typeof value !== 'object' || !('root' in value)) {
    return ''
  }

  try {
    return convertLexicalToPlaintext({
      data: value as SerializedEditorState,
    })
  } catch {
    return ''
  }
}

export function articlePlainText(blocks: readonly unknown[] | null | undefined): string {
  if (!Array.isArray(blocks)) {
    return ''
  }

  const parts: string[] = []

  for (const raw of blocks) {
    const block = asBlock(raw)

    if (!block) {
      continue
    }

    switch (block?.blockType) {
      case 'section':
        if (typeof block.heading === 'string') {
          parts.push(block.heading)
        }
        parts.push(lexicalToPlainText(block.body))
        break

      case 'image':
        if (typeof block.caption === 'string') {
          parts.push(block.caption)
        }
        break

      case 'gallery':
        for (const item of asArray(block.images)) {
          if (typeof item.caption === 'string') {
            parts.push(item.caption)
          }
        }
        break

      case 'table':
        if (typeof block.caption === 'string') {
          parts.push(block.caption)
        }
        for (const column of asArray(block.columns)) {
          if (typeof column.label === 'string') {
            parts.push(column.label)
          }
        }
        for (const row of asArray(block.rows)) {
          for (const cell of asArray(row.cells)) {
            if (typeof cell.value === 'string') {
              parts.push(cell.value)
            }
          }
        }
        break

      case 'callout':
        if (typeof block.title === 'string') {
          parts.push(block.title)
        }
        parts.push(lexicalToPlainText(block.body))
        break

      case 'footnotes':
        for (const note of asArray(block.notes)) {
          if (typeof note.note === 'string') {
            parts.push(note.note)
          }
        }
        break

      case 'downloads':
        for (const item of asArray(block.items)) {
          if (typeof item.label === 'string') {
            parts.push(item.label)
          }
          if (typeof item.description === 'string') {
            parts.push(item.description)
          }
        }
        break
    }
  }

  return parts.join('\n\n').replace(/\s+/g, ' ').trim()
}

export function calculateReadingTime(blocks: readonly unknown[] | null | undefined): number {
  const text = articlePlainText(blocks)
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0

  return Math.max(1, Math.ceil(words / ARTICLE_WORDS_PER_MINUTE))
}

export function plainTextExcerpt(value: string, maxLength = 200): string {
  const normalized = value.replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`
}

export function articleSummaryText(
  article: { content?: null | readonly unknown[]; summary?: null | string },
  maxLength = 200,
): string {
  const summary = article.summary?.trim()

  return summary ? summary : plainTextExcerpt(articlePlainText(article.content), maxLength)
}

export function parseArticlePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? '', 10)

  return Number.isFinite(page) && page >= 1 ? page : 1
}

export function articlePageHref(page: number): string {
  return page <= 1 ? '/articles' : `/articles?page=${page}`
}

/**
 * Parses the YouTube URL shapes editors actually paste. Returns the video id
 * only; the frontend builds its own privacy-enhanced embed URL.
 */
export function parseYouTubeId(value: null | string | undefined): string | null {
  const raw = value?.trim()

  if (!raw) {
    return null
  }

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL

  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  let candidate: null | string = null

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v')
    } else {
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) {
        candidate = parts[1] ?? null
      }
    }
  }

  return candidate && /^[A-Za-z0-9_-]{6,20}$/.test(candidate) ? candidate : null
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
}

export function safeHttpUrl(value: null | string | undefined): string | null {
  const raw = value?.trim()

  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function normalizeDuration(value: null | string | undefined): string | null {
  const raw = value?.trim()

  if (!raw) {
    return null
  }

  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(raw)

  if (match) {
    return raw
  }

  const seconds = Number(raw)

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null
  }

  const wholeSeconds = Math.floor(seconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainder = wholeSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function formatFileSize(value: null | number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return ''
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function getVideoState(video: ArticleVideoLike, fallbackTitle?: null | string): VideoState {
  if (!video?.enabled) {
    return {
      alternativeMimeType: null,
      alternativeUrl: null,
      duration: null,
      externalUrl: null,
      issues: [],
      kind: 'none',
      poster: null,
      posterAlt: '',
      posterUrl: null,
      title: null,
      youtubeId: null,
      youtubeUrl: null,
    }
  }

  const youtubeId = parseYouTubeId(video.youtubeUrl)
  const alternativeUrl = safeHttpUrl(video.alternativeSourceUrl)
  const externalUrl =
    safeHttpUrl(video.externalUrl) ?? (youtubeId ? youtubeWatchUrl(youtubeId) : alternativeUrl)
  const poster = asMedia(video.poster)
  const duration = normalizeDuration(video.duration)
  const title = video.title?.trim() || fallbackTitle?.trim() || null
  const issues: string[] = []

  if (!youtubeId && !alternativeUrl) {
    issues.push('No playable video source is configured.')
  }

  if (!poster) {
    issues.push('The video poster is unavailable.')
  }

  if (!duration) {
    issues.push('The video duration is unavailable.')
  }

  return {
    alternativeMimeType: video.alternativeMimeType?.trim() || null,
    alternativeUrl,
    duration,
    externalUrl,
    issues,
    kind: issues.length > 0 ? 'incomplete' : 'ready',
    poster,
    posterAlt: poster?.alt?.trim() || title || 'Video poster',
    posterUrl: poster?.url ?? null,
    title,
    youtubeId,
    youtubeUrl: youtubeId ? youtubeWatchUrl(youtubeId) : null,
  }
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      )
    : []
}

function asBlock(value: unknown): ArticleBlockLike | null {
  return value && typeof value === 'object' ? (value as ArticleBlockLike) : null
}
