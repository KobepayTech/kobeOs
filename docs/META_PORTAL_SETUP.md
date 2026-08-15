# KobeOS Meta / Instagram Live Sales Setup

This document contains the complete setup required to connect an Instagram Professional account to KobeOS Live Sales using Meta's official APIs.

## What this integration does

```text
Instagram Professional Account
          |
          | OAuth authorization
          v
KobeOS backend
          |
          | Meta webhook: comments / live_comments
          v
KobeOS Live Sales session
          |
          v
Buy-code parser -> stock reservation -> checkout -> order -> reply
```

Instagram Live is handled through Meta's official API. Apify is not used for Instagram Live. Apify may remain available for ordinary post or ad comment campaigns.

## Required accounts and access

You need:

1. A Meta developer account: https://developers.facebook.com/
2. A Meta Business Portfolio, preferably verified for production.
3. An Instagram Professional account.
4. The Instagram account must be Business or Creator, not Personal.
5. Access to the KobeOS production server environment.
6. A public HTTPS API hostname that Meta can reach.
7. A public HTTPS frontend hostname for the OAuth completion redirect.
8. Permission to restart the KobeOS backend after environment changes.

For development mode, the Instagram account owner must be added as an app role or Instagram tester and must accept the invitation. Production accounts normally require the relevant permission review and an app in Live mode.

## Exact KobeOS URLs

Use these values exactly for the hosted KobeOS deployment:

### OAuth redirect URI

```text
https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback
```

### Webhook callback URL

```text
https://api.kobeapptz.com/api/live-sales/public/webhooks/instagram
```

### Frontend completion URL

```text
https://kobeapptz.com/
```

The OAuth redirect URI must match Meta character-for-character. Do not add a slash, query string, or alternate hostname.

## Step 1: Create the Meta app

1. Open https://developers.facebook.com/apps/.
2. Click **My Apps**.
3. Click **Create App**.
4. If Meta asks for a use case, choose **Other** or the business/integration option.
5. If Meta asks for an app type, choose **Business**.
6. Set the app name to:

```text
KobeOS Meta Connector
```

7. Enter the developer contact email.
8. Select the correct Meta Business Portfolio.
9. Click **Create App**.

Meta may show slightly different labels. The important result is a normal Meta app dashboard where the Instagram product and Webhooks can be added.

## Step 2: Add Instagram API with Instagram Login

1. In the app dashboard, click **Add Product**.
2. Find **Instagram**.
3. Choose **Instagram API with Instagram Login** or **Instagram Business Login**.
4. Click **Set Up**.
5. Open the Instagram API configuration page.
6. Add the exact OAuth redirect URI shown above.
7. Save the configuration.

Do not use Facebook Login for the current KobeOS Instagram connector. The existing KobeOS backend uses the Instagram Login OAuth flow.

## Step 3: Configure the basic app settings

Open **App Settings -> Basic** and complete the fields Meta requires:

- App name: `KobeOS Meta Connector`
- App domains: `kobeapptz.com`
- Privacy Policy URL: your public KobeOS privacy policy URL
- Terms of Service URL: your public KobeOS terms URL, if required
- App icon: a square KobeOS logo, if required
- Category: Business or Shopping, if required
- Contact email: the support/developer email

Use the **Show** button beside App Secret, copy the value, and put it only in the KobeOS backend environment. Never place it in React, Muse's native bundle, browser local storage, or a public Git repository.

## Step 4: Configure OAuth redirect URLs

In the Instagram API setup page, find the field named one of:

- Valid OAuth Redirect URIs
- OAuth Redirect URI
- Redirect URLs
- Instagram Login redirect URL

Add:

```text
https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback
```

Save it.

The following are different URLs and must not be confused:

```text
# OAuth callback
https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback

# Webhook callback
https://api.kobeapptz.com/api/live-sales/public/webhooks/instagram
```

## Step 5: Configure Instagram permissions

The current KobeOS environment requests:

