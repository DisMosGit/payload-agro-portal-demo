// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import {
  articleRichText,
  cleanupArticleRefs,
  uniqueArticleSlug,
  type ArticleRef,
} from '../helpers/seedArticles'

let payload: Payload
let adminUser: User
let article: ArticleRef

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `articles-schedule-${unique}@example.com`

describe('scheduled article publication', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: 'test' },
    })

    const slug = uniqueArticleSlug('scheduled-job-article')
    const bodyText = `Scheduled job article body ${unique}`
    const created = await payload.create({
      collection: 'articles',
      data: {
        title: `Scheduled job article ${unique}`,
        slug,
        summary: `Scheduled job summary ${unique}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date().toISOString(),
        tags: [{ tag: 'scheduled-test' }],
        content: [
          {
            blockType: 'section',
            heading: 'Scheduled section',
            level: 'h2',
            body: articleRichText(bodyText),
          },
        ],
      },
      draft: true,
      user: adminUser,
      overrideAccess: false,
    })

    article = { bodyText, id: created.id, slug, title: created.title }
  })

  afterAll(async () => {
    if (article) {
      await cleanupArticleRefs([article], payload)
    }

    if (adminUser) {
      await payload.delete({ collection: 'users', id: adminUser.id })
    }
  })

  it('queues the native schedulePublish task and publishes on the next read', async () => {
    const before = await payload.find({
      collection: 'articles',
      where: { slug: { equals: article.slug } },
      overrideAccess: false,
    })

    expect(before.docs).toHaveLength(0)

    const job = await payload.jobs.queue({
      task: 'schedulePublish',
      input: {
        type: 'publish',
        doc: {
          relationTo: 'articles',
          value: article.id,
        },
        user: {
          relationTo: 'users',
          value: adminUser.id,
        },
      },
      waitUntil: new Date(Date.now() + 300),
    })

    expect(job.taskSlug).toBe('schedulePublish')

    // Do not depend on the one-minute autoRun tick: wait until the job is due,
    // then run the queue directly in this test.
    await new Promise((resolve) => setTimeout(resolve, 500))
    await payload.jobs.run({ queue: 'default' })

    const after = await payload.find({
      collection: 'articles',
      where: { slug: { equals: article.slug } },
      overrideAccess: false,
    })

    expect(after.docs).toHaveLength(1)
    expect(after.docs[0].id).toBe(article.id)
    expect(after.docs[0]._status).toBe('published')
  })
})
