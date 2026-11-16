import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { News } from './collections/News'
import { ArticleAttachments } from './collections/ArticleAttachments'
import { Articles } from './collections/Articles'
import { ServicePoints } from './collections/ServicePoints'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, ArticleAttachments, Articles, News, ServicePoints],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  jobs: {
    // Scheduled publishing is a Payload job. A long-running app process (the
    // Compose app service or `pnpm dev`) runs this queue every minute. Serverless
    // deployments need an external cron that calls /api/payload-jobs/run.
    autoRun: [{ cron: '* * * * *', queue: 'default' }],
  },
  plugins: [],
})
