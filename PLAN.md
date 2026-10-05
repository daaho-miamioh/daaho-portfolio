# Plan

## Why this architecture

LivedMU paired Jekyll with Sanity: content lived with an outside service, templates lived in git,
and every edit had to cross from one to the other. This site keeps content and presentation in one
application whose schema is code in this repository and whose data sits in our own Postgres.

Payload provides the CMS — admin interface, accounts and roles, drafts and version history, media
handling — so project time goes into the collection rather than into rebuilding an editor.

## What the data dictated

Measured on the 128-record pipeline batch before any design decision:

- **Names are strings, not people.** 283 name strings; several are the same person written several
  ways ("Upham, Alfred H." appears four ways across 36 items). People are therefore first-class
  records, and merging is a human decision. Outcome: 4 provable merges, 31 clusters for review.
- **The batch contains corrupted name strings** — model reasoning leaked into a field, several names
  in one string. Ten such strings across nine items; the importer refuses to invent people from them.
- **Very common terms make poor links.** *correspondence* (90 items), *Ohio--Oxford* (83),
  *Miami University* (63) connect nearly everything to everything. When related-item suggestions are
  built, they must exclude terms present in more than about a quarter of items. Excluding them,
  115 of 128 items still have at least one meaningful related item (median 20).
- **Archival fields are empty.** `collection`, `series`, `box`, `folder` are blank on all 128 — the
  pipeline cannot know them. Browsing by collection waits on archivists.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | Collections, roles, publishing rules, importer, item list and item pages, entity pages | **Done** |
| 2. Linking | Merge review workflow, related items, search across transcripts, filters, A–Z indexes | **Done** |
| 3. Presentation | Visual design, home and about content, team | Next |
| 4. Narrative | Curated stories that string items together, as LivedMU's stories do | |
| Deploy | Storage adapter, Neon, Vercel Pro, migrations, Libraries subdomain | Before public launch |

## How linking works (Phase 2)

- **Related items** score shared people (weight 3), subjects (2), places (1) and genres (0.5), each
  scaled by how rare the shared term is. A term on more than a quarter of the visible items is
  ignored, so *correspondence* and *Ohio--Oxford* never make two items "related". Each suggestion
  shows the links it shares. Suggestions are only as good as the name links: a bare surname such
  as "Morris" can join two different people until an editor resolves it.
- **Merging people** happens at `/review/people` (editors and admins). A merge repoints every item,
  keeps one row per person with the strongest role, folds the other spellings into aliases, records
  the merged names in `mergedFrom` — which the importer honours, so a merge survives re-import —
  and deletes the merged records, all in one transaction. It refuses, before changing anything,
  when a published item has unpublished changes naming the record.

## Open items

- **Rights statements** are empty on every item, and an item cannot be published without one. This
  is the gate on going public, and it is an archival decision, not a technical one.
- **Accessibility:** the DOJ's 2024 ADA Title II rule requires WCAG 2.1 AA for public universities.
  Built to it from the start; confirm the compliance date with Miami's accessibility office and run
  an audit before launch.
- **Draft preview and caching:** pages currently render per request so signed-in staff see drafts.
  Before launch, move public pages to static generation with on-demand revalidation, which also
  avoids database cold starts on Neon's free tier.
