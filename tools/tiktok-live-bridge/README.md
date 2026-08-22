# KobeOS TikTok Live Bridge (standalone)

Forwards a **public** TikTok live's chat comments into a KobeOS **Live Sale**
session, so buyer comments become orders (stock decrements + PalmPesa payment
request) automatically.

This is a **separate tool you run yourself** — it is *not* built into KobeOS.
That separation is deliberate (see the risk note below).

## How it fits

```
 TikTok Live chat ──(this bridge)──▶  https://<shop>.kobeapptz.com/api/live-sales/ingest/<token>
                                              │
                                              ▼
                                   KobeOS Live-Sale engine
                       parse buy-code → order → stock −qty → PalmPesa request
```

## Setup

```bash
cd tools/tiktok-live-bridge
npm install
```

1. In KobeOS open **Live Sales → Go Live**, pin your products with buy-codes
   (e.g. `A1`, `A2`), and copy the **Bridge URL** shown under the comment feed.
2. Run the bridge with the live host's `@username` and that URL:

```bash
TIKTOK_USER=@theseller \
KOBEOS_INGEST_URL="https://yourshop.kobeapptz.com/api/live-sales/ingest/<token>" \
node bridge.mjs
```

Optional: `MIN_INTERVAL_MS=1500` throttles repeat comments per user.

Now when a viewer comments `A1` (or `A1 x2`), it appears in your KobeOS
console already matched — tap **Sell** (or it can be auto-handled). Stock and
revenue update live.

## ⚠️ Important risk note

- `tiktok-live-connector` is an **unofficial, reverse-engineered** client. Using
  it may violate TikTok's Terms of Service, and it can break whenever TikTok
  changes their site. Use at your own discretion.
- It only **reads a public live's chat**. It does **not** log into your account
  with a password. (Avoid password-login scrapers like instagrapi for
  Instagram — those risk getting your account banned.)
- For a fully-supported path, use the assisted console in KobeOS (type/paste
  comments — zero risk) or wait for the official Meta Graph webhook integration.

## No live host handy?

You don't need this bridge to use Live Sales. The KobeOS **Live Sales** console
works on its own: type or paste comments in the feed and tap **Sell**. The
bridge just automates the comment capture for TikTok.
