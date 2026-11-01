# Camera broadcasts from the store

Store Editor **Go live** and Live Sales **Go live from store** open the same camera studio. Preview is local and private. **Go live to shoppers** creates a separate store-camera sales session, pins the chosen products at catalogue prices, and starts a Cloudflare Stream WHIP connection. The UI shows LIVE only after the peer connection connects.

Shoppers use **Watch live video** on the storefront to connect over WHEP. Viewing starts on demand. Video can appear without pinned products; the normal store catalogue remains available. Stopping or closing the studio aborts negotiation, deletes the WebRTC session resource, stops local microphone/camera tracks, and ends the sales session. Browser/network crashes can require manually ending the sales session in Live Sales, even though the disconnected camera stops delivering video.

## Guided merchant setup

The studio guides merchants through **Publish shop**, **Enable store video**, product selection, private preview, and **Go live to shoppers**. It shows a working share link and optional TikTok/Instagram connections in the same place. Cloud-hosted shops use the central `/shop/<slug>` address and `/@<slug>` live catalogue rather than assuming a local tunnel is available.

An administrator configures `CLOUDFLARE_STREAM_API_TOKEN` in the GitHub production environment with only Stream Write permission for the hosting account. Deployment forwards this as `CF_STREAM_API_TOKEN`, together with `CF_STREAM_ACCOUNT_ID`, to the API container. The merchant's Enable action provisions a dedicated live input with recording off and saves its broadcast credential encrypted. Repeated setup requests reuse the same merchant input, including across API instances. An unpublished shop cannot provision an input.

## Administrator fallback

1. Apply migration `1793510000000-StoreCameraBroadcast` before running the API.
2. Create a dedicated Cloudflare Stream live input for the merchant. Turn off HLS/DASH playback and recording for this WebRTC-only flow.
3. Copy its **WebRTC Broadcast** URL and **WebRTC Playback** URL into the studio's **Advanced video setup** form. Both must belong to the same Cloudflare customer domain. Merchants normally use the one-click Enable action instead.
4. The authenticated settings endpoint encrypts the broadcast capability at rest. It is excluded from normal entity reads and never included in public live responses. Only the owning merchant's start-broadcast request returns it. Never commit these URLs or put the broadcast capability in public store settings.
5. Keep the studio open while broadcasting. Camera and microphone permission are requested only when the merchant clicks Preview. The live broadcast starts only on the separate Go live action.

Cloudflare bills delivered viewer-minutes. This flow does not record or restream to TikTok/Instagram: Cloudflare's WHIP inputs currently cannot simulcast through RTMP/SRT. Social platforms require their own LIVE eligibility and a supported encoder/relay. A TikTok developer sandbox tests OAuth and does not grant LIVE eligibility.

References: [Cloudflare browser broadcasting](https://developers.cloudflare.com/stream/examples/browser-based-webrtc/), [WebRTC limitations and pricing](https://developers.cloudflare.com/stream/webrtc/).

Automated protocol and UI tests use controlled media/network doubles. A real camera-to-Cloudflare-to-viewer check is still required after deployment and merchant setup; they are not evidence of a successful real broadcast.

An additional live transport check published a labelled canvas sample through the created Cloudflare input and decoded a video frame in a WHEP viewer. This verifies a real provider connection, but is not a completed camera/studio/shopper test or a TikTok broadcast. The sample was configured to stop automatically after 45 seconds, with recording disabled.
