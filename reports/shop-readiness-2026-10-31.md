# KobeOS shop readiness test — 31 October 2026

**Result: not ready for real customer orders.** The core product, cart, order and stock paths work, but launch-blocking failures remain.

## Test shop

- Shop: **KobeOS Test Shop 1823c9**
- Working test URL: https://kobeos-app.pages.dev/shop/kobeos-test-shop-1823c9
- Advertised subdomain: https://kobeos-test-shop-1823c9.kobeapptz.com — returned Cloudflare HTTP 502
- Sample catalogue: TEST Cap, TZS 1,000; TEST T-Shirt, TZS 2,500. Five units each initially.
- Test order: **SHOP-MVX9TJ9I**. Sample buyer and a non-routable test phone were used. No money was transferred.

## Confirmed results

| Check | Result |
|---|---|
| Create a test merchant and published store through KobeOS APIs | Pass |
| Public catalogue returns both products | Pass |
| Open the storefront after linking the commerce merchant directory | Pass |
| Add both products to the browser cart | Pass |
| Submit a sample cash-on-delivery order | Order created |
| Stock updates | Pass: each product changed from 5 to 4 |
| Zero quantity | Rejected with HTTP 400 |
| Order 99 units with only 4 available | Rejected with HTTP 400; stock unchanged |
| Track order with the test buyer phone | HTTP 200 |
| Track order with a different phone | HTTP 404 |

## Launch blockers

1. **Checkout total differs from recorded total.** Cart and checkout showed TZS 8,500: TZS 3,500 in products plus TZS 5,000 shipping. The order and receipt recorded only TZS 3,500. The shipping fee was omitted from the order.
2. **Cash on Delivery records money as received immediately.** The selected UI option was Cash on Delivery. The resulting POS order is `COMPLETED` with `paymentMethod: CASH`, and the receipt reports cash under “Money in today.” No money was collected in this test.
3. **Published subdomain is unreachable.** Publishing reported the generated subdomain as ready, but opening it returned Cloudflare 502. The Pages `/shop/<slug>` address works after merchant-directory registration.
4. **Store Editor publication alone does not resolve on the website.** Before a separate commerce-business registration, `/api/store/<slug>` returned the published store and both products while `/api/commerce-public/resolve/<slug>` returned 404. Consequently `/shop/<slug>` showed “Site not found.” Linking the test business allowed the live test to continue. A frontend fallback fix is prepared locally with seven regression cases; it is not deployed.

## Additional findings

- The generic test store displays jersey-specific navigation, sample testimonials, a review-count claim and shipping claims unrelated to the shop. Merchants should not receive these as factual default content.
- The live Facebook sign-in callback currently reports “Meta sign-in is not configured.” The test used a dedicated test merchant account through the supported API, rather than the merchant's personal social account.
- The public Jumla marketplace had no live products before this test. The standalone test shop was not given a continuously online node for general marketplace listing.

## Code checks

- Four commerce-rule tests passed.
- Store Editor test passed.
- Seven new published-store resolution regression cases passed.
- Frontend build, type checks and focused lint passed for the locally prepared resolution fix.
- Previously completed GitHub validation included the commerce order/attribution integration test against an isolated test database; this does not replace the live findings above.

The sample store, products and test order remain available for follow-up testing. Test credentials were not included in this report or committed to source control.

## Storefront redesign follow-up

Prepared locally on `fix/published-shop-resolution`:

- Generic stores use a responsive cream-and-green storefront with merchant branding, real product categories, product cards, wishlist, search, membership and order tracking.
- Removed unrelated jersey navigation, fabricated review counts and testimonials from the generic storefront.
- Removed the hard-coded TZS 5,000 shipping charge from cart and checkout. Both now show the item total and state that delivery is arranged with the store. This does not fix the separate cash-on-delivery accounting issue above.
- Thirteen focused storefront and published-store regression tests pass. Type checking and the production build pass.
- Browser checks at 390px and desktop widths confirmed no mobile horizontal overflow and usable cart and checkout. A single TEST Cap displays TZS 1,000 consistently.
- These changes are in a local preview and are not deployed yet.

## Real TikTok test follow-up

- The user signed in to TikTok and the developer portal.
- TikTok authorization returned `unauthorized_client`, with `error_type=client_key`.
- The existing `kobelivesales` developer app is a production draft with no configured products or scopes. No sandbox exists. No app settings or keys were changed during inspection.
- A real public-comment listener was started for the user-selected @apple.user7636223 through the existing supported handle-based mode, with sample product code A1.
- The listener reported waiting, with no received comment timestamp. A phone broadcast and a real viewer comment are still required; no synthetic comment was injected and no successful end-to-end TikTok sale is claimed.
