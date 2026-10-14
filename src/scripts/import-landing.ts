/**
 * Load the content of the earlier landing site (team, events, home page text, slides, sponsors,
 * logo story) from data/landing.json, with images read from that site's repository.
 *
 *   LANDING_DIR=../daaho pnpm import:landing                 local database
 *   LANDING_DIR=../daaho pnpm import:landing:production      the live database
 *
 * Create-only: a team member, event or image that already exists is left alone, and a home or
 * about field that already has content is not overwritten. Safe to run again. After this, the CMS is
 * the place to edit all of it.
 */
import fs from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'

const LANDING_DIR = path.resolve(process.env.LANDING_DIR ?? '../daaho')
const DATA = path.resolve('data/landing.json')

type Data = {
  team: { group: 'project-team' | 'partners' | 'committee' | 'former-students'; order: number; name: string; title?: string; bio?: string; photo?: string }[]
  slides: { image: string; alt: string; caption?: string }[]
  events: {
    slug: string; title: string; start: string; end: string | null; timeText: string | null; kind: string; location?: string
    link: string | null; summary: string; description: string; sponsors: string[]; images: { file: string; alt: string }[]
  }[]
  home: {
    mission: string; goalsIntro: string; goals: { title: string; text: string }[]; eventsIntro: string
    submitLink: { label: string; url: string }; sponsors: { name: string; logo?: string; url?: string }[]
  }
  about: { logo: { heading: string; image: string; alt: string; text: string } }
}

const KINDS: Record<string, string> = { 'Featured Event': 'exhibit', Conference: 'conference', Launch: 'launch' }

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

async function upload(payload: Payload, file: string, alt: string, counts: { media: number }) {
  const key = `landing/${file}`
  const found = await payload.find({ collection: 'media', where: { sourceFilename: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
  if (found.docs[0]) return found.docs[0].id
  const filePath = path.join(LANDING_DIR, file)
  if (!fs.existsSync(filePath)) throw new Error(`Image missing: ${filePath}`)
  const doc = await payload.create({ collection: 'media', data: { alt, sourceFilename: key, public: true }, filePath, overrideAccess: true })
  counts.media++
  return doc.id
}

const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8')) as Data
  console.log(`Target database: ${describeDatabase()}\nImages from: ${LANDING_DIR}`)
  const payload = await getPayload({ config })

  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const counts = { team: 0, events: 0, media: 0, homeFields: 0, aboutFields: 0 }

  for (const m of data.team) {
    const exists = await payload.find({ collection: 'team', where: { name: { equals: m.name } }, limit: 1, depth: 0, overrideAccess: true })
    if (exists.docs[0]) continue
    const photo = m.photo ? await upload(payload, m.photo, `Portrait of ${m.name}`, counts) : undefined
    await payload.create({ collection: 'team', data: { name: m.name, group: m.group, title: m.title, bio: m.bio, photo, order: m.order }, overrideAccess: true })
    counts.team++
  }

  for (const e of data.events) {
    const exists = await payload.find({ collection: 'project-events', where: { slug: { equals: e.slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
    if (exists.docs[0]) continue
    const images = []
    for (const im of e.images) images.push({ image: await upload(payload, im.file, im.alt, counts) })
    await payload.create({
      collection: 'project-events',
      data: {
        title: e.title, slug: e.slug, start: e.start, end: e.end, timeText: e.timeText,
        kind: (KINDS[e.kind] ?? 'other') as 'exhibit', location: e.location, link: e.link, summary: e.summary,
        description: e.description, images, sponsors: e.sponsors.map((name) => ({ name })),
        _status: 'published', // these were already public on the landing site
      },
      overrideAccess: true,
    })
    counts.events++
  }

  const home = await payload.findGlobal({ slug: 'home', depth: 0, overrideAccess: true })
  const homeData: Record<string, unknown> = {}
  const h = data.home
  if (empty(home.mission)) homeData.mission = h.mission
  if (empty(home.goalsIntro)) homeData.goalsIntro = h.goalsIntro
  if (empty(home.goals)) homeData.goals = h.goals
  if (empty(home.eventsIntro)) homeData.eventsIntro = h.eventsIntro
  if (empty(home.submitLink?.url)) homeData.submitLink = h.submitLink
  if (empty(home.slides)) {
    const slides = []
    for (const s of data.slides) slides.push({ image: await upload(payload, s.image, s.alt, counts), caption: s.caption })
    homeData.slides = slides
  }
  if (empty(home.sponsors)) {
    const sponsors = []
    for (const s of h.sponsors) sponsors.push({ name: s.name, url: s.url, logo: s.logo ? await upload(payload, s.logo, s.name, counts) : undefined })
    homeData.sponsors = sponsors
  }
  counts.homeFields = Object.keys(homeData).length
  if (counts.homeFields) await payload.updateGlobal({ slug: 'home', data: homeData, overrideAccess: true })

  const about = await payload.findGlobal({ slug: 'about', depth: 0, overrideAccess: true })
  if (empty(about.logo?.text)) {
    const l = data.about.logo
    await payload.updateGlobal({
      slug: 'about',
      data: { logo: { heading: l.heading, text: l.text, image: await upload(payload, l.image, l.alt, counts) } },
      overrideAccess: true,
    })
    counts.aboutFields = 1
  }

  console.log(
    `Team members created: ${counts.team}\nProject events created: ${counts.events}\nImages uploaded: ${counts.media}\n` +
      `Home page fields filled: ${counts.homeFields}\nAbout page logo story filled: ${counts.aboutFields ? 'yes' : 'no (already set)'}`,
  )
  process.exit(0)
}

await main()
