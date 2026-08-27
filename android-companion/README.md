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
