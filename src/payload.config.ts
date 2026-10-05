import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

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
  collections: [Items, People, Places, Subjects, Genres, Media, Team, Users],
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
  }),
  sharp,
  plugins: [],
})
