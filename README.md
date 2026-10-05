# DAAHO Portfolio

The public website for **Documenting Asian American Histories in Ohio**: an exhibit of letters,
documents and photographs from Miami University's collections, with a CMS that lets project staff
review, edit and publish them.

Item descriptions and transcriptions come from the
[DAAHO metadata pipeline](https://github.com/Meng-V/daaho-metadata-pipeline), which reads the scans
with AI. This site imports that output, puts every item through human review, and publishes it.

**Stack:** Next.js 16 + Payload CMS 3 (in the same app) + PostgreSQL. Deploys to Vercel with Neon.

## Run it locally

Requirements: Node 20+, pnpm, PostgreSQL 15+.

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL and PAYLOAD_SECRET
pnpm dev                      # http://localhost:3000, CMS at /admin
```

The first account created at `/admin` becomes an **admin**. Every account after that defaults to
contributor; an admin assigns roles.

On macOS with Homebrew Postgres, if the server refuses to start with
`postmaster became multithreaded during startup`, start it with a locale set:

```bash
LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@17 -l /opt/homebrew/var/postgresql@17/server.log start
```

## Import from the pipeline

```bash
DRY_RUN=1 pnpm import:pipeline   # report only: what would be created, what needs review
pnpm import:pipeline             # create items, scans, people, places, subjects, genres
```

Reads `../daaho-metadata-pipeline/out_batch/*.loc15.json` and `../daaho-metadata-pipeline/images/`
(override with `PIPELINE_DIR`). Run it on your own machine against whichever database
`DATABASE_URL` points to — never as a serverless function, since uploading scans takes minutes.

The importer is **create-only**. Anything already in the CMS is left untouched, so re-running it
never overwrites an editor's work. To re-import one item from scratch, delete it in the CMS first.

What it will not guess at, and reports instead:

- **Names that cannot be parsed** — e.g. model reasoning that leaked into a name field, or several
  people in one string — are not turned into people. They appear in the item's *Import issues*.
- **Names that might be the same person** ("Upham, A. H." / "Upham, Alfred H.") are not merged.
  They appear under *Possible duplicates* on each person, for an editor to decide. Only names that
  are provably identical — differing in punctuation, spacing or name order — merge automatically.

## Roles

| Role | Can |
|---|---|
| Admin | Everything, including creating accounts and assigning roles |
| Editor | Edit and publish items, people, pages |
| Contributor | Create and edit drafts; cannot publish |

## Historical context

Items show events in East Asian and Asian American history from their year, for the regions they
concern (**Context** tab on each item; `/timeline` for all of them). Events live in the **Historical
events** collection.

```bash
pnpm import:events      # load data/context-events.json as drafts (create-only)
pnpm backfill:regions   # set regions on items that have none, from title, description and places
```

`data/context-events.json` is a starter set of 33 events drafted with AI. **None is public until an
editor marks it Reviewed and adds at least one source** — AI gets dates, numbers and names wrong,
and these sit beside archival documents. To add more, generate entries in the same JSON shape (see
the header of `src/scripts/import-events.ts`) and run `pnpm import:events` again; existing events
are never overwritten.

## Reviewing duplicate people

Editors and admins see **Review duplicates** in the site header (`/review/people`). Each group is
one decision: choose the record to keep, tick the ones that are the same person, and merge — or
mark them as different people. Merges are transactional and survive re-import.

## Publishing rules

Enforced by the CMS, not by convention (see `src/hooks/items.ts`, tested in
`tests/int/publishing.int.spec.ts`):

1. An item cannot be published until its description is marked **Reviewed**. The reviewer and date
   are recorded automatically and shown on the public page.
2. An item cannot be published without a **rights statement**.
3. **Scans are private until their item is published**, including by direct URL, and become private
   again if it is unpublished.

## Tests

```bash
pnpm test:unit   # name handling and dates — no database needed
pnpm test:int    # publishing rules and people merges, against DATABASE_URL (creates and removes its own test records)
```

## Before deploying to Vercel

- **Add an object-storage adapter for media** (Vercel Blob, Cloudflare R2 or S3). Scans are stored on
  local disk in development; Vercel's filesystem is temporary, so uploads would vanish on the next
  deploy.
- **Vercel Pro is required**, not Hobby: Vercel's Hobby terms exclude projects built by a paid
  employee.
- Use `@payloadcms/db-postgres` with Neon's connection string; not `db-vercel-postgres`, whose
  underlying driver Vercel no longer maintains.
- Generate migrations (`pnpm payload migrate:create`) rather than relying on development-mode schema
  push.

See [PLAN.md](PLAN.md) for the architecture and phases.
