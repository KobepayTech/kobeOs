# Reliable KobeOS deployment access

KobeOS uses Neon PostgreSQL for business data and Cloudflare for the frontend and API runtime. The production API `/api/health` must report `status: ok` and `db: connected`. Changing the database provider cannot fix a Cloudflare permission failure.

The failing frontend deployment returned Cloudflare error 10000 when reading the `kobeos-app` Pages project. This means the configured token/account pair was not authorized for that request; it does not by itself distinguish a missing permission from an expired token or the wrong account. A separate expired local Wrangler OAuth login is not a fix for GitHub Actions credentials.

## One-time production credential setup

1. In Cloudflare, select the account that actually contains the `kobeos-app` Pages project. Copy its account ID, not the zone ID.
2. Create a dedicated deployment token with **Account > Cloudflare Pages > Edit**, scoped to that account. Select a lifecycle appropriate for unattended CI. If an expiry is required, record its renewal date; do not rely on a temporary desktop login or fixed-IP restrictions that exclude GitHub-hosted runners.
3. In `KobepayTech/kobeOs`, open **Settings > Environments > production**. Store the token as `CLOUDFLARE_PAGES_API_TOKEN` and confirm `CLOUDFLARE_ACCOUNT_ID` matches the Pages account. Never paste tokens into chat or commit them.
4. Keep the existing Workers/API token separate. The frontend workflow prefers the dedicated Pages token, with the old names retained as a migration fallback.
5. Run **Deploy KobeOS Account and Desktop** on the reviewed branch with **preflight_only** enabled. It verifies the target project is readable and discovers its configured production branch, without building or deploying. The deployment uses that branch rather than assuming it matches the repository branch. Read access alone does not prove deployment write access.
6. Run the workflow normally to verify write permission and publish. It writes a revision marker, then checks the exact published commit and the production API/database health. A stale frontend can no longer count as success.

Cloudflare token creation and scope selection require the account owner's authorization. This setup removes the dependency on local OAuth renewal; it cannot prevent deliberate revocation, account changes, or a configured token expiry.

## Diagnostic outcomes

| Result | Action |
|---|---|
| Missing/invalid account ID | Set the Pages account's 32-character ID in the production environment |
| HTTP 401/403 or error 10000 | Check token validity, Pages Edit permission, and account scope |
| Project unavailable | Verify the project exists in that account; do not create a duplicate project as a workaround |
| Preflight succeeds but deployment fails | Confirm Pages Edit rather than read-only permission; inspect the deployment error |
| Release marker differs | The current release is not yet serving; deployment remains unverified |
| API/database check fails | Diagnose the serving API and its existing Neon connection separately |

Reference: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