```env
INSTAGRAM_OAUTH_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
```

The backend requests these scopes during OAuth. Use the permission names displayed by the current Meta dashboard. If Meta has renamed or replaced a permission, update the backend environment and implementation together; do not randomly add scopes in the native app.

The first scope is used for basic Professional account information. The comment-management scope is used to receive and work with comments. Private replies or messaging may require additional Meta permissions and review depending on the current Meta product configuration.

## Step 6: Add the Instagram account for development testing

Before the app is Live:

1. Open **App Roles**, **Roles**, or **App Testers**.
2. Find **Instagram Testers** if available.
3. Add the Instagram username.
4. Log in to that Instagram account.
5. Accept the tester invitation in Instagram settings/notifications.
6. Confirm the account is still Professional.

Development mode generally limits OAuth and webhook testing to app roles, testers, developers, and administrators. A random public Instagram account may fail until the app is approved and Live.

## Step 7: Configure Meta Webhooks

1. In the Meta app dashboard, open **Webhooks**.
2. Select **Instagram**.
3. Click **Add Callback URL**, **Configure**, or the equivalent button.
4. Enter:

```text
https://api.kobeapptz.com/api/live-sales/public/webhooks/instagram
```

5. Create a long random verify token. Example only:

```text
kobeos-meta-webhook-change-this-value
```

6. Put the exact same token in KobeOS as `IG_WEBHOOK_VERIFY_TOKEN`.
7. Click **Verify and Save**.
8. Subscribe to the supported Instagram fields for comments and Live comments, including:

```text
comments
live_comments
```

The callback must be reachable from the public internet over HTTPS. It must not be protected by a browser login, VPN, Cloudflare Access page, IP allowlist, or a self-signed certificate.

## Step 8: Configure the KobeOS backend

Set these values in the server environment, not the frontend `.env` file:

```env
INSTAGRAM_APP_ID=1754586998908005
INSTAGRAM_APP_SECRET=PASTE_META_APP_SECRET_HERE
INSTAGRAM_REDIRECT_URI=https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback
INSTAGRAM_API_VERSION=v24.0
INSTAGRAM_OAUTH_SCOPES=instagram_business_basic,instagram_business_manage_comments
IG_WEBHOOK_VERIFY_TOKEN=PASTE_THE_SAME_META_VERIFY_TOKEN_HERE
APP_PUBLIC_URL=https://api.kobeapptz.com
APP_FRONTEND_URL=https://kobeapptz.com/
```

The server must also have a valid existing `JWT_SECRET` of at least 32 characters. KobeOS uses it to sign and validate the OAuth state.

After saving the environment values:

1. Restart the backend.
2. Confirm the backend has no environment validation errors.
3. Confirm `https://api.kobeapptz.com/api/health` returns HTTP 200 before clicking Meta's **Verify and Save**.

## Step 9: Connect the account in KobeOS

1. Log into KobeOS.
2. Open **Live Sales**.
3. Click **Connect Instagram**.
4. Complete Meta authorization.
5. Return to KobeOS.
6. Confirm that the Instagram handle appears in the Live Sales header.

KobeOS calls these authenticated endpoints:

```text
GET    /api/live-sales/instagram/oauth/url
GET    /api/live-sales/instagram/connection
DELETE /api/live-sales/instagram/connection
POST   /api/live-sales/instagram/webhook/subscribe
```

The OAuth callback is public because Meta must reach it:

```text
GET /api/live-sales/instagram/oauth/callback
```

The access token is stored on the server-side social account record. It is not sent to the frontend.

## Step 10: Handle webhook pending status

OAuth and webhook registration are separate operations. It is possible for Instagram to connect while the webhook remains pending.

If KobeOS says **webhook pending**:

1. Copy the webhook URL displayed in KobeOS.
2. Confirm it is exactly:

```text
https://api.kobeapptz.com/api/live-sales/public/webhooks/instagram
```

