// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

let payload: Payload
let adminUser: User
const createdAttachmentIDs: number[] = []

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `attachments-admin-${unique}@example.com`

function documentFile(name: string, mimetype = 'application/pdf') {
  const data = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 0>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n`,
  )

  return {
    data,
    mimetype,
    name,
    size: data.length,
  }
}

describe('article attachment access control', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: 'test' },
    })
  })

  afterAll(async () => {
    for (const id of createdAttachmentIDs) {
      await payload.delete({ collection: 'article-attachments', id }).catch(() => undefined)
    }

    if (adminUser) {
      await payload.delete({ collection: 'users', id: adminUser.id })
    }
  })

  it('allows public reads of a stored document', async () => {
    const created = await payload.create({
      collection: 'article-attachments',
      data: {
        title: `Public attachment ${unique}`,
        description: 'Visible to visitors',
      },
      file: documentFile(`public-attachment-${unique}.pdf`),
      user: adminUser,
      overrideAccess: false,
    })
    createdAttachmentIDs.push(created.id)

    const publicRead = await payload.find({
      collection: 'article-attachments',
      where: { id: { equals: created.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0].title).toBe(`Public attachment ${unique}`)
    expect(publicRead.docs[0].mimeType).toBe('application/pdf')
    expect(publicRead.docs[0].url).toBeTruthy()
  })

  it('rejects an anonymous create and upload without storing a document', async () => {
    const title = `Anonymous attachment ${unique}`

    await expect(
      payload.create({
        collection: 'article-attachments',
        data: { title },
        file: documentFile(`anonymous-attachment-${unique}.pdf`),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stored = await payload.find({
      collection: 'article-attachments',
      where: { title: { equals: title } },
    })

    expect(stored.docs).toHaveLength(0)
  })

  it('rejects an anonymous update and leaves the document unchanged', async () => {
    const id = createdAttachmentIDs[0]

    await expect(
      payload.update({
        collection: 'article-attachments',
        id,
        data: { title: 'Hijacked attachment title' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const unchanged = await payload.findByID({
      collection: 'article-attachments',
      id,
    })

    expect(unchanged.title).toBe(`Public attachment ${unique}`)
  })

  it('rejects an anonymous delete and leaves the document in place', async () => {
    const id = createdAttachmentIDs[0]

    await expect(
      payload.delete({
        collection: 'article-attachments',
        id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stillThere = await payload.findByID({
      collection: 'article-attachments',
      id,
    })

    expect(stillThere.id).toBe(id)
  })

  it('accepts an authenticated administrator upload', async () => {
    const created = await payload.create({
      collection: 'article-attachments',
      data: { title: `Admin attachment ${unique}` },
      file: documentFile(`admin-attachment-${unique}.pdf`),
      user: adminUser,
      overrideAccess: false,
    })
    createdAttachmentIDs.push(created.id)

    expect(created.id).toBeDefined()
    expect(created.filename).toBe(`admin-attachment-${unique}.pdf`)
  })

  it('rejects a disallowed executable upload from an authenticated administrator', async () => {
    const title = `Rejected executable ${unique}`
    const data = Buffer.from('MZ executable fixture')

    await expect(
      payload.create({
        collection: 'article-attachments',
        data: { title },
        file: {
          data,
          mimetype: 'application/x-msdownload',
          name: `rejected-${unique}.exe`,
          size: data.length,
        },
        user: adminUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stored = await payload.find({
      collection: 'article-attachments',
      where: { title: { equals: title } },
    })

    expect(stored.docs).toHaveLength(0)
  })
})
