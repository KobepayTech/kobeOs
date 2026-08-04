/**
 * kobe-live-connector — bridges live-stream chat into KobeOS live-sales.
 *
 * Sources (enable any combination in config.json):
 *   - TikTok LIVE  : via `tiktok-live-connector` (MIT). Unofficial/reverse-
 *                    engineered, so it can break when TikTok changes.
 *   - Social Stream Ninja (SSN): connect to its WebSocket API if you already
 *                    run SSN (AGPL-3.0) separately — nothing from SSN is bundled
 *                    here. SSN can aggregate TikTok + Instagram + more.
 *
 * Every captured comment is POSTed to the KobeOS ingest bridge:
 *     POST {backendUrl}/live-sales/ingest/{ingestToken}
 *     body: { source, buyerHandle, text }
 * KobeOS then parses BUY codes, reserves stock, and mints the checkout link.
 *
 * Instagram Live comments use the OFFICIAL Graph API `live_comments` webhook,
 * which points at the KobeOS backend directly (see server IG webhook) — not
 * this worker — because it needs a public HTTPS callback + Meta App Review.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const cfg = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const ingestUrl = `${cfg.backendUrl.replace(/\/$/, '')}/live-sales/ingest/${cfg.ingestToken}`;

let tiktokConn = null; // set once TikTok connects, for optional reply-back

/**
 * Post an auto-reply back where the platform allows:
 *  - a webhook you control (cfg.autoReplyWebhook), and/or
 *  - TikTok live chat IF you provide an authenticated sessionId (best-effort;
 *    TikTok has no supported comment API, so this can fail/break).
 * Instagram replies go through the official one-private-reply API on the
 * backend, not here. Otherwise the moderator reads the reply out.
 */
function onReply(source, reply) {
  if (cfg.autoReplyWebhook) {
    try {
      const u = new URL(cfg.autoReplyWebhook);
      const lib = u.protocol === 'https:' ? https : http;
      const body = JSON.stringify({ source, reply });
      const r = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
      r.on('error', () => {}); r.write(body); r.end();
    } catch { /* bad webhook url */ }
  }
  if (source === 'tiktok' && tiktokConn && cfg.tiktok?.sessionId) {
    Promise.resolve(tiktokConn.sendMessage?.(reply)).catch(() => {});
  }
}

// ── Forward a comment to KobeOS (stdlib http, no deps) ───────────────────────
function forward(source, buyerHandle, text) {
  if (!text || !text.trim()) return;
  const body = JSON.stringify({ source, buyerHandle: buyerHandle || '', text });
  const u = new URL(ingestUrl);
  const lib = u.protocol === 'https:' ? https : http;
  const req = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
    let buf = '';
    res.on('data', (d) => { buf += d; });
    res.on('end', () => {
      if (res.statusCode >= 300) { console.warn(`[ingest] ${res.statusCode} for "${text.slice(0, 40)}"`); return; }
      console.log(`[${source}] ${buyerHandle}: ${text.slice(0, 60)}`);
      // Auto-reply: KobeOS returns a ready-to-post reply when it reserves a BUY.
      try {
        const r = JSON.parse(buf);
        if (r && r.reply) {
          console.log(`   ↳ REPLY: ${r.reply}`);
          onReply(source, r.reply); // post it back where the platform allows
        }
      } catch { /* non-JSON */ }
    });
  });
  req.on('error', (e) => console.warn(`[ingest] send failed: ${e.message}`));
  req.write(body);
  req.end();
}

// ── TikTok LIVE source ───────────────────────────────────────────────────────
async function startTikTok() {
  if (!cfg.tiktok?.username) return;
  let WebcastPushConnection;
  try { ({ WebcastPushConnection } = await import('tiktok-live-connector')); }
  catch { console.error('[tiktok] `npm i tiktok-live-connector` first.'); return; }
  const conn = new WebcastPushConnection(cfg.tiktok.username, cfg.tiktok.sessionId ? { sessionId: cfg.tiktok.sessionId } : {});
  tiktokConn = conn;
  conn.on('chat', (d) => forward('tiktok', d.uniqueId || d.nickname || '', d.comment || ''));
  conn.on('disconnected', () => {
    console.warn('[tiktok] disconnected — retrying in 10s');
    setTimeout(() => conn.connect().catch(() => {}), 10_000);
  });
  try { await conn.connect(); console.log(`[tiktok] connected to @${cfg.tiktok.username}`); }
  catch (e) { console.error(`[tiktok] connect failed (is @${cfg.tiktok.username} live?): ${e.message}`); }
}

// ── Social Stream Ninja source (optional external aggregator) ────────────────
async function startSSN() {
  if (!cfg.ssn?.wsUrl) return;
  let WebSocket;
  try { ({ default: WebSocket } = await import('ws')); }
  catch { console.error('[ssn] `npm i ws` to use the Social Stream Ninja source.'); return; }
  const connect = () => {
    const ws = new WebSocket(cfg.ssn.wsUrl);
    ws.on('open', () => console.log('[ssn] connected'));
    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        // SSN message shape: { chatname, chatmessage, type (platform) }
        if (m.chatmessage) forward(String(m.type || 'ssn').toLowerCase(), m.chatname || '', m.chatmessage);
      } catch { /* non-JSON heartbeat */ }
    });
    ws.on('close', () => { console.warn('[ssn] closed — retry 10s'); setTimeout(connect, 10_000); });
    ws.on('error', (e) => console.warn(`[ssn] ${e.message}`));
  };
  connect();
}

console.log(`kobe-live-connector -> ${ingestUrl}`);
startTikTok();
startSSN();
