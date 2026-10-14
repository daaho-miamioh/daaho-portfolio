#!/usr/bin/env bash
# Deploy daaho-portfolio on the library server (ulblwebp20), from a release built by GitHub Actions.
#
#   sudo /opt/next_js/daaho/deploy-portfolio.sh              latest release
#   sudo /opt/next_js/daaho/deploy-portfolio.sh build-...    a particular release
#   sudo /opt/next_js/daaho/deploy-portfolio.sh --rollback   back to the build that ran before the last deploy
#
# The release is unpacked into builds/, tried on a spare port, and only then made current; if the
# site does not come back after the restart, the previous build is restored. Settings (database, S3,
# secret) come from shared/.env, which is linked into each build and never shipped in a release.
set -euo pipefail

REPO=daaho-miamioh/daaho-portfolio
BASE=/opt/next_js/daaho
BUILDS=$BASE/builds
SHARED=$BASE/shared
SERVICE=next_daaho
APP_USER=next_daaho
WRAPPER=/usr/local/bin/nvm-wrapper-next_daaho
PORT=3031
TRY_PORT=3039
KEEP=5
REQUIRED_KEYS=(DATABASE_URL PAYLOAD_SECRET S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY)

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
as_app() { sudo -u "$APP_USER" -H "$@"; }

# 200 from the home page and the API (both read the database) within $2 seconds.
healthy() {
  local port=$1 secs=$2
  for _ in $(seq 1 "$secs"); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$port/" && curl -fsS -o /dev/null "http://127.0.0.1:$port/api/project-events?limit=1"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

switch_to() {
  as_app ln -sfn "$1" "$BASE/current.new"
  as_app mv -Tf "$BASE/current.new" "$BASE/current"
}

restart_and_check() {
  systemctl restart "$SERVICE"
  healthy "$PORT" 90
}

[ "$(id -u)" -eq 0 ] || die "Run with sudo."
[ -x "$WRAPPER" ] || die "$WRAPPER not found."

# --- settings -------------------------------------------------------------------------------
[ -f "$SHARED/.env" ] || die "$SHARED/.env is missing. See deploy/README.md, 'First time'."
[ "$(stat -c '%U %a' "$SHARED/.env")" = "$APP_USER 600" ] || die "$SHARED/.env must be owned by $APP_USER with mode 600 (sudo chown $APP_USER: $SHARED/.env; sudo chmod 600 $SHARED/.env)."
for key in "${REQUIRED_KEYS[@]}"; do
  grep -qE "^${key}=.+" "$SHARED/.env" || die "$SHARED/.env has no value for $key."
done

previous=$(readlink -f "$BASE/current" || true)

# --- rollback -------------------------------------------------------------------------------
if [ "${1:-}" = "--rollback" ]; then
  target=$(cat "$BASE/previous-build" 2>/dev/null || true)
  [ -n "$target" ] && [ -d "$target" ] || die "No previous build recorded."
  say "Rolling back to $target"
  switch_to "$target"
  echo "$previous" | as_app tee "$BASE/previous-build" >/dev/null
  restart_and_check || die "The site did not come back after rollback. Check: journalctl -u $SERVICE; /var/log/next_daaho/"
  say "Rolled back. Serving $target"
  exit 0
fi

# --- download -------------------------------------------------------------------------------
if [ -n "${1:-}" ]; then
  tag=$1
else
  tag=$(curl -fsSI "https://github.com/$REPO/releases/latest" | tr -d '\r' | awk 'tolower($1)=="location:" {print $2}' | sed 's#.*/tag/##')
  [ -n "$tag" ] && [[ "$tag" != */* ]] || die "Could not find the latest release of $REPO. Has the Release workflow run?"
fi
say "Release $tag"

tmp=$(mktemp -d)
dest=""
live=0
# A build that never went live is removed again, so a failed attempt leaves nothing behind.
trap 'rm -rf "$tmp"; [ "$live" = 1 ] || [ -z "$dest" ] || rm -rf "$dest"' EXIT
chmod 755 "$tmp"
# RELEASE_BASE_URL is for the rehearsal in deploy/test-deploy.sh; normally the release comes from GitHub.
url="${RELEASE_BASE_URL:-https://github.com/$REPO/releases/download/$tag}"
curl -fsSL -o "$tmp/daaho-portfolio.tar.gz" "$url/daaho-portfolio.tar.gz" || die "Download failed: $url/daaho-portfolio.tar.gz"
curl -fsSL -o "$tmp/daaho-portfolio.tar.gz.sha256" "$url/daaho-portfolio.tar.gz.sha256" || die "Checksum download failed."
(cd "$tmp" && sha256sum -c --quiet daaho-portfolio.tar.gz.sha256) || die "Checksum does not match; not deploying."

dest="$BUILDS/$(date +%Y%m%d%H%M%S)-portfolio-$tag"
as_app mkdir -p "$dest"
as_app tar -xzf "$tmp/daaho-portfolio.tar.gz" -C "$dest"
as_app ln -s "$SHARED/.env" "$dest/.env"
grep -q '^platform=linux-x64$' "$dest/BUILD_INFO" || die "Release was not built for linux-x64: $(grep platform "$dest/BUILD_INFO")"
cat "$dest/BUILD_INFO"

# --- try it before it goes live --------------------------------------------------------------
say "Checking Node and the image library"
as_app bash -c "cd '$dest' && '$WRAPPER' node -e \"console.log('node', process.version); require('sharp'); console.log('sharp ok')\"" \
  || die "Node or sharp failed in $dest. Nothing was changed."

say "Trying the new build on port $TRY_PORT"
as_app timeout 120 bash -c "cd '$dest' && PORT=$TRY_PORT exec '$WRAPPER' npm run start" >"$tmp/try.log" 2>&1 &
ok=0; healthy "$TRY_PORT" 60 && ok=1
for pid in $(pgrep -u "$APP_USER" || true); do
  [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$dest" ] && kill "$pid" 2>/dev/null || true
done
wait 2>/dev/null || true
if [ "$ok" != 1 ]; then
  tail -n 30 "$tmp/try.log" >&2
  die "The new build did not answer on port $TRY_PORT. The live site was not touched."
fi
echo "OK"

# --- go live ----------------------------------------------------------------------------------
say "Switching current -> $dest and restarting $SERVICE"
echo "$previous" | as_app tee "$BASE/previous-build" >/dev/null
live=1
switch_to "$dest"
if ! restart_and_check; then
  echo "Not healthy after restart; restoring $previous" >&2
  switch_to "$previous"
  restart_and_check || die "Rollback also failed. Check: journalctl -u $SERVICE; /var/log/next_daaho/"
  die "Deploy failed and was rolled back. Logs: /var/log/next_daaho/"
fi

# --- tidy ---------------------------------------------------------------------------------------
# Keep the last $KEEP portfolio builds, and never the current or previous one. Other builds (the
# earlier landing site) are left alone.
mapfile -t old < <(ls -1dt "$BUILDS"/*-portfolio-* 2>/dev/null | tail -n +$((KEEP + 1)))
for d in "${old[@]}"; do
  [ "$d" = "$dest" ] || [ "$d" = "$previous" ] || rm -rf "$d"
done

say "Deployed $tag. Previous build: $previous  (undo with: sudo $0 --rollback)"
