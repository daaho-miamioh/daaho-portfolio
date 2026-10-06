# Deploying to Vercel

```
Browser ──> Vercel (Next.js + Payload CMS) ──> Neon (Postgres)
                     │
                     └──> AWS S3 (private bucket: scans)
```

| Service | Plan | Why |
|---|---|---|
| Vercel | **Pro** ($20/month) | Hobby's terms exclude projects built by a paid employee; Vercel can suspend them |
| Neon | Free | The data is text; 0.5 GB is ample |
| AWS S3 (us-east-2) | Pay as you go: under $0.10/month | About 1.4 GB of scans and derivatives at $0.023/GB; the first 100 GB a month of downloads is free on every AWS account |

The bucket must be **private**. The scans' rights are not yet cleared, and the site keeps a scan
private until its item is published. Payload checks that before every file request and then
redirects to a five-minute signed URL. Keep **Block all public access** on, and do not add a bucket
policy that grants public reads.

## 1. Create the S3 bucket

1. **S3 → Create bucket.** Region **us-east-2 (Ohio)**. The name must be unique across AWS, for
   example `daaho-media-miamioh`. Leave **Block all public access** checked.
2. **IAM → Users → Create user** for the site alone, and attach this inline policy (with your bucket
   name). It can reach this bucket and nothing else in the account:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::daaho-media-miamioh" },
       { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::daaho-media-miamioh/*" }
     ]
   }
   ```

3. Create an **access key** for that user and keep the Access Key ID and Secret Access Key.
4. Optional but sensible: **AWS Budgets** (the first two budgets are free) with an alert at $5.

*Cloudflare R2 also works, unchanged: set `S3_ENDPOINT` to `https://<account-id>.r2.cloudflarestorage.com`
and `S3_REGION` to `auto`.*

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
   | `S3_BUCKET` | your bucket name |
   | `S3_REGION` | `us-east-2` |
   | `S3_ACCESS_KEY_ID` | from step 1 |
   | `S3_SECRET_ACCESS_KEY` | from step 1 |

   Preview deployments run migrations too. Either give them their own database (the Neon
   integration can create a branch per preview) or leave these variables off Preview.
5. **Deploy.** The first build creates the database tables.

## 3. Load the collection (once, from your computer)

1. Put the **Production** environment's values in `.env.production.local` in the repository — never in
   `.env`, which is for local development; a production database there would make `pnpm dev` and
   the tests run against the live site. The file is gitignored. The reliable way:

   ```bash
   npx vercel env pull .env.production.local --environment=production
   ```

   Copying from the dashboard works too, but take the variables marked **Production**: the Neon
   integration gives Preview and Development their own database branches, and a development
   connection string looks just like the production one. Variables marked Sensitive in Vercel are
   not pulled; add those by hand.
2. Run:

   ```bash
   pnpm load:production
   ```

   It reads `.env.production.local` itself (do not `source` the file: connection strings contain
   `&`, which a shell misreads). It prints the database it is about to write to, and **refuses to
   continue if that database has no migrations applied** — the sign that it is not the one the
   deployment uses. It uploads the 316 scans with their derivatives, imports the 128 items, the
   people and terms, loads the drafted historical events, and fills item regions — about fifteen
   minutes. It runs in production mode, so it never alters the database schema.

## 4. First account

Open `https://<project>.vercel.app/admin`. **The first account created becomes the admin.** Create
the others from the admin panel; give the PI an editor or contributor account.

## What to expect

- **Two settings wait on the PI** (admin → **Site settings**): the default rights statement, and
  whether the public may open full-resolution scans. Until the first is filled, no item can be
  published; until the second is on, the public sees reading-size images only.

- **The public site starts empty.** An item is public only once it is reviewed and has a rights
  statement; historical events only once reviewed and sourced. Signed-in staff see everything,
  marked as drafts.
- **Add new scans with the importer, not the admin upload form.** Vercel limits a request body to
  4.5 MB and archival scans are larger.
- Neon's free tier sleeps when idle, so the first request after a quiet spell is a little slower.
- A Libraries subdomain can replace the `vercel.app` address later; Libraries IT sets the DNS record.
