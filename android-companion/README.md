# Kobe Live Ads — Android Companion

The creator's phone app that draws sponsored ads over their live game stream.

Because TikTok gives no LIVE/ad API and iOS forbids drawing over other apps, this
Android app uses `SYSTEM_ALERT_WINDOW` to draw a **clearly "Sponsored"** overlay
on top of whatever the creator is playing. TikTok's screen-share then captures
that overlay, so every viewer sees the ad. The app talks only to the Kobe Live
Ads endpoints that already ship in the backend.

## How a creator uses it
1. In the Kobe web app → Creator → **Live Ads**, create their Kobe Live link and
   copy the **overlay token** (the OBS overlay URL ends in the token).
2. Open this app, paste the **server base URL** (e.g. `https://api.kobeapptz.com`)
   and the **overlay token**, grant the "draw over other apps" permission.
3. Tap **Go Live** when they start streaming. The app:
   - heartbeats the Kobe session alive (`POST /api/live/overlay/<token>/heartbeat`),
   - polls the current slot (`GET  /api/live/overlay/<token>/state`),
   - draws the Sponsored overlay (card / banner / fullscreen / video) over the
     game during the playback window, then a persistent QR + "tap bio" card
     through the CTA window,
   - reports proof-of-play (`POST /api/live/overlay/<token>/impression`).
4. Tap **Stop** when the stream ends (`POST /api/live/overlay/<token>/end`).

Auto-delivery rotation is server-side: while the session is live, Kobe rotates
approved sponsors on the creator's cadence, so the app just renders whatever the
`state` endpoint returns — no per-ad action.

## The one rule
The overlay is always badged **⚡ Sponsored**. It is a notification *format*,
never a spoof of a real app (TikTok/WhatsApp/bank). That is deliberate and
enforced in the layouts.

## Build (needs the Android SDK — not buildable in the web sandbox)
```
cd android-companion
# set sdk.dir in local.properties, or ANDROID_HOME
./gradlew :app:assembleRelease      # or open in Android Studio
```
Requires Android SDK 34, minSdk 26 (TYPE_APPLICATION_OVERLAY). No secrets are
compiled in — the server URL + overlay token are entered at runtime.

## Pairing (easy path)
Instead of pasting the long overlay token: in the web app tap **Pair Android app**
to get a 6-digit code, enter it in the app's **Pair with code** field. The app
redeems it at `POST /api/live/pair` and fills in the token + `kobe.live` base
automatically. Codes are single-use and expire in 10 minutes.

## Notes / limits
- **Test overlay:** the app has a "Test overlay (preview)" button that shows a
  sample sponsored card for ~8s so a creator can confirm it renders before going
  live.
- **Restart resilience:** the service is `START_STICKY` and keeps polling through
  transient network drops; if Android kills it, it restarts and re-reads the
  saved token.
- **FLAG_SECURE apps:** a few apps mark their windows `FLAG_SECURE`, which hides
  overlays from screen capture. Games almost never do this; banking/DRM apps do.
  Nothing we can (or should) bypass — the overlay simply won't show over such
  apps, which is correct behaviour.
