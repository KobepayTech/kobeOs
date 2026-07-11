#!/usr/bin/env node
/**
 * KobeOS TikTok Live → Live-Sale bridge  (STANDALONE — runs OUTSIDE KobeOS)
 * ---------------------------------------------------------------------------
 * Reads a public TikTok live's chat via TikTok-Live-Connector and forwards
 * each comment to a KobeOS Live-Sale session's public ingest endpoint. KobeOS
 * does the rest (parse buy-code → convert to order → decrement stock → PalmPesa).
 *
 * This is intentionally a separate script, not part of the KobeOS product:
 *   • TikTok-Live-Connector is an UNOFFICIAL, reverse-engineered client. It can
 *     break when TikTok changes their site, and using it is against TikTok's
 *     Terms of Service. You run it at your own discretion and risk.
 *   • It only READS a *public* live's chat — it does NOT log into your account
 *     with a password (unlike the Instagram/instagrapi approach, which risks a
 *     ban and is NOT recommended).
 *
 * ── Setup ──────────────────────────────────────────────────────────────────
 *   cd tools/tiktok-live-bridge
 *   npm install
 *   # 1) In KobeOS: open "Live Sales" → Go Live → pin products → copy the
 *   #    "Bridge URL" shown at the bottom of the comment feed.
 *   # 2) Run:
 *   TIKTOK_USER=@theseller \
 *   KOBEOS_INGEST_URL="https://<yourshop>.kobeapptz.com/api/live-sales/ingest/<token>" \
 *   node bridge.mjs
 *
 * Env vars:
 *   TIKTOK_USER        the live host's @username (with or without the @)
 *   KOBEOS_INGEST_URL  the full bridge URL copied from the Live Sales console
 *   MIN_INTERVAL_MS    (optional) throttle per-user to avoid dupes (default 0)
 */

import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const USER = (process.env.TIKTOK_USER || process.argv[2] || '').replace(/^@/, '').trim();
const INGEST = (process.env.KOBEOS_INGEST_URL || process.argv[3] || '').trim();
const MIN_INTERVAL_MS = Number(process.env.MIN_INTERVAL_MS || 0);

if (!USER || !INGEST) {
  console.error('Usage: TIKTOK_USER=@seller KOBEOS_INGEST_URL="https://shop.kobeapptz.com/api/live-sales/ingest/<token>" node bridge.mjs');
  process.exit(1);
}
if (!/\/api\/live-sales\/ingest\/[a-f0-9]{8,}$/.test(INGEST)) {
  console.error('KOBEOS_INGEST_URL does not look like a Live-Sale bridge URL. Copy it from the console.');
  process.exit(1);
}

const lastSeen = new Map(); // per-user throttle

async function forward({ handle, text }) {
  if (!text) return;
  if (MIN_INTERVAL_MS > 0) {
    const now = Date.now();
    const prev = lastSeen.get(handle) || 0;
    if (now - prev < MIN_INTERVAL_MS) return;
    lastSeen.set(handle, now);
  }
  try {
    const res = await fetch(INGEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, buyerHandle: handle ? `@${handle}` : '@tiktok', source: 'tiktok-bridge' }),
    });
    if (!res.ok) {
      console.warn(`  ↳ ingest ${res.status}: ${(await res.text()).slice(0, 120)}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`  ↳ forwarded${data.matchedCode ? ` (matched ${data.matchedCode}×${data.qty})` : ''}`);
    }
  } catch (e) {
    console.warn('  ↳ ingest failed:', e.message);
  }
}

const conn = new TikTokLiveConnection(USER);

conn.on(WebcastEvent.CHAT, (data) => {
  const handle = data.user?.uniqueId || data.uniqueId || '';
  const text = data.comment || '';
  console.log(`[${handle}]: ${text}`);
  forward({ handle, text });
});

conn.on(WebcastEvent.STREAM_END, () => {
  console.log('📴 Live ended. Exiting.');
  process.exit(0);
});

conn.on('error', (e) => console.warn('connector error:', e?.message || e));

console.log(`🚀 Connecting to @${USER}'s live…`);
conn.connect()
  .then((state) => console.log(`📡 Connected (roomId ${state.roomId}). Forwarding comments to KobeOS. Ctrl+C to stop.`))
  .catch((e) => {
    console.error('Could not connect — is the user live right now?', e?.message || e);
    process.exit(1);
  });

process.on('SIGINT', () => { console.log('\n👋 Stopping bridge.'); conn.disconnect(); process.exit(0); });
