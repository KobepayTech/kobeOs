# Instagram and TikTok live sales

## Phone broadcasts

1. Keep the KobeOS backend and published storefront online.
2. Open Live Sales. Connect Instagram and TikTok with the buttons at the top, then refresh connections.
3. Instagram needs a Professional account, the approved comment/message permissions, and a subscribed webhook. The backend needs `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `IG_WEBHOOK_VERIFY_TOKEN`, and the existing social-token encryption configuration. Register the webhook URL shown by the connection in the Meta app dashboard.
4. TikTok uses the connected account handle with the existing `tiktok-live-connector` public-chat provider. This is a third-party connection, not an official TikTok LIVE comment API. If the provider requires signing credentials, configure `TIKTOK_LIVE_SIGN_API_KEY` on the backend. OAuth posting permission does not prove the chat connection works.
5. Start the actual broadcast on the platform, open a selling session for that account in KobeOS, and pin a stocked product with code `A1`.
6. From a separate viewer account, comment `A1 x2`. Verify the comment reaches the console, reserves the intended item, and produces a valid checkout link. Test the payment callback and paid-order handoff separately before accepting real payments.

Hosted Instagram connections relay comments to the published storefront backend. TikTok chat runs on the store backend, including when OAuth happened on the hosted account server. Connection status and last-received comments are shown in the selling console.

## Animated presenter

Open a live session, pin stocked products, and select **Open avatar presenter**. Prepare and review a script, then start the voice. A configured Kobe AI model supplies a brief introduction; unavailable models fall back to a standard introduction. Product names, prices, stock, and buy codes come directly from the catalogue. The current presenter speaks English with the computer's installed browser voice and uses a simple animated virtual host.

Use **Broadcast view** and capture it and the browser's audio in OBS or the platform's live software. The platform account must have the relevant live/encoder access. The presenter view does not connect an encoder, start a platform broadcast, render a photorealistic avatar, or automatically answer live questions. A phone can remain the live camera while KobeOS handles sales; a presenter broadcast uses the encoder instead.

Prepared scripts are invalidated if tracked products change, the session ends, or the backend becomes unavailable. Checks occur before speech and every four seconds while the presenter is open. Closing the presenter cancels browser speech. Stop voice before changing output devices or leaving an encoder running unattended.

## Release validation

- Backend build and focused live-sales tests.
- Frontend type check, build, presenter lifecycle tests, and hosted TikTok/checkout regression tests.
- Deploy the matching frontend and backend; this feature adds no database columns.
- Complete real Instagram and TikTok comment, reservation, checkout, payment, and encoder/audio tests using the actual merchant accounts. Passing mocked tests alone does not establish platform readiness.
