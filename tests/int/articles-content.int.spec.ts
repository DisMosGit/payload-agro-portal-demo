// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  articleSummaryText,
  asAttachment,
  buildTableOfContents,
  calculateReadingTime,
  formatArticleDate,
  formatFileSize,
  getVideoState,
  normalizeDuration,
  parseArticlePage,
  parseYouTubeId,
  safeHttpUrl,
  slugifyArticleAnchor,
  youtubeWatchUrl,
} from '@/lib/article-utils'

function richText(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          children: [{ type: 'text', text, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

describe('article table of contents and reading metadata', () => {
  it('follows section order and produces stable anchors', () => {
    const toc = buildTableOfContents([
      { blockType: 'section', heading: 'Why soil health matters', level: 'h2' },
      { blockType: 'section', heading: 'Why soil health matters', level: 'h3' },
      { blockType: 'section', heading: 'Résultats & café', level: 'h2' },
      { blockType: 'section', heading: '日本語', level: 'h2' },
      { blockType: 'section', heading: '', level: 'h3' },
      { blockType: 'section', heading: 'Anything', anchor: 'why-soil-health-matters', level: 'h2' },
    ])

    expect(toc.map((entry) => entry.id)).toEqual([
      'why-soil-health-matters',
      'why-soil-health-matters-2',
      'resultats-cafe',
      'section-4',
      'section-5',
      'why-soil-health-matters-3',
    ])
    expect(toc[1].level).toBe('h3')
    expect(toc[5].label).toBe('Anything')
  })

  it('ignores non-section blocks and empty input', () => {
    expect(buildTableOfContents(null)).toEqual([])
    expect(buildTableOfContents([{ blockType: 'image' }, { blockType: 'downloads' }])).toEqual([])
  })

  it('slugifies headings into URL-safe text and falls back when empty', () => {
    expect(slugifyArticleAnchor('  A Heading!  ')).toBe('a-heading')
    expect(slugifyArticleAnchor('Über café')).toBe('uber-cafe')
    expect(slugifyArticleAnchor('日本語')).toBe('')
  })

  it('never reports less than one minute and scales with prose', () => {
    expect(calculateReadingTime([])).toBe(1)
    expect(
      calculateReadingTime([{ blockType: 'section', heading: 'Short', body: richText('one two') }]),
    ).toBe(1)

    const longText = Array.from({ length: 800 }, (_, index) => `word${index}`).join(' ')
    expect(
      calculateReadingTime([{ blockType: 'section', heading: 'Long', body: richText(longText) }]),
    ).toBe(5)
  })

  it('summarizes from the explicit summary or the first prose', () => {
    expect(articleSummaryText({ summary: 'Explicit summary', content: [] })).toBe(
      'Explicit summary',
    )

    expect(
      articleSummaryText({
        summary: null,
        content: [{ blockType: 'section', heading: 'Heading', body: richText('Body text here') }],
      }),
    ).toContain('Body text here')
  })
})

describe('YouTube and video normalization', () => {
  it('parses every supported YouTube URL shape', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')).toBe(
      'dQw4w9WgXcQ',
    )
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseYouTubeId('javascript:alert(1)')).toBeNull()
    expect(parseYouTubeId('')).toBeNull()
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('normalizes durations and file sizes', () => {
    expect(normalizeDuration('3:45')).toBe('3:45')
    expect(normalizeDuration('225')).toBe('3:45')
    expect(normalizeDuration('1:02:03')).toBe('1:02:03')
    expect(normalizeDuration('not a duration')).toBeNull()
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('returns no video state when the video is disabled', () => {
    expect(getVideoState(null).kind).toBe('none')
    expect(getVideoState({ enabled: false }).kind).toBe('none')
  })

  it('returns a ready state with a poster, duration, and fallback links', () => {
    const state = getVideoState({
      enabled: true,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      title: 'Video title',
      poster: { url: '/api/media/file/poster.jpg', alt: 'Poster alt', width: 1600, height: 900 },
      duration: '3:45',
      alternativeSourceUrl: 'https://example.com/video.mp4',
      alternativeMimeType: 'video/mp4',
    })

    expect(state.kind).toBe('ready')
    expect(state.youtubeId).toBe('dQw4w9WgXcQ')
    expect(state.externalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(state.alternativeUrl).toBe('https://example.com/video.mp4')
    expect(state.posterUrl).toBe('/api/media/file/poster.jpg')
    expect(state.issues).toEqual([])
  })

  it('fails closed when video metadata is incomplete', () => {
    const state = getVideoState({
      enabled: true,
      youtubeUrl: 'https://example.com/not-youtube',
      title: 'Broken video',
      duration: 'nope',
    })

    expect(state.kind).toBe('incomplete')
    expect(state.issues).toEqual(
      expect.arrayContaining([
        'No playable video source is configured.',
        'The video poster is unavailable.',
        'The video duration is unavailable.',
      ]),
    )
  })

  it('uses a direct source without YouTube', () => {
    const state = getVideoState({
      enabled: true,
      alternativeSourceUrl: 'https://example.com/video.webm',
      alternativeMimeType: 'video/webm',
      poster: { url: '/api/media/file/poster.webp', width: 800, height: 450 },
      duration: '1:00',
    })

    expect(state.kind).toBe('ready')
    expect(state.youtubeId).toBeNull()
    expect(state.externalUrl).toBe('https://example.com/video.webm')
    expect(state.alternativeMimeType).toBe('video/webm')
  })

  it('marks missing posters and attachments as unavailable', () => {
    const state = getVideoState({
      enabled: true,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      poster: 42,
      duration: '1:00',
    })

    expect(state.kind).toBe('incomplete')
    expect(state.poster).toBeNull()
    expect(state.issues).toContain('The video poster is unavailable.')
    expect(asAttachment(null)).toBeNull()
    expect(asAttachment({ title: 'No file' })).toBeNull()
  })
})

describe('article formatting and page parsing', () => {
  it('formats publication dates and rejects invalid values', () => {
    expect(formatArticleDate('2026-11-16T12:00:00.000Z')).toBe('16 November 2026')
    expect(formatArticleDate('not-a-date')).toBe('')
    expect(formatArticleDate(null)).toBe('')
  })

  it('parses page numbers and clamps invalid input to one', () => {
    expect(parseArticlePage('2')).toBe(2)
    expect(parseArticlePage(['3', '4'])).toBe(3)
    expect(parseArticlePage('0')).toBe(1)
    expect(parseArticlePage('-2')).toBe(1)
    expect(parseArticlePage('nope')).toBe(1)
    expect(parseArticlePage(undefined)).toBe(1)
  })

  it('accepts only http and https links', () => {
    expect(safeHttpUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('ftp://example.com/file')).toBeNull()
  })
})
