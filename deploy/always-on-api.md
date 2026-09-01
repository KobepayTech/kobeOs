# Move api.kobeapptz.com to the always-on VPS

This runbook moves only the API origin. The public URL remains:

`https://api.kobeapptz.com/api`

Lala, KobeOS and other clients therefore do not need a URL change.

## 1. Prepare the VPS

Use an always-on Linux host with Docker Engine + Docker Compose. Open inbound:

- TCP 22 for SSH administration/deploys
- TCP 80 for HTTP / ACME
- TCP 443 for HTTPS

Clone this repository on the VPS and create:

`server/.env.primary-api`

from `server/.env.primary-api.example`.

The database values must point to the same production PostgreSQL source of truth used by the current API. Do not initialize a separate production database.

## 2. Configure GitHub

Create environment `production-primary-api`.

Secrets:

- `PRIMARY_API_DEPLOY_HOST`
- `PRIMARY_API_DEPLOY_USER`
- `PRIMARY_API_DEPLOY_SSH_KEY`

Variables:

- `PRIMARY_API_HOST=api.kobeapptz.com`
- optional `PRIMARY_API_DEPLOY_PATH`
- `PRIMARY_API_ENABLED=false` before DNS cutover
- `PRIMARY_API_PUBLIC_VERIFY=false` before DNS cutover

Run **Deploy Always-On Primary API** manually once. A manual run is allowed even while automatic deployment is disabled.

The workflow deploys the exact CI-validated commit, starts Redis + API + Caddy, and requires:

`http://127.0.0.1:3000/api/health`

to pass on the VPS before it completes.

## 3. Pre-cutover checks

On the VPS:

```bash
cd ~/kobeos-primary-api
docker compose --env-file server/.env.primary-api -f server/docker-compose.primary-api.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

Confirm PostgreSQL connectivity and migrations are healthy before touching DNS.

## 4. DNS cutover

Change the existing `api.kobeapptz.com` DNS record from the old tunnel/origin to the public IPv4/IPv6 address of the always-on VPS.

Recommended cutover:

1. Lower the DNS TTL before the change when possible.
2. Point `api.kobeapptz.com` to the VPS.
3. Keep ports 80/443 reachable so Caddy can serve/renew TLS.
4. Cloudflare proxying may remain enabled if desired; the important change is that the Cloudflare edge now reaches the always-on VPS instead of a Windows/cloudflared origin.

No frontend rebuild is required because the API hostname is unchanged.

## 5. Verify from outside

```bash
curl -fsS https://api.kobeapptz.com/api/health
curl -fsSI https://api.kobeapptz.com/api/health | grep -i x-kobe-production-path
```

Expected origin marker:

`X-Kobe-Production-Path: primary-vps`

Then test one authenticated KobeOS read and one low-risk write against production.

## 6. Enable automatic deploys

After DNS is confirmed on the VPS, set:

- `PRIMARY_API_ENABLED=true`
- `PRIMARY_API_PUBLIC_VERIFY=true`

Successful CI on `master`/ `main` will then deploy the validated commit automatically and verify the public API health endpoint.

## Rollback

If the VPS fails during cutover, restore the previous DNS target. Because both origins use the same PostgreSQL source of truth, the rollback does not require data migration.

Keep the independent backup-origin stack in `server/docker-compose.backup.yml` as a separate provider/path; it should not share the same VPS as the primary API.
