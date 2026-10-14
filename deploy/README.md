# Running the site on the library server

The site runs on **ulblwebp20.lib.miamioh.edu** as `daaho.lib.miamioh.edu`, in place of the earlier
landing site. It uses the server's existing setup, which Puppet manages:

| | |
|---|---|
| Service | `next_daaho` (systemd), runs `npm run start` as user `next_daaho` with Node 24 via `/usr/local/bin/nvm-wrapper-next_daaho` |
| App | `/opt/next_js/daaho/current` → a folder in `/opt/next_js/daaho/builds/` |
| Settings | `/opt/next_js/daaho/shared/.env` (owner `next_daaho`, mode 600), linked into each build |
| Port | 3031, behind nginx |
| Logs | `/var/log/next_daaho/` |
| Database | Neon (Postgres); scans and images in AWS S3. Nothing large is stored on the server. |

The site is **not built on the server**: a build needs 2–3 GB of memory that the server, shared
with other sites, does not have to spare. GitHub Actions builds it on every push to `main`
(`.github/workflows/release.yml`), applies database migrations, and publishes a release. The server
downloads and installs a release with `deploy-portfolio.sh`. A running site uses about 220 MB.

## Every update

1. Push to `main`, and wait for the **Release** workflow to finish (GitHub → Actions).
2. On the server:

   ```bash
   sudo /opt/next_js/daaho/deploy-portfolio.sh
   ```

   It downloads the latest release, checks it, tries it on port 3039, and only then switches the
   site over and restarts. If the site does not answer after the restart, it goes back to the
   previous build by itself. To undo a deploy that worked but is wrong:

   ```bash
   sudo /opt/next_js/daaho/deploy-portfolio.sh --rollback
   ```

Migrations run when the release is built, before it is installed, so they must keep working with the
code already running — add columns and tables, do not rename or drop them in the same release.

## First time

**1. Give GitHub Actions the database address** (from the project folder on your computer; the
value goes straight to GitHub and is never shown):

```bash
grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '"' | gh secret set DATABASE_URL --repo daaho-miamioh/daaho-portfolio
```

**2. Put the settings on the server** — only the six the site needs:

```bash
grep -E '^(DATABASE_URL|PAYLOAD_SECRET|S3_BUCKET|S3_REGION|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY)=' .env.production.local | ssh qum@ulblwebp20.lib.miamioh.edu 'sudo install -o next_daaho -g next_daaho -m 600 /dev/stdin /opt/next_js/daaho/shared/.env'
```

**3. Install the deploy script on the server:**

```bash
sudo curl -fsSL -o /opt/next_js/daaho/deploy-portfolio.sh https://github.com/daaho-miamioh/daaho-portfolio/releases/latest/download/deploy-portfolio.sh && sudo chmod 755 /opt/next_js/daaho/deploy-portfolio.sh
```

**4. Deploy** as in *Every update*. The earlier landing site stays in `builds/`; `--rollback`
right after the first deploy brings it back.

## nginx

The nginx configuration for `daaho.lib.miamioh.edu` is managed by Puppet (Library IT). Two
settings must change before the staff side works:

- it accepts only GET requests (`if ($request_method !~ ^GET$) { return 444; }`), so signing in,
  saving, uploading and reviewing all fail — it must allow GET, HEAD, POST, PUT, PATCH, DELETE
  and OPTIONS;
- uploads are limited to nginx's default of 1 MB; scans need `client_max_body_size 25m;`.

The public pages work without these changes.
