import { slugify } from 'payload/shared'
import { slugField, type Access, type CollectionConfig, type Where } from 'payload'

import {
  articleBlocks,
  validateOptionalDuration,
  validateOptionalHttpUrl,
  validateOptionalYouTubeUrl,
} from '@/blocks/ArticleBlocks'
import { normalizeDuration, parseYouTubeId, safeHttpUrl } from '@/lib/article-utils'

const imageUploadFilter = {
  mimeType: { contains: 'image' },
}

const readAccess: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  const now = new Date().toISOString()
  const publishedClause: Where = { _status: { equals: 'published' } }
  const dueClause: Where = { publishedAt: { less_than_equal: now } }

  return {
    and: [publishedClause, dueClause],
  }
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    group: 'Articles',
    useAsTitle: 'title',
    defaultColumns: ['title', 'authorName', 'publishedAt', '_status'],
  },
  defaultSort: '-publishedAt',
  access: {
    read: readAccess,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        // `slugField`'s hook runs after required validation, so fill the slug
        // for title-only creates here. An explicit slug is kept as-is and
        // updates never rewrite an existing slug.
        if (operation === 'create' && data && !data.slug && data.title) {
          data.slug = slugify(data.title)
        }

        return data
      },
    ],
  },
  versions: {
    drafts: {
      schedulePublish: true,
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      useAsSlug: 'title',
      required: true,
      position: 'sidebar',
    }),
    {
      name: 'summary',
      type: 'textarea',
      maxLength: 500,
      admin: {
        description:
          'Optional standfirst for cards and search results. Falls back to the first section text.',
      },
    },
    {
      name: 'authorName',
      type: 'text',
      required: true,
      admin: {
        description: 'Public byline, for example "Jane Doe, Agronomist".',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description:
          'Publication date shown to readers and used for ordering. Scheduled publishing is controlled separately by the document status.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageUploadFilter,
    },
    {
      name: 'tags',
      type: 'array',
      admin: {
        description: 'Free-form discovery tags. Shared tags drive related articles.',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          index: true,
        },
      ],
    },
    {
      name: 'video',
      type: 'group',
      admin: {
        description:
          'Optional resilient video metadata. The page renders the poster and fallback links before any YouTube request.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'youtubeUrl',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
            description: 'Watch, share, embed, or Shorts URL. The iframe is click-to-load.',
          },
          validate: validateOptionalYouTubeUrl,
        },
        {
          name: 'title',
          type: 'text',
          maxLength: 200,
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
            description: 'Optional video title. Falls back to the article title.',
          },
        },
        {
          name: 'poster',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageUploadFilter,
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
          },
        },
        {
          name: 'duration',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
            description: 'Duration in seconds or mm:ss / hh:mm:ss.',
          },
          validate: validateOptionalDuration,
        },
        {
          name: 'externalUrl',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
            description:
              'Optional public watch link. Defaults to the YouTube watch URL or the alternative source.',
          },
          validate: validateOptionalHttpUrl,
        },
        {
          name: 'alternativeSourceUrl',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
            description: 'Optional direct video URL used when YouTube is unavailable.',
          },
          validate: validateOptionalHttpUrl,
        },
        {
          name: 'alternativeMimeType',
          type: 'select',
          defaultValue: 'video/mp4',
          options: [
            { label: 'MP4', value: 'video/mp4' },
            { label: 'WebM', value: 'video/webm' },
            { label: 'Ogg', value: 'video/ogg' },
          ],
          admin: {
            condition: (_data, siblingData) => Boolean(siblingData?.enabled),
          },
        },
      ],
      validate: (value) => {
        if (!value || typeof value !== 'object' || !(value as { enabled?: boolean }).enabled) {
          return true
        }

        const video = value as {
          alternativeSourceUrl?: null | string
          duration?: null | string
          poster?: unknown
          youtubeUrl?: null | string
        }
        const errors: string[] = []

        if (!parseYouTubeId(video.youtubeUrl) && !safeHttpUrl(video.alternativeSourceUrl)) {
          errors.push('Add a valid YouTube URL or a direct alternative video source.')
        }

        if (!video.poster) {
          errors.push('Add a poster image so the preview can render without YouTube.')
        }

        if (!normalizeDuration(video.duration)) {
          errors.push('Add a valid video duration.')
        }

        return errors.length > 0 ? errors.join(' ') : true
      },
    },
    {
      name: 'content',
      type: 'blocks',
      required: true,
      minRows: 1,
      blocks: articleBlocks,
      admin: {
        description:
          'Ordered long-form content. Section blocks are the only source of table-of-contents entries.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO overrides',
      admin: {
        description: 'Optional overrides for the metadata derived from the article.',
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          maxLength: 70,
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          maxLength: 160,
        },
        {
          name: 'socialImage',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageUploadFilter,
        },
      ],
    },
  ],
}