3. Confirm the verify token is identical in Meta and KobeOS.
4. Confirm Webhooks is configured for Instagram, not Facebook.
5. Confirm the app is using HTTPS and is publicly reachable.
6. Click **Retry webhook** in KobeOS.

The retry endpoint is:

```text
POST /api/live-sales/instagram/webhook/subscribe
```

## Step 11: Test the complete flow

Prepare the catalog:

1. Add a product in POS.
2. Give it stock greater than zero.
3. Open Live Sales.
4. Connect Instagram.
5. Click **Start Live Sales**.
6. Select Instagram.
7. Pin the product with a short code such as `A1`.

Start the Instagram test:

1. Start an actual Instagram Live from the connected Professional account.
2. Comment from a permitted tester account:

```text
A1
```

or:

```text
A1 x2
```

Expected result:

1. Meta sends the comment webhook to KobeOS.
2. KobeOS finds the active Instagram Live Sales session.
3. KobeOS de-duplicates the Meta comment ID.
4. KobeOS matches the product code and quantity.
5. KobeOS reserves available stock.
6. The comment appears in the Live Sales console.
7. The buyer receives the reservation/checkout reply when the required Meta reply permissions are available.
8. The operator can convert the reservation into a POS order.

The Live Sales console refreshes comments automatically while the session is active.

## Step 12: Production readiness

Before connecting real merchants:

- Complete Meta Business verification if requested.
- Complete app review for any permission requiring Advanced Access.
- Configure a public privacy policy and terms page.
- Configure a support contact and deletion-request process.
- Move the Meta app to Live mode only after development testing passes.
- Use a strong random `IG_WEBHOOK_VERIFY_TOKEN`.
- Use a strong random `JWT_SECRET`.
- Do not commit `.env` or production secrets.
- Restrict database access and backups.
- Monitor webhook HTTP responses and backend logs without logging access tokens.
- Test reconnect and disconnect flows.
- Test expired/revoked permissions.
- Test duplicate webhook delivery.
- Test inventory reservation expiry.

## Troubleshooting

### Invalid OAuth redirect URI

Cause: Meta's redirect URI and KobeOS `INSTAGRAM_REDIRECT_URI` differ.

Fix: copy this exact value into both places:

```text
https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback
```

### Instagram account is not eligible

Cause: the account is Personal, is not a tester in Development mode, or the account invitation was not accepted.

Fix: convert to Professional, add it to App Roles/Instagram Testers, and accept the invitation.

### Webhook verification failed

Check all of these:

- URL is exactly `/api/live-sales/public/webhooks/instagram`.
- The server is reachable without login.
- HTTPS certificate is valid.
- Meta and `IG_WEBHOOK_VERIFY_TOKEN` match exactly.
- The backend is running the latest code.
- The reverse proxy forwards `/api/live-sales/public/webhooks/instagram` to NestJS.

### Instagram connects but comments do not arrive

Check:

- The webhook shows Connected in KobeOS.
- `comments` and `live_comments` are subscribed.
- The KobeOS Live Sales session is active and platform is Instagram.
- The connected account is the account currently broadcasting.
- The test commenter is allowed by the Meta app mode.
- The live comment contains a pinned buy-code if you expect an automatic reservation.

### Private reply does not send

Cause: private reply/messaging permission may require a separate Meta product, permission, account eligibility, or app review.

Fix: first confirm webhook comments appear in KobeOS. Then complete the current Meta messaging/private-reply requirements. Comment ingestion and private replies are separate capabilities.

### Webhook is pending after OAuth

Finish the Meta dashboard webhook configuration and click **Retry webhook** in KobeOS. Disconnecting and reconnecting is not normally required.

## Muse handoff

Give Muse the companion prompt in:

```text
docs/MUSE_META_ACCESS_PROMPT.md
```

Muse must reuse the existing KobeOS endpoints and must not create a second token exchange, a client-side App Secret, a fake connected state, or an Apify-based Instagram Live connector.
