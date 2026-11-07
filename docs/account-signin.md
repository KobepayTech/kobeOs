# KobeOS account signup and sign-in

The same Google, Facebook and TikTok actions create a KobeOS account on first use and sign into that account on later visits. Email and phone accounts use a password (minimum eight characters). Phone signup does not send or verify an SMS code. Use a country code, such as +255712345678.

Social buttons remain usable when `/api/health` fails; authentication endpoints determine the outcome. A provider failure returns to a recovery screen with retry and email/phone alternatives. The API must still be reachable to create a session.

## Production configuration

Configure these values on the **API server**, never in client-side source:

| Method | Required server configuration | Registered callback |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | `https://api.kobeapptz.com/api/auth/oauth/google/callback` |
| Facebook | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (or saved Meta provider configuration) | `https://api.kobeapptz.com/api/auth/oauth/meta/callback` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | `https://api.kobeapptz.com/api/auth/oauth/tiktok/callback` |
| Email | Reachable API and migrated account database | None |
| Phone + password | Reachable API and migrated account database | None |

`APP_FRONTEND_URL` must point to the actual KobeOS web shell, which must serve `/oauth/google`, `/oauth/meta` and `/oauth/tiktok` through its SPA fallback. It must not point to an unrelated website, a merchant storefront, or an API-only host. Configure provider apps for production access and allowlist the exact callback URLs above in their developer dashboards.

Google uses a server-side authorization-code flow. The installer/web build no longer needs `VITE_GOOGLE_CLIENT_ID`. The existing Google credential POST endpoint remains compatible with other clients.

The normal deployment workflow forwards the Google secret and callback separately from the public client ID. Cloudflare Container deployment forwards all three Google fields; put values into the existing private runtime secret configuration. No provider secrets belong in Git or Vite variables.

## Callback checks

Each OAuth start stores a ten-minute, HttpOnly, SameSite=Lax cookie on the API host for that provider. The callback must have that browser cookie and a matching signed, unexpired state. Production cookies require HTTPS. Reopening an old callback or opening one in another browser requires starting a new sign-in.

Google tokens are checked for the configured audience, issuer, expiry and verified email. Facebook and TikTok profiles without email receive a stable internal provider identity. Password signup cannot claim these internal addresses. Provider login does not automatically link an unrelated email/phone account or authorize posting to social media.

## Validation limits

Automated tests cover email and phone registration/login, Google verification and callback state, Facebook/TikTok callback isolation, interrupted login recovery, and health-check failures. Successful live social sign-in additionally requires the production server, configured provider credentials, dashboard callback registration and approval, and a real user completing consent.
