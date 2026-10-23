# DAAHO Portfolio

The public website for **Documenting Asian American Histories in Ohio**: an exhibit of letters,
documents and photographs from Miami University's collections, with a CMS that lets project staff
review, edit and publish them.

Item descriptions and transcriptions come from the
[DAAHO metadata pipeline](https://github.com/daaho-miamioh/daaho-metadata-pipeline), which reads the scans
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
| Editor | Edit and publish items, people, pages; approve others' annotations |
| Contributor | Create and edit drafts; write annotations; cannot publish or approve |

## Historical context

Items show events in East Asian and Asian American history from their year, for the regions they
concern (**Context** tab on each item; `/timeline` for all of them). They live in the **Historical
contexts** collection.

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

## Annotating transcripts

Any signed-in user can annotate a transcript: open an item, go to the **Annotations** tab, select a
passage, choose a category, write the note, and **Submit for review** (or save it as a draft). The
passage is stored with the text around it, so a note stays attached if the transcript is later
corrected; if the passage itself is removed, the note is flagged in the editor.

Nothing is public until it is approved, and **nobody can approve an annotation they wrote or last
changed** — every public note has had two people. Editors and admins approve or return notes from
the item's Annotations tab or from **Review annotations** in the site header
(`/review/annotations`), which lists everything waiting across all items. Changing the text of an
approved note sends it back for review. Approved notes appear on the public item page as numbered
highlights with the notes listed below the transcript. Rules are in `src/hooks/annotations.ts`,
tested in `tests/int/annotations.int.spec.ts`.

## Site content: home page, events and team

This site replaces the earlier landing site at daaho.lib.miamioh.edu, and its content is now edited
here rather than in code:

- **Site → Home page**: introduction, slideshow, mission and goals, events introduction, sponsors,
  and the *Submit a collection* button in the header.
- **Site → Project events**: exhibits, talks and conferences. Each is listed as upcoming until its
  last day (Ohio time), then as a past event — nothing to move by hand. Drafts are not public; an
  event's images become public when it is published. Not to be confused with **Historical contexts**,
  which give context to items.
- **Site → Team**: shown on the About page in four groups, ordered by the *order* number.
- **Site → About page**: the project description and the story of the logo.

Old landing-site addresses redirect: `/past/<event>` → `/events/<event>`, `/news` → `/events`.

The landing site's content was loaded once from `data/landing.json` (extracted from the old
repository's code) with its images read from a checkout of that repository:

```bash
LANDING_DIR=../daaho pnpm import:landing              # local
LANDING_DIR=../daaho pnpm import:landing:production   # live; create-only, never overwrites edits
```

## Translations

Items in other languages can carry an English translation (**Translation** tab on the item). The
transcript stays the authoritative text; the public page shows the translation beside it, with
its status:

- **AI-generated — not yet verified** (the default): labelled as such, with the model if given.
- **Verified by project staff**: the person who chose Verified, and the date, are recorded and shown.
  Whoever later edits a verified translation becomes its verifier; if a script replaces the text,
  it goes back to unverified.
- **Translated by project staff**: credited to the name in *Translated by*.

Keep the `[page N]` markers so readers can match pages. Search covers translations, so an English
search also finds documents written in other languages.

## Inviting people

Admins invite people from **Admin → Users → Invite someone**: name, email and role (Contributor,
Editor or Admin). The site creates the account and emails a link, valid for **three days** and
usable once, to choose a password at `/admin/reset/…`. Nobody, including the admin, ever knows or
sets their password. If a link expires or goes astray, open the person under Users and choose **Send
a new invitation**; the old link stops working.

The panel also shows the link, with a **Copy link** button, so it can be sent by hand if email is not
set up or a message does not arrive. With email set up, **Forgot password?** on the sign-in screen
works too (its link lasts one hour).

Email is configured by environment variables (see `.env.example` and `src/lib/email.ts`): Resend
while on Vercel (`RESEND_API_KEY`), the library server's mail relay later (`SMTP_*`). Either way it
needs `EMAIL_FROM` on a verified domain, and `SITE_URL`, the only addresses links in emails may point
to.

## What the public sees

An item is published as soon as it has scans and some metadata, but much of an item is drafted by AI
from the scans: its title and date, description, transcript, and the people, places and subjects it
names. **None of that is shown to the public until a member of staff has checked it.** Each item has
four boxes under **Checked by staff** in the editor's sidebar: *Title and date*, *Description*,
*Transcript*, and *People, places and subjects*. Staff always see everything, with a note on the item
page listing what the public cannot see yet.

What the public always sees: the scans of a published item, and the library's catalog record
(Archival tab: creator, type, extent, repository, collection, box and folder, shelf, rights). An
unchecked title shows as the item's ID and type, e.g. *BC-0698 · Archival item*; an unchecked date is
not shown. A translation is public once it is verified or made by staff.

This is enforced where the data is read (`src/lib/publicView.ts`, `hooks/items.ts`), so it holds for
the API too: a visitor who is not signed in cannot read unchecked fields, cannot search or filter by
them (`/api/items?where[transcript][like]=…` is refused), and the public search matches only checked
text. People named by the AI are public only once an item naming them has its people checked. Scans'
alternative text names the item by its checked title, or else only by its ID.

**Catalog records.** `pnpm import:catalog` (or `:production`) applies the library's checked records
in `data/catalog/aamu-phase2.csv`: their titles and dates replace the AI's (which are kept under AI
provenance) and mark *Title and date* checked. The exhibit labels in `data/catalog/exhibit-labels.json`
become credited descriptions. `DRY_RUN=1` lists the changes first. After changing these rules, run
`pnpm sync:visibility` (or `:production`) to bring every record in line.

## Publishing rules

Enforced by the CMS, not by convention (see `src/hooks/items.ts`, tested in
`tests/int/publishing.int.spec.ts`):

1. An item cannot be published until its description is marked **Reviewed**. The reviewer and date
   are recorded automatically and shown on the public page.
2. An item cannot be published without a **rights statement** — its own, or the default set once in
   **Site settings** (every scan is Miami University's, so one statement can cover the collection).
3. **Scans are private until their item is published**, including by direct URL, and become private
   again if it is unpublished. Unreviewed scans can hold private information — a 1961 memorandum
   about a student's hospitalization — whatever their copyright.
4. **Full-resolution originals are withheld from the public** until **Site settings → Public can open
   full-resolution scans** is turned on; the public gets reading-size images. Enforced on the file
   itself, not only by hiding the link, since file URLs are predictable.

## Tests

```bash
pnpm test:unit   # name handling and dates — no database needed
pnpm test:int    # publishing rules, people merges, annotation review, translations, invitations and site content, against DATABASE_URL (creates and removes its own test records)
```

## Deploying

Production runs on the library server at daaho.lib.miamioh.edu — see [deploy/README.md](deploy/README.md).

The earlier Vercel setup — kept as a staging copy until the switch — is in **[DEPLOY.md](DEPLOY.md)**,
with Neon for Postgres and a private AWS S3 bucket for the scans. Schema changes ship as migrations in `src/migrations`; create one with
`pnpm payload migrate:create <name>` after changing a collection.

See [PLAN.md](PLAN.md) for the architecture and phases.
