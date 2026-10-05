# Deploying to Vercel

```
Browser ──> Vercel (Next.js + Payload CMS) ──> Neon (Postgres)
                     │
                     └──> Cloudflare R2 (private bucket: scans)
```

| Service | Plan | Why |
|---|---|---|
| Vercel | **Pro** ($20/month) | Hobby's terms exclude projects built by a paid employee; Vercel can suspend them |
| Neon | Free | The data is text; 0.5 GB is ample |
| Cloudflare R2 | Free tier (10 GB) | The scans and their derivatives are about 1.4 GB; R2 does not charge for downloads |

The bucket must be **private**. The scans' rights are not yet cleared, and the site keeps a scan
private until its item is published. Payload checks that before every file request and then
redirects to a five-minute signed URL. Do not turn on public access, an `r2.dev` URL or a custom
domain for the bucket.

## 1. Create the R2 bucket

1. In Cloudflare, open **R2** and **Create bucket**. Name it `daaho-media` and leave it private.
2. **Manage API tokens → Create API token.** Permission **Object Read & Write**, applied to this bucket
   only. Keep the **Access Key ID**, the **Secret Access Key**, and the S3 endpoint
   `https://<account-id>.r2.cloudflarestorage.com`.

## 2. Create the Vercel project

1. In a Vercel **Pro** team: **Add New → Project → Import** `daaho-miamioh/daaho-portfolio`.
   If the repository is not listed: it belongs to the `daaho-miamioh` GitHub account, so the Vercel
   GitHub App must be installed there. Choose **Adjust GitHub App Permissions**, sign in to GitHub
   as `daaho-miamioh`, and grant access to `daaho-portfolio`.
2. Leave the build settings as detected. Vercel runs the `vercel-build` script, which applies
   database migrations and then builds.
3. **Storage → Neon → Create** and connect it to the project. This sets `DATABASE_URL`.
4. **Settings → Environment Variables**, for **Production**:

   | Name | Value |
   |---|---|
   | `PAYLOAD_SECRET` | output of `openssl rand -hex 32` |
   | `S3_BUCKET` | `daaho-media` |
   | `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_ACCESS_KEY_ID` | from step 1 |
   | `S3_SECRET_ACCESS_KEY` | from step 1 |

   Preview deployments run migrations too. Either give them their own database (the Neon
   integration can create a branch per preview) or leave these variables off Preview.
5. **Deploy.** The first build creates the database tables.

## 3. Load the collection (once, from your computer)

1. Create `.env.production.local` in the repository (it is gitignored) with the production
   `DATABASE_URL` (Vercel → Storage → Neon → `.env.local` tab) and the five `S3_` values.
2. Run:

   ```bash
   set -a && . ./.env.production.local && set +a && pnpm load:production
   ```

   It prints the database it is about to write to. **Check that it names Neon, not `localhost`**,
   before letting it continue. It uploads the 316 scans with their derivatives, imports the 128
   items, the people and terms, loads the drafted historical events, and fills item regions —
   about fifteen minutes. It runs in production mode, so it never alters the database schema; the
   deploy's migrations do that.

## 4. First account

Open `https://<project>.vercel.app/admin`. **The first account created becomes the admin.** Create
the others from the admin panel; give the PI an editor or contributor account.

## What to expect

- **The public site starts empty.** An item is public only once it is reviewed and has a rights
  statement; historical events only once reviewed and sourced. Signed-in staff see everything,
  marked as drafts.
- **Add new scans with the importer, not the admin upload form.** Vercel limits a request body to
  4.5 MB and archival scans are larger.
- Neon's free tier sleeps when idle, so the first request after a quiet spell is a little slower.
- A Libraries subdomain can replace the `vercel.app` address later; Libraries IT sets the DNS record.
