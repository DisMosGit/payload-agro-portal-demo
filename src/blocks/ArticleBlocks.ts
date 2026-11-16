import {
  BlockquoteFeature,
  BoldFeature,
  FixedToolbarFeature,
  InlineCodeFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { Block, Field } from 'payload'

import { normalizeDuration, parseYouTubeId, safeHttpUrl } from '@/lib/article-utils'

const imageUploadFilter = {
  mimeType: { contains: 'image' },
}

/**
 * Article prose deliberately excludes headings, uploads, and tables. Those
 * belong to structured blocks so the table of contents cannot drift from the
 * rendered body and rich text cannot smuggle in another heading source.
 */
export const articleProseEditor = lexicalEditor({
  features: [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    InlineCodeFeature(),
    LinkFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    FixedToolbarFeature(),
  ],
})

const cellFields: Field[] = [
  {
    name: 'value',
    type: 'text',
    required: true,
  },
]

export const articleBlocks: Block[] = [
  {
    slug: 'section',
    labels: {
      singular: 'Section',
      plural: 'Sections',
    },
    fields: [
      {
        name: 'heading',
        type: 'text',
        required: true,
      },
      {
        name: 'level',
        type: 'select',
        required: true,
        defaultValue: 'h2',
        options: [
          { label: 'Heading 2', value: 'h2' },
          { label: 'Heading 3', value: 'h3' },
        ],
      },
      {
        name: 'anchor',
        type: 'text',
        admin: {
          description:
            'Optional URL-safe override for the table-of-contents anchor. Leave blank to derive it from the heading.',
        },
      },
      {
        name: 'body',
        type: 'richText',
        required: true,
        editor: articleProseEditor,
      },
    ],
  },
  {
    slug: 'image',
    labels: {
      singular: 'Image',
      plural: 'Images',
    },
    fields: [
      {
        name: 'image',
        type: 'upload',
        relationTo: 'media',
        required: true,
        filterOptions: imageUploadFilter,
      },
      {
        name: 'caption',
        type: 'textarea',
        maxLength: 500,
      },
      {
        name: 'credit',
        type: 'text',
        maxLength: 200,
      },
      {
        name: 'size',
        type: 'select',
        defaultValue: 'normal',
        options: [
          { label: 'Normal', value: 'normal' },
          { label: 'Wide', value: 'wide' },
        ],
      },
    ],
  },
  {
    slug: 'gallery',
    labels: {
      singular: 'Gallery',
      plural: 'Galleries',
    },
    fields: [
      {
        name: 'images',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Image',
          plural: 'Images',
        },
        fields: [
          {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            required: true,
            filterOptions: imageUploadFilter,
          },
          {
            name: 'caption',
            type: 'textarea',
            maxLength: 500,
          },
        ],
      },
    ],
  },
  {
    slug: 'table',
    labels: {
      singular: 'Table',
      plural: 'Tables',
    },
    fields: [
      {
        name: 'caption',
        type: 'text',
        maxLength: 300,
      },
      {
        name: 'columns',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Column',
          plural: 'Columns',
        },
        fields: [
          {
            name: 'label',
            type: 'text',
            required: true,
          },
        ],
      },
      {
        name: 'rows',
        type: 'array',
        required: true,
        minRows: 1,
        validate: (value, { siblingData }) => {
          if (!Array.isArray(value) || value.length === 0) {
            return 'Add at least one table row.'
          }

          const columns = Array.isArray((siblingData as { columns?: unknown[] })?.columns)
            ? ((siblingData as { columns: unknown[] }).columns?.length ?? 0)
            : 0
          const expectedCells = Math.max(columns, 1)

          for (const [index, row] of value.entries()) {
            const cells = (row as { cells?: unknown[] })?.cells

            if (!Array.isArray(cells) || cells.length !== expectedCells) {
              return `Row ${index + 1} must contain exactly ${expectedCells} cells.`
            }
          }

          return true
        },
        labels: {
          singular: 'Row',
          plural: 'Rows',
        },
        fields: [
          {
            name: 'cells',
            type: 'array',
            required: true,
            minRows: 1,
            labels: {
              singular: 'Cell',
              plural: 'Cells',
            },
            fields: cellFields,
          },
        ],
      },
    ],
  },
  {
    slug: 'callout',
    labels: {
      singular: 'Callout',
      plural: 'Callouts',
    },
    fields: [
      {
        name: 'variant',
        type: 'select',
        required: true,
        defaultValue: 'info',
        options: [
          { label: 'Information', value: 'info' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
        ],
      },
      {
        name: 'title',
        type: 'text',
        maxLength: 200,
      },
      {
        name: 'body',
        type: 'richText',
        required: true,
        editor: articleProseEditor,
      },
    ],
  },
  {
    slug: 'footnotes',
    labels: {
      singular: 'Footnotes',
      plural: 'Footnotes',
    },
    fields: [
      {
        name: 'notes',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Note',
          plural: 'Notes',
        },
        fields: [
          {
            name: 'note',
            type: 'textarea',
            required: true,
          },
        ],
      },
    ],
  },
  {
    slug: 'downloads',
    labels: {
      singular: 'Downloads',
      plural: 'Downloads',
    },
    fields: [
      {
        name: 'items',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Download',
          plural: 'Downloads',
        },
        fields: [
          {
            name: 'file',
            type: 'upload',
            relationTo: 'article-attachments',
            required: true,
          },
          {
            name: 'label',
            type: 'text',
            required: true,
            maxLength: 200,
          },
          {
            name: 'description',
            type: 'textarea',
            maxLength: 300,
          },
        ],
      },
    ],
  },
]

export function validateOptionalYouTubeUrl(value: unknown): string | true {
  if (typeof value !== 'string' || value.trim() === '') {
    return true
  }

  return parseYouTubeId(value) ? true : 'Enter a valid YouTube video URL.'
}

export function validateOptionalHttpUrl(value: unknown): string | true {
  if (typeof value !== 'string' || value.trim() === '') {
    return true
  }

  return safeHttpUrl(value) ? true : 'Enter a valid http:// or https:// URL.'
}

export function validateOptionalDuration(value: unknown): string | true {
  if (typeof value !== 'string' || value.trim() === '') {
    return true
  }

  return normalizeDuration(value)
    ? true
    : 'Use a duration in seconds or in mm:ss / hh:mm:ss format.'
}
