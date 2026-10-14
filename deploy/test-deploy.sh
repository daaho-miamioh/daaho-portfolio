#!/usr/bin/env bash
# Rehearse deploy-portfolio.sh on a GitHub runner set up like ulblwebp20: the same systemd unit,
# user, Node wrapper and folders, with a stand-in for the earlier landing site. Run by the Release
# workflow before a release is published. Needs sudo and systemd; not for use on a real server.
#
#   deploy/test-deploy.sh dist
set -euo pipefail
cd "$(dirname "$0")/.."
DIST=$(realpath "${1:-dist}")
BASE=/opt/next_js/daaho
DEPLOY=$BASE/deploy-portfolio.sh
NODE_DIR=$(dirname "$(command -v node)")

step() { printf '\n### %s\n' "$*"; }
fail() { printf '\nREHEARSAL FAILED: %s\n' "$*" >&2; sudo tail -n 40 /var/log/next_daaho/*.log >&2 || true; exit 1; }
page() { curl -fsS "http://127.0.0.1:3031$1"; }

step "Imitate the server"
sudo useradd --system --create-home --shell /bin/bash next_daaho
printf '#!/bin/bash\nexport PATH=%s:$PATH\nexec "$@"\n' "$NODE_DIR" | sudo tee /usr/local/bin/nvm-wrapper-next_daaho >/dev/null
sudo chmod 755 /usr/local/bin/nvm-wrapper-next_daaho
sudo mkdir -p "$BASE/builds/20261013231501" "$BASE/shared" /var/log/next_daaho
sudo tee "$BASE/builds/20261013231501/package.json" >/dev/null <<'JSON'
{ "scripts": { "start": "node -e \"require('http').createServer((q, s) => s.end('old landing site')).listen(3031, '127.0.0.1')\"" } }
JSON
sudo ln -s "$BASE/builds/20261013231501" "$BASE/current"
sudo chown -R next_daaho: "$BASE" /var/log/next_daaho
sudo tee /etc/systemd/system/next_daaho.service >/dev/null <<'UNIT'
[Unit]
Description=DAAHO
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/nvm-wrapper-next_daaho npm run start
WorkingDirectory=/opt/next_js/daaho/current
User=next_daaho
Group=next_daaho
StandardOutput=append:/var/log/next_daaho/next_daaho.log
StandardError=append:/var/log/next_daaho/next_daaho.error.log
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl start next_daaho
for _ in $(seq 1 20); do page / 2>/dev/null | grep -q 'old landing site' && break; sleep 1; done
page / | grep -q 'old landing site' || fail "stand-in site did not start"

write_env() {
  { echo "DATABASE_URL=$1"; echo "PAYLOAD_SECRET=rehearsal-secret"; echo "S3_BUCKET=rehearsal"; echo "S3_REGION=us-east-2"
    echo "S3_ACCESS_KEY_ID=rehearsal"; echo "S3_SECRET_ACCESS_KEY=rehearsal"; } |
    sudo install -o next_daaho -g next_daaho -m 600 /dev/stdin "$BASE/shared/.env"
}
write_env "$DATABASE_URL"
sudo install -m 755 deploy/deploy-portfolio.sh "$DEPLOY"
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$DIST" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
sleep 1
release() { sudo RELEASE_BASE_URL=http://127.0.0.1:8765 "$DEPLOY" "$@"; }

step "Deploy"
release rehearsal || fail "deploy failed"
page / | grep -q 'old landing site' && fail "still serving the old site"
page /events >/dev/null || fail "/events does not answer"
page /admin/login >/dev/null || fail "/admin/login does not answer"
[ "$(stat -c %U "$(readlink -f $BASE/current)")" = next_daaho ] || fail "build not owned by next_daaho"

step "Roll back"
sudo "$DEPLOY" --rollback || fail "rollback failed"
page / | grep -q 'old landing site' || fail "rollback did not restore the old site"

step "A release that cannot start must not touch the live site"
write_env "postgres://nobody:nothing@127.0.0.1:1/none"
release rehearsal && fail "a broken deploy reported success"
page / | grep -q 'old landing site' || fail "the live site changed after a failed deploy"
[ "$(ls -1d $BASE/builds/*-portfolio-* 2>/dev/null | wc -l)" = 1 ] || fail "the failed attempt left a build behind"

printf '\nRehearsal passed.\n'
