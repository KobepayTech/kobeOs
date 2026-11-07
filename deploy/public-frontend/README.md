# Always-on Lala, Jumla and public storefronts

The `kobeos-public-frontend` Worker serves the built SPA from Cloudflare static
assets on `kobeapptz.com/*` and `*.kobeapptz.com/*`. A request for HTML, JS, CSS
or a SPA deep link does not contact a tunnel, local server or API. The browser
keeps the original hostname, so the existing Lala/Jumla/tenant routing works.

Cloudflare Pages does **not** support wildcard custom domains. The earlier
instruction to attach `*.kobeapptz.com` to Pages was not deployable. A proxied
DNS record is still needed; the existing wildcard tunnel record supplies it,
but this Worker serves the frontend before tunnel origin resolution occurs.
Existing more-specific API Worker routes retain their precedence. Do not
remove the API route, change its credentials, or stop the local server to test
the frontend.

`Deploy Always-On Public Frontend` tests the down-origin behavior, builds,
validates and deploys the Worker plus assets, then verifies the exact revision
and hosting marker on each public domain. It uses the existing production
Workers token and account ID. Required token permissions are Workers Scripts
Edit and Workers Routes Edit on the account/zone. A missing or insufficient
credential fails deployment explicitly; a skipped deployment is not success.

The `API` service binding calls the existing `kobeos-primary-api` cloud Worker
for same-origin API requests. It sends each write once. If the cloud API is
unavailable, it returns 503 rather than an HTML page or fake success. Backend
health is reported separately from frontend availability.

Shop `/api/media/*` requests remain on the shop's DNS-configured origin with
`Cache-Control: no-store`; images are not copied into cloud assets. Lala hotel
media uses the existing cloud API. External image URLs are unchanged. Shop
images may fail while their origin is offline, without taking down the page.
No business data, availability or transaction confirmations are fabricated.

Tests: `node --test deploy/public-frontend/frontend.node-test.mjs`.

References:
- https://developers.cloudflare.com/pages/platform/known-issues/
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-single-page-application/
