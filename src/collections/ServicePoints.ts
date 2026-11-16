import type { CollectionConfig } from 'payload'

export const servicePointTypes = [
  { label: 'Dealer', value: 'dealer' },
  { label: 'Service centre', value: 'service-centre' },
  { label: 'Warehouse', value: 'warehouse' },
] as const

export const ServicePoints: CollectionConfig = {
  slug: 'service-points',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'latitude', 'longitude'],
  },
  defaultSort: 'name',
  access: {
    // Service points are public directory data; every other operation is
    // reserved for an authenticated administrator session.
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: servicePointTypes.map((option) => ({ ...option })),
    },
    {
      name: 'latitude',
      type: 'number',
      required: true,
      min: -90,
      max: 90,
    },
    {
      name: 'longitude',
      type: 'number',
      required: true,
      min: -180,
      max: 180,
    },
    {
      name: 'address',
      type: 'textarea',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'website',
      type: 'text',
    },
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 500,
    },
  ],
}
