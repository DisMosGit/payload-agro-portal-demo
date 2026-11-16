import { slugify } from 'payload/shared'
import { slugField, type CollectionConfig } from 'payload'

export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', '_status'],
  },
  defaultSort: '-publishedAt',
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        // `slugField`'s own hook does not fill the slug before validation, so a
        // create with only a title would fail the required check. Generate the
        // slug from the title here; an explicitly supplied slug is kept as-is
        // and updates never rewrite an existing slug.
        if (operation === 'create' && data && !data.slug && data.title) {
          data.slug = slugify(data.title)
        }

        return data
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => (user ? true : { _status: { equals: 'published' } }),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  versions: {
    drafts: true,
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
      name: 'listingDescription',
      type: 'textarea',
      admin: {
        description: 'Optional short summary shown in the news list. Falls back to the body text.',
      },
      maxLength: 300,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
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
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
