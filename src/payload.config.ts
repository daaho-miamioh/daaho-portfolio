import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Events } from './collections/Events'
import { Genres } from './collections/Genres'
import { Items } from './collections/Items'
import { Media } from './collections/Media'
import { People } from './collections/People'
import { Places } from './collections/Places'
import { Subjects } from './collections/Subjects'
import { Team } from './collections/Team'
import { Users } from './collections/Users'
import { About } from './globals/About'
import { Home } from './globals/Home'

/**
 * Where uploaded files live. Locally: the ./media folder. In production: a PRIVATE S3-compatible bucket
 * (Cloudflare R2 or AWS S3), set by the S3_* variables.
 *
 * Not Vercel Blob: Payload's Vercel Blob adapter only writes public blobs, and these are archival scans
 * whose rights are not yet cleared — a public bucket with guessable names (AAMU-0001_Recto.jpg) would
 * undo the rule that a scan is private until its item is published.
 *
 * Every file request still goes through Payload, which checks the media collection's read access first
 * and only then redirects to a short-lived signed URL. That keeps unpublished scans private, and keeps
 * 4-9 MB originals out of Vercel's 4.5 MB function response limit.
 */
// Registered in every environment, enabled only when a bucket is configured. A plugin that existed only
// in production would add a column (_objectKey) and an admin component that local migrations and the
// import map never saw, and production would fail on its first upload.
const storage = s3Storage({
  enabled: Boolean(process.env.S3_BUCKET),
  alwaysInsertFields: true,
  collections: { media: { signedDownloads: { expiresIn: 300 } } },
  bucket: process.env.S3_BUCKET || '',
  config: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },
})

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' — DAAHO' },
  },
  collections: [Items, Events, People, Places, Subjects, Genres, Media, Team, Users],
  globals: [Home, About],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Production schema changes go through migrations (src/migrations), run by `vercel-build`;
    // development keeps pushing the schema automatically.
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [storage],
})
