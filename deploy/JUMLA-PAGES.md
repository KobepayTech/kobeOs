# Jumla frontend deployment

Jumla is deployed independently from the KobeOS production VPS.

## Architecture

- Frontend: Cloudflare Pages project `kobeos-jumla`
- Public domain: `https://jumla.kobeapptz.com`
- API: `https://api.kobeapptz.com/api`
- Database/backend: existing KobeOS production API stack

The frontend deploy no longer needs SSH.

## GitHub production secrets

The workflow needs these environment secrets:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages Write permission.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID containing the kobeapptz.com zone.

On first successful run, the workflow creates the Pages project if necessary,
deploys `dist/`, and attaches `jumla.kobeapptz.com`.

## Important wildcard limitation

Cloudflare Pages does not support wildcard custom domains such as
`*.kobeapptz.com`. Only Jumla's explicit subdomain is moved to Pages here.
Tenant/dealership wildcard sites can remain on the existing wildcard
Cloudflare Tunnel/Nginx route until they are migrated using a different
architecture.

## Release behavior

A successful CI run on master triggers the Pages workflow automatically.
A manual deployment is also available from GitHub Actions.
