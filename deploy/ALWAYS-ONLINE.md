# Keeping `api.kobeapptz.com` always online

`api.kobeapptz.com` (and every `*.kobeapptz.com` store) is served by the
Docker stack in `server/docker-compose.prod.yml`: **API + Postgres + Redis +
web + nginx + a Cloudflare Tunnel connector**. `app.kobeapptz.com` is separate
(Cloudflare Pages, static) — that's why it can be up while `api` is down.

A **Cloudflare `1033` / `530`** on `api` means the tunnel has **no connected
origin** — the stack (or just the `cloudflared` connector) isn't running on your
server. Nothing about it is a code bug; it's an uptime/ops problem. This doc is
how you make it stop happening.

## The three things that keep it up

1. **Containers restart themselves** — every service is `restart: unless-stopped`
   (already set). A crashed API or tunnel comes back on its own.
2. **A second tunnel connector (HA)** — `cloudflared` + `cloudflared-ha` both
   register with the same token, so one dying no longer black-holes traffic.
3. **A watchdog that self-heals + alerts** — `deploy/uptime-watchdog.sh` checks
   `https://api.kobeapptz.com/api/health` every 60s and, if it isn't `200`,
   brings the stack back up and bounces the connectors (and can POST an alert).

## First bring-up (on the production server, from the repo root)

```sh
# 1. Secrets (never commit): server/.env must contain at least
#    JWT_SECRET, DB_PASSWORD, and CLOUDFLARED_TOKEN (from deploy/cf-setup.sh).
cp server/.env.example server/.env && nano server/.env

# 2. Start everything (API runs migrations on boot; DB schema is now complete).
docker compose -f server/docker-compose.prod.yml up -d --build

# 3. Point the tunnel at nginx and self-test until subdomains stop 530'ing.
export CF_API_TOKEN=***          # scopes: Tunnel:Edit, DNS:Edit, Zone:Read
./deploy/go-live.sh
```

`go-live.sh` finishes green only when `https://api.kobeapptz.com/api/health`
returns `200`.

## Make it survive reboots and 2am tunnel drops

```sh
# A) Docker itself must start on boot, or `restart: unless-stopped` never runs.
sudo systemctl enable docker

# B) Install the watchdog (checks every 60s, self-heals, optional alerts).
sudo cp deploy/kobeos-watchdog.service deploy/kobeos-watchdog.timer /etc/systemd/system/
sudo sed -i "s#/opt/kobeos#$(pwd)#" /etc/systemd/system/kobeos-watchdog.service
#   optional: alerting + non-default domain
echo 'WATCHDOG_ALERT_WEBHOOK=https://hooks.slack.com/services/XXX' | sudo tee /etc/kobeos-watchdog.env
sudo systemctl daemon-reload
sudo systemctl enable --now kobeos-watchdog.timer

# Verify it's scheduled and see the last run:
systemctl list-timers kobeos-watchdog.timer
journalctl -u kobeos-watchdog.service -n 20 --no-pager
```

## If it's down right now — 60-second recovery

```sh
cd <repo> && docker compose -f server/docker-compose.prod.yml up -d
docker compose -f server/docker-compose.prod.yml logs --tail=40 cloudflared cloudflared-ha
```

Look for `Registered tunnel connection` (good) vs `failed to dial` / `Unauthorized`
(bad token) / QUIC timeouts (we already force `--protocol http2`; if you still
see UDP/7844 errors your host firewall is blocking it).

## What this does *not* fix

The watchdog keeps the **server-hosted** origin up. If the whole server/host is
gone, the tunnel can't serve. For true "shop never dark even if the box dies,"
that's the separate **cloud-tier mirror** (a capped set of products/specs/images
served from the cloud independent of any one origin) — tracked separately.
