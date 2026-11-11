# Instagram and TikTok live sales

## Phone broadcasts

1. Keep the KobeOS backend and published storefront online.
2. Open Live Sales. Connect Instagram and TikTok with the buttons at the top, then refresh connections.
3. Instagram needs a Professional account, the approved comment/message permissions, and a subscribed webhook. The backend needs `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `IG_WEBHOOK_VERIFY_TOKEN`, and the existing social-token encryption configuration. Register the webhook URL shown by the connection in the Meta app dashboard.
4. TikTok uses the connected account handle with the existing `tiktok-live-connector` public-chat provider. This is a third-party connection, not an official TikTok LIVE comment API. If the provider requires signing credentials, configure `TIKTOK_LIVE_SIGN_API_KEY` on the backend. OAuth posting permission does not prove the chat connection works.
5. Start the actual broadcast on the platform, open a selling session for that account in KobeOS, and pin a stocked product with code `A1`.
6. From a separate viewer account, comment `A1 x2`. Verify the comment reaches the console, reserves the intended item, and produces a valid checkout link. Test the payment callback and paid-order handoff separately before accepting real payments.

Hosted Instagram connections relay comments to the published storefront backend. TikTok chat runs on the store backend, including when OAuth happened on the hosted account server. Connection status and last-received comments are shown in the selling console.

## Regular posts and comment checkout

1. Publish the storefront. In Live Sales choose **Post campaign**, paste the full link to the merchant’s own Instagram post/Reel or TikTok video/photo, and pin the product. For a single-product post, buyers can ask “Bei gani?” or say “Nataka mbili” without a buy code. With several pinned products, buyers can include the product code.
2. Instagram needs its existing professional-account connection and the `comments` webhook. Price and checkout questions on regular posts get a public reply. A purchase comment that produces a reservation gets a private reply. Live comments use the private-reply channel.
3. For TikTok regular posts, use **TikTok post replies → Set up** with the Business Accounts access token and its account open ID. Use a token authorized for comment read and reply. Verify using an owned post, then create or reopen the campaign. KobeOS polls eligible posts every two minutes and responds publicly. Rotate the token through **Update access**. The regular TikTok publishing connection is separate.
4. Public replies contain a shop link scoped to the exact campaign and product. The viewer opens the link and starts their own checkout. The buyer chooses a payment method and enters pickup or delivery details at checkout. Staff can see the method and location in Mobile Prepare.
5. Use a separate viewer account to verify each real platform path before enabling it for customers. On TikTok LIVE, moderators can copy the public reply from the comment feed. The optional live connector can attempt a public reply when configured with the platform session it requires. Verify the reply appears for a viewer before relying on it.

## Mobile-money settlement for social checkout

- Configure an approved PalmPesa API v2 token in `PALMPESA_API_TOKEN` and set `APP_PUBLIC_URL` to the public HTTPS API origin for this deployment. The merchant account email is used for payment requests unless `PALMPESA_CHECKOUT_EMAIL` is set. Apply the database migration before running the updated API.
- A social mobile-money order holds stock and shows **Awaiting payment**. PalmPesa callbacks wake up a server-to-server status check. The reconciliation job also checks pending orders and safely retries requests with the original transaction ID. The status response must match the payment reference, order, amount and currency before KobeOS can release the order for preparation.
- Rejected, failed and expired requests release stock. A verified payment that arrives after expiration is flagged **Late payment · Review** so staff can check the stock and arrange fulfilment or a refund. Only verified on-time payments post a sale and release it to fulfilment automatically.
- Pilot with an authorised small TZS payment from a test phone. Check that the order stays out of the preparation queue before approval, then confirm the order, journal and pick ticket appear once after approval. Check the credit separately in the PalmPesa merchant account.

## Animated presenter

Open a live session, pin stocked products, and select **Open avatar presenter**. Prepare and review a script, then start the voice. A configured Kobe AI model supplies a brief introduction; unavailable models fall back to a standard introduction. Product names, prices, stock, and buy codes come directly from the catalogue. The current presenter speaks English with the computer's installed browser voice and uses a simple animated virtual host.

Use **Broadcast view** and capture it and the browser's audio in OBS or the platform's live software. The platform account must have the relevant live/encoder access. The presenter view does not connect an encoder, start a platform broadcast, render a photorealistic avatar, or automatically answer live questions. A phone can remain the live camera while KobeOS handles sales; a presenter broadcast uses the encoder instead.

Prepared scripts are invalidated if tracked products change, the session ends, or the backend becomes unavailable. Checks occur before speech and every four seconds while the presenter is open. Closing the presenter cancels browser speech. Stop voice before changing output devices or leaving an encoder running unattended.

## Release validation

- Backend build and focused live-sales tests.
- Frontend type check, build, presenter lifecycle tests, and hosted TikTok/checkout regression tests.
- Deploy the matching frontend and backend; this feature adds no database columns.
- Complete real Instagram and TikTok comment, reservation, checkout, payment, and encoder/audio tests using the actual merchant accounts. Passing mocked tests alone does not establish platform readiness.
