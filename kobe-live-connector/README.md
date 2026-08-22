# kobe-live-connector

Bridges live-stream chat into KobeOS **live-sales**, so a viewer commenting
`BUY 23` is captured, matched to a pinned product, reserved, and handed a
checkout link — all by the KobeOS backend you already have.

```
TikTok LIVE ─┐
Social Stream Ninja (optional) ─┤→ kobe-live-connector → POST /live-sales/ingest/{token} → KobeOS
Instagram Live (official webhook, separate) ─────────────────────────────────┘
```

## Sources & licensing (read this)
- **TikTok** — `tiktok-live-connector` (**MIT**). Unofficial/reverse-engineered;
  it can break when TikTok changes, and needs the account to be **live**. The
  handshake is signed by **Euler Stream** (the default signer) — set
  `tiktok.eulerApiKey` with your Euler Stream key for reliable, higher-rate
  production use (a free shared signer is used if you leave it blank). Euler
  Stream also carries gifts / likes / follows / joins.
- **Social Stream Ninja** — **AGPL-3.0**. Nothing from SSN is bundled here. If
  you already run SSN, point `ssn.wsUrl` at its WebSocket and this worker reads
  it. Keep SSN as a separate process.
- **Instagram** — NOT handled by this worker. IG Live comments use the
  **official Graph API `live_comments` webhook**, which calls the KobeOS backend
  directly (public HTTPS + **Meta App Review** + a Business/Creator account).

## Run
```bash
cd kobe-live-connector
npm install                       # installs tiktok-live-connector (MIT) + ws
cp config.example.json config.json
#  edit config.json:
#   - backendUrl:  your KobeOS backend
#   - ingestToken: from the live session (KobeOS gives each session an ingest token)
#   - tiktok.username: the handle that is going live
#   - ssn.wsUrl: only if you run Social Stream Ninja
npm start
```

Every comment becomes:
`POST {backendUrl}/live-sales/ingest/{ingestToken}` with
`{ source, buyerHandle, text }`. KobeOS parses the BUY code, reserves the
product for 5 minutes, and creates the checkout token.

## Not included (platform-gated, your setup)
- **Streaming one device to TikTok + Instagram at once** — needs OBS + a
  restream relay; **Instagram Live has no official third-party RTMP** for most
  accounts.
- **DM-ing the checkout link** — IG allows one private reply to a live commenter
  (with approval); TikTok has no DM API (post the link in live chat instead).
