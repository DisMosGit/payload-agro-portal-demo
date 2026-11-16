import type { CollectionConfig } from 'payload'

/**
 * Public document formats accepted for article downloads.
 *
 * Keep this list in sync with the README. ZIP archives are included because
 * downloadable document bundles are a normal article attachment; executables,
 * HTML, and SVG are deliberately excluded because they are served publicly.
 */
export const ARTICLE_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/zip',
  'application/x-zip-compressed',
] as const

export const ArticleAttachments: CollectionConfig = {
  slug: 'article-attachments',
  admin: {
    group: 'Articles',
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'mimeType', 'filesize', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    staticDir: 'media/article-attachments',
    mimeTypes: [...ARTICLE_ATTACHMENT_MIME_TYPES],
    filesRequiredOnCreate: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name shown in the article download list.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 300,
    },
  ],
}
