// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from "react";
import {
  ShieldCheck, Send, Wallet, BookOpen, Search, Copy, Check,
  AlertTriangle, CheckCircle2, XCircle, Lock, ArrowRight, Plus, RefreshCw,
  Share2, Download, ScanLine
} from "lucide-react";

/**
 * KobeOS · Tuma — paper-voucher-replacement money transfer for street
 * agents. Sender creates a voucher (QR + transaction code + collection
 * PIN), receiver takes the code + QR to an agent, agent verifies with
 * PIN, hands over cash, marks paid in the ledger.
 *
 * Storage: persists to localStorage by default; falls back to an
 * in-memory map when storage is unavailable (e.g. private mode).
 * Vouchers don't roam across devices yet — that's a backend wiring
 * for a follow-up commit.
 */

/* ------------------------------------------------------------------ */
/* Storage — localStorage with in-memory fallback                      */
/* ------------------------------------------------------------------ */
const _mem = {};
const hasLocal = (() => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const k = "__kobe_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
})();
const store = {
  async get(k) {
    if (typeof window !== "undefined" && window.storage) return window.storage.get(k);
    if (hasLocal) {
      const v = window.localStorage.getItem(k);
      if (v != null) return { key: k, value: v };
    }
    if (k in _mem) return { key: k, value: _mem[k] };
    throw new Error("not found");
  },
  async set(k, v) {
    if (typeof window !== "undefined" && window.storage) return window.storage.set(k, v);
    if (hasLocal) window.localStorage.setItem(k, v);
    _mem[k] = v;
    return { key: k, value: v };
  },
  async list(p) {
    if (typeof window !== "undefined" && window.storage) return window.storage.list(p);
    if (hasLocal) {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(p)) keys.push(key);
      }
      return { keys };
    }
    return { keys: Object.keys(_mem).filter((x) => x.startsWith(p)) };
  },
};
const KEY = (code) => `kobeos:transfer:${code}`;

const ALPHA = "ACDEFGHJKMNPQRSTUVWXYZ23456789";
const genCode = () => {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return "KOB-" + s;
};
const genPin = () => String(Math.floor(1000 + Math.random() * 9000));

const fmtAmt = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/* ------------------------------------------------------------------ */
/* QR encoder (byte mode, ECC level M, versions 1-4)                  */
/* ------------------------------------------------------------------ */
function qrMatrix(text) {
  const EXP = new Array(256), LOG = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  EXP[255] = EXP[0];
  const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]);
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  const n = bytes.length;
  const VERS = [
    { v: 1, size: 21, dataCW: 16, ec: 10, blocks: 1, align: null },
    { v: 2, size: 25, dataCW: 28, ec: 16, blocks: 1, align: 18 },
    { v: 3, size: 29, dataCW: 44, ec: 26, blocks: 1, align: 22 },
    { v: 4, size: 33, dataCW: 64, ec: 18, blocks: 2, align: 26 },
  ];
  const V = VERS.find((c) => n + 2 <= c.dataCW) || VERS[VERS.length - 1];
  const size = V.size, totalDataCW = V.dataCW, ecLen = V.ec, nb = V.blocks;
  const bits = [];
  const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  pushBits(0b0100, 4); pushBits(n, 8);
  for (const b of bytes) pushBits(b, 8);
  const cap = totalDataCW * 8;
  for (let i = 0; i < Math.min(4, cap - bits.length); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const PAD = [0xEC, 0x11]; let pi = 0;
  while (bits.length < cap) { pushBits(PAD[pi % 2], 8); pi++; }
  const dataCW = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; dataCW.push(b);
  }
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const g2 = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) { g2[j] ^= gen[j]; g2[j + 1] ^= gmul(gen[j], EXP[i]); }
    gen = g2;
  }
  const rsEncode = (msg) => {
    const res = msg.concat(new Array(ecLen).fill(0));
    for (let i = 0; i < msg.length; i++) {
      const coef = res[i];
      if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef);
    }
    return res.slice(msg.length);
  };
  const perBlock = totalDataCW / nb;
  const blocks = [], eccBlocks = [];
  for (let b = 0; b < nb; b++) {
    const blk = dataCW.slice(b * perBlock, (b + 1) * perBlock);
    blocks.push(blk); eccBlocks.push(rsEncode(blk));
  }
  const finalCW = [];
  for (let i = 0; i < perBlock; i++) for (let b = 0; b < nb; b++) finalCW.push(blocks[b][i]);
  for (let i = 0; i < ecLen; i++) for (let b = 0; b < nb; b++) finalCW.push(eccBlocks[b][i]);
  const mat = Array.from({ length: size }, () => new Array(size).fill(0));
  const res = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (r, c, val) => { if (r < 0 || r >= size || c < 0 || c >= size) return; mat[r][c] = val ? 1 : 0; res[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inb =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      setF(r0 + r, c0 + c, inb);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    if (!res[6][i]) setF(6, i, i % 2 === 0);
    if (!res[i][6]) setF(i, 6, i % 2 === 0);
  }
  setF(size - 8, 8, true);
  if (V.align != null) {
    const a = V.align;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const d = Math.max(Math.abs(r), Math.abs(c));
      setF(a + r, a + c, d !== 1);
    }
  }
  for (let r = 0; r <= 8; r++) res[r][8] = true;
  for (let c = 0; c <= 8; c++) res[8][c] = true;
  for (let r = size - 7; r < size; r++) res[r][8] = true;
  for (let c = size - 8; c < size; c++) res[8][c] = true;
  const totalBits = finalCW.length * 8;
  let bitIndex = 0;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    const up = ((col + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const row = up ? size - 1 - vert : vert;
      for (let k = 0; k < 2; k++) {
        const cc = col - k;
        if (!res[row][cc]) {
          let bit = 0;
          if (bitIndex < totalBits) bit = (finalCW[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
          mat[row][cc] = bit;
        }
      }
    }
  }
  const maskBit = (m, r, c) => {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  };
  const bitLen = (v) => { let l = 0; while (v) { l++; v >>= 1; } return l; };
  const placeFormat = (T, m) => {
    const data = (0b00 << 3) | m;
    let d = data << 10;
    const G = 0x537;
    while (bitLen(d) >= bitLen(G)) d ^= G << (bitLen(d) - bitLen(G));
    const fmt = (((data << 10) | d) ^ 0x5412) & 0x7fff;
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      if (i < 6) T[i][8] = bit;
      else if (i < 8) T[i + 1][8] = bit;
      else T[size - 15 + i][8] = bit;
    }
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      if (i < 8) T[8][size - 1 - i] = bit;
      else if (i === 8) T[8][7] = bit;
      else T[8][14 - i] = bit;
    }
    T[size - 8][8] = 1;
  };
  const penalty = (M) => {
    let p = 0;
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (M[r][c] === M[r][c - 1]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (M[r][c] === M[r - 1][c]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = M[r][c];
      if (v === M[r][c + 1] && v === M[r + 1][c] && v === M[r + 1][c + 1]) p += 3;
    }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], patR = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const m11 = (arr, r, c, h) => { for (let k = 0; k < 11; k++) { const v = h ? M[r][c + k] : M[r + k][c]; if (v !== arr[k]) return false; } return true; };
    for (let r = 0; r < size; r++) for (let c = 0; c <= size - 11; c++) if (m11(pat, r, c, true) || m11(patR, r, c, true)) p += 40;
    for (let c = 0; c < size; c++) for (let r = 0; r <= size - 11; r++) if (m11(pat, r, c, false) || m11(patR, r, c, false)) p += 40;
    let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (M[r][c]) dark++;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };
  let best = null, bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    const T = mat.map((row) => row.slice());
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!res[r][c] && maskBit(m, r, c)) T[r][c] ^= 1;
    placeFormat(T, m);
    const pen = penalty(T);
    if (pen < bestP) { bestP = pen; best = T; }
  }
  return best;
}

function QRCode({ value, size = 150 }) {
  const matrix = useMemo(() => { try { return qrMatrix(value); } catch { return null; } }, [value]);
  if (!matrix) return null;
  const n = matrix.length, m = 4, dim = n + 2 * m;
  const rects = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (matrix[r][c]) rects.push(<rect key={r + "-" + c} x={c + m} y={r + m} width={1.02} height={1.02} />);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x={0} y={0} width={dim} height={dim} fill="#FFFFFF" />
      <g fill="#10302E">{rects}</g>
    </svg>
  );
}

function buildVoucherBlob(v, labels) {
  return new Promise((resolve) => {
    try {
      const matrix = qrMatrix(v.code);
      const n = matrix.length, qz = 4, mod = 9;
      const qrPx = (n + qz * 2) * mod;
      const W = Math.max(qrPx + 64, 360);
      const headerH = 92, footH = 92, qx = (W - qrPx) / 2, qy = headerH;
      const H = headerH + qrPx + footH;
      const ratio = 2;
      const cv = document.createElement("canvas");
      cv.width = W * ratio; cv.height = H * ratio;
      const ctx = cv.getContext("2d");
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#B9810A";
      ctx.font = '600 12px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(labels.header.toUpperCase(), W / 2, 32);
      ctx.fillStyle = "#10302E";
      ctx.font = '700 31px "Space Mono", monospace';
      ctx.fillText(fmtAmt(v.amount) + " TZS", W / 2, 66);
      ctx.fillStyle = "#10302E";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
        if (matrix[r][c]) ctx.fillRect(qx + (c + qz) * mod, qy + (r + qz) * mod, mod, mod);
      const fy = headerH + qrPx;
      ctx.fillStyle = "#6B7A75";
      ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(labels.codeLabel.toUpperCase(), W / 2, fy + 22);
      ctx.fillStyle = "#10302E";
      ctx.font = '700 27px "Space Mono", monospace';
      ctx.fillText(v.code, W / 2, fy + 52);
      ctx.fillStyle = "#6B7A75";
      ctx.font = '500 13px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(labels.to + ": " + v.receiverName, W / 2, fy + 76);
      cv.toBlob((b) => resolve(b), "image/png");
    } catch { resolve(null); }
  });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------------ */
/* Bilingual strings                                                   */
/* ------------------------------------------------------------------ */
const STR = {
  sw: {
    brand: "KobeOS · Tuma", tagline: "Hati za pesa zinazothibitishwa",
    tSend: "Tuma", tPay: "Lipa", tBook: "Kitabu",
    newTitle: "Tengeneza hati ya malipo",
    senderName: "Jina la mtumaji", senderPhone: "Simu ya mtumaji",
    receiverName: "Jina la mpokeaji", receiverPhone: "Simu ya mpokeaji",
    amount: "Kiasi (TZS)", purpose: "Sababu / Madhumuni",
    agent: "Wakala / Mahali pa kuchukua",
    create: "Tengeneza hati",
    missing: "Jaza sehemu zinazohitajika:",
    voucher: "HATI YA MALIPO", txCode: "Namba ya muamala",
    pending: "INASUBIRI", paid: "IMELIPWA",
    copyMsg: "Nakili ujumbe", copied: "Imenakiliwa",
    shareReceiver: "Tuma kwa mpokeaji", copyCode: "Nakili namba", saveQr: "Hifadhi QR",
    shareSaved: "QR imehifadhiwa — iambatishe kwenye WhatsApp. Maandishi yamenakiliwa.",
    shareHint: "Mpe mpokeaji QR na namba ya muamala. PIN itume kando.",
    pinTitle: "PIN ya kuchukua", copyPin: "Nakili PIN",
    pinWarn: "Mtumie mpokeaji PIN hii kwa SMS au simu TOFAUTI — usiiweke kwenye ujumbe ule ule.",
    another: "Hati nyingine", from: "Kutoka", to: "Kwenda", on: "Tarehe",
    payTitle: "Thibitisha na lipa",
    paySub: "Ingiza namba ya muamala kuthibitisha kabla ya kutoa pesa.",
    enterCode: "Namba ya muamala", find: "Tafuta",
    notFound: "HAIPO — USILIPE",
    notFoundSub: "Hakuna hati yenye namba hii. Inaweza kuwa ya kughushi.",
    already: "TAYARI IMELIPWA",
    alreadySub: "Hati hii ilishalipwa. Usitoe pesa tena.",
    paidByLbl: "Imelipwa na", paidOnLbl: "Tarehe ya malipo",
    verifyTitle: "Thibitisha mpokeaji", enterPin: "PIN ya kuchukua (tarakimu 4)",
    agentName: "Jina lako (wakala)", confirm: "Thibitisha na lipa",
    wrongPin: "PIN si sahihi. Usilipe.",
    needAgent: "Andika jina lako kwanza.",
    paidNow: "IMELIPWA", paidNowSub: "Malipo yamekamilika na yameingizwa kwenye kitabu.",
    payAnother: "Lipa mwingine",
    scan: "Changanua QR", scanHint: "Elekeza msimbo wa QR ndani ya fremu",
    scanFail: "Kamera haipatikani hapa. Andika namba kwa mkono.", cancel: "Ghairi",
    bookTitle: "Kitabu cha malipo", bookSub: "Kumbukumbu za kidijitali — badala ya kitabu cha karatasi.",
    searchPh: "Tafuta namba, jina au simu",
    empty: "Bado hakuna hati. Tengeneza ya kwanza kwenye Tuma.",
    noRes: "Hakuna matokeo.",
    cToday: "Leo", cPending: "Zinasubiri", cPaid: "Zimelipwa",
    footer: "Malipo huthibitishwa kwa namba + PIN, si kwa kuangalia ujumbe.",
  },
  en: {
    brand: "KobeOS · Tuma", tagline: "Verifiable money vouchers",
    tSend: "Send", tPay: "Pay out", tBook: "Ledger",
    newTitle: "Create a payout voucher",
    senderName: "Sender name", senderPhone: "Sender phone",
    receiverName: "Receiver name", receiverPhone: "Receiver phone",
    amount: "Amount (TZS)", purpose: "Reason / Purpose",
    agent: "Agent / Pickup location",
    create: "Create voucher",
    missing: "Please fill the required fields:",
    voucher: "PAYOUT VOUCHER", txCode: "Transaction code",
    pending: "PENDING", paid: "PAID",
    copyMsg: "Copy message", copied: "Copied",
    shareReceiver: "Share to receiver", copyCode: "Copy code", saveQr: "Save QR",
    shareSaved: "QR saved — attach it in WhatsApp. Message copied.",
    shareHint: "Give the receiver the QR and the transaction code. Send the PIN separately.",
    pinTitle: "Collection PIN", copyPin: "Copy PIN",
    pinWarn: "Send this PIN to the receiver by a SEPARATE SMS or call — never in the same message.",
    another: "New voucher", from: "From", to: "To", on: "Date",
    payTitle: "Verify & pay out",
    paySub: "Enter the transaction code to verify before handing over cash.",
    enterCode: "Transaction code", find: "Find",
    notFound: "NOT FOUND — DO NOT PAY",
    notFoundSub: "No voucher with this code. It may be fake.",
    already: "ALREADY PAID",
    alreadySub: "This voucher was already paid. Do not hand over cash again.",
    paidByLbl: "Paid by", paidOnLbl: "Paid on",
    verifyTitle: "Verify the receiver", enterPin: "Collection PIN (4 digits)",
    agentName: "Your name (agent)", confirm: "Confirm & pay out",
    wrongPin: "Wrong PIN. Do not pay.",
    needAgent: "Enter your name first.",
    paidNow: "PAID", paidNowSub: "Payment complete and recorded in the ledger.",
    payAnother: "Pay another",
    scan: "Scan QR", scanHint: "Point the QR code inside the frame",
    scanFail: "Camera unavailable here. Type the code by hand.", cancel: "Cancel",
    bookTitle: "Payout ledger", bookSub: "A digital record — replaces the paper book.",
    searchPh: "Search code, name or phone",
    empty: "No vouchers yet. Create your first one under Send.",
    noRes: "No results.",
    cToday: "Today", cPending: "Pending", cPaid: "Paid",
    footer: "Payouts are verified by code + PIN, not by looking at a message.",
  },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
.kobe *{box-sizing:border-box;margin:0;padding:0}
.kobe{
  --page:#F1EDE4; --card:#FFFFFF; --ink:#10302E; --ink2:#56655F;
  --line:#E2DCCF; --gold:#B9810A; --gold-d:#9C6C06; --gold-soft:#FBEFCE;
  --green:#0F7A4D; --green-soft:#E2F2E9; --red:#B7382E; --red-soft:#FBE6E2;
  font-family:'Space Grotesk',system-ui,sans-serif;
  background:var(--page); color:var(--ink);
  min-height:100vh; width:100%;
  -webkit-font-smoothing:antialiased;
}
.kobe .wrap{max-width:480px;margin:0 auto;padding:0 0 90px}
.mono{font-family:'Space Mono',ui-monospace,monospace}
.topbar{background:var(--ink);color:#F1EDE4;padding:16px 18px 14px;
  display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20}
.brandwrap{display:flex;align-items:center;gap:10px}
.brandwrap .mark{width:34px;height:34px;border-radius:9px;background:var(--gold);
  display:flex;align-items:center;justify-content:center;color:var(--ink)}
.brandname{font-weight:700;font-size:16px;letter-spacing:.01em}
.brandtag{font-size:10.5px;color:#9FB3AC;letter-spacing:.03em;margin-top:1px}
.lang{display:flex;background:rgba(255,255,255,.10);border-radius:8px;padding:3px;gap:2px}
.lang button{border:0;background:transparent;color:#C8D6D0;font-family:inherit;
  font-weight:600;font-size:12px;padding:5px 9px;border-radius:6px;cursor:pointer}
.lang button.on{background:var(--gold);color:var(--ink)}
.tabs{display:flex;gap:0;background:var(--ink);padding:0 10px 12px;position:sticky;top:64px;z-index:19}
.tabs button{flex:1;border:0;background:transparent;color:#8FA39C;font-family:inherit;
  font-weight:600;font-size:12.5px;padding:9px 4px;cursor:pointer;display:flex;
  flex-direction:column;align-items:center;gap:4px;border-radius:9px}
.tabs button.on{background:rgba(255,255,255,.07);color:#F1EDE4}
.tabs svg{width:18px;height:18px}
.page{padding:20px 16px 0;animation:fade .25s ease}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-d)}
.h1{font-size:21px;font-weight:700;margin:6px 0 3px;line-height:1.2}
.sub{font-size:13px;color:var(--ink2);line-height:1.45;margin-bottom:18px}
.field{margin-bottom:13px}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:.07em;
  text-transform:uppercase;color:var(--ink2);margin-bottom:6px}
.field input{width:100%;border:1.5px solid var(--line);background:var(--card);
  border-radius:11px;padding:13px 14px;font-family:inherit;font-size:15px;color:var(--ink);
  transition:border-color .15s}
.field input:focus{outline:none;border-color:var(--gold)}
.field.amt input{font-family:'Space Mono',monospace;font-weight:700;font-size:18px}
.row2{display:flex;gap:10px}
.row2 .field{flex:1}
.btn{width:100%;border:0;border-radius:12px;padding:15px;font-family:inherit;
  font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;gap:8px;transition:background .15s,transform .05s}
.btn:active{transform:scale(.99)}
.btn.gold{background:var(--gold);color:var(--ink)}
.btn.gold:hover{background:var(--gold-d)}
.btn.ink{background:var(--ink);color:#F1EDE4}
.btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
.btn svg{width:18px;height:18px}
.alert{background:var(--red-soft);border:1px solid #EFC4BD;border-radius:11px;
  padding:11px 13px;font-size:12.5px;color:#8A2820;display:flex;gap:9px;margin-bottom:14px;line-height:1.4}
.alert svg{width:17px;height:17px;flex-shrink:0;margin-top:1px}
.voucher{background:var(--card);border:1.5px solid var(--line);border-radius:16px;
  overflow:hidden;animation:fade .3s ease;margin-bottom:14px}
.vtop{padding:16px 18px}
.vhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.vbrand{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;
  letter-spacing:.1em;color:var(--gold-d)}
.vbrand svg{width:15px;height:15px}
.chip{font-size:10.5px;font-weight:700;letter-spacing:.06em;padding:4px 9px;border-radius:20px}
.chip.pend{background:var(--gold-soft);color:var(--gold-d)}
.chip.paid{background:var(--green-soft);color:var(--green)}
.amtbig{font-size:33px;font-weight:700;letter-spacing:-.01em;line-height:1}
.amtbig small{font-size:15px;color:var(--ink2);font-weight:400;margin-left:6px}
.vrows{margin-top:16px;display:flex;flex-direction:column;gap:11px}
.vrow{display:flex;justify-content:space-between;gap:14px;font-size:13px}
.vrow .k{color:var(--ink2);flex-shrink:0}
.vrow .v{text-align:right;font-weight:500}
.perf{position:relative;height:2px;border-top:2px dashed var(--line);margin:4px 14px}
.perf::before,.perf::after{content:"";position:absolute;top:-11px;width:20px;height:20px;
  border-radius:50%;background:var(--page);border:1.5px solid var(--line)}
.perf::before{left:-25px;border-right-color:transparent;border-top-color:transparent}
.perf::after{right:-25px;border-left-color:transparent;border-top-color:transparent}
.vstub{padding:14px 18px 18px;text-align:center}
.stublbl{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2)}
.code{font-family:'Space Mono',monospace;font-weight:700;font-size:25px;letter-spacing:.06em;margin-top:5px}
.copyrow{display:flex;gap:9px;margin-bottom:14px}
.copyrow .btn{flex:1}
.pinbox{background:var(--gold-soft);border:1.5px solid #ECD79B;border-radius:13px;
  padding:14px 15px;margin-bottom:14px}
.pinbox .top{display:flex;align-items:center;justify-content:space-between}
.pinlbl{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;
  letter-spacing:.08em;text-transform:uppercase;color:var(--gold-d)}
.pinlbl svg{width:14px;height:14px}
.pinval{font-family:'Space Mono',monospace;font-weight:700;font-size:26px;letter-spacing:.18em;
  color:var(--ink);margin:6px 0 8px}
.pinwarn{font-size:11.5px;color:#7A5A12;line-height:1.45}
.pincopy{border:0;background:rgba(0,0,0,.06);border-radius:8px;padding:6px 11px;
  font-family:inherit;font-weight:600;font-size:11.5px;cursor:pointer;display:flex;
  align-items:center;gap:5px;color:var(--gold-d)}
.pincopy svg{width:13px;height:13px}
.codeinput input{font-family:'Space Mono',monospace;font-weight:700;font-size:20px;
  letter-spacing:.06em;text-transform:uppercase;text-align:center}
.verdict{border-radius:16px;padding:26px 20px;text-align:center;color:#fff;
  animation:pop .3s cubic-bezier(.2,.7,.3,1.2);margin-bottom:14px}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.verdict.green{background:var(--green)}
.verdict.red{background:var(--red)}
.verdict.amber{background:#B5700C}
.verdict .vicon{width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.16);
  display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.verdict .vicon svg{width:34px;height:34px}
.verdict h2{font-size:23px;font-weight:700;letter-spacing:.01em;line-height:1.15}
.verdict p{font-size:13px;opacity:.9;margin-top:7px;line-height:1.45}
.vcard{background:rgba(255,255,255,.12);border-radius:12px;padding:14px;margin-top:16px;text-align:left}
.vcard .ln{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0}
.vcard .ln .k{opacity:.8}
.vcard .ln .v{font-weight:600;text-align:right}
.vcard .amt{font-family:'Space Mono',monospace;font-weight:700;font-size:20px}
.detailcard{background:var(--card);border:1.5px solid var(--line);border-radius:14px;
  padding:16px 18px;margin-bottom:14px;animation:fade .25s}
.dtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.dcode{font-family:'Space Mono',monospace;font-weight:700;font-size:18px;letter-spacing:.05em}
.pinentry{display:flex;flex-direction:column;gap:11px}
.shake{animation:shk .4s}
@keyframes shk{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.counts{display:flex;gap:9px;margin-bottom:16px}
.count{flex:1;background:var(--card);border:1.5px solid var(--line);border-radius:12px;
  padding:11px 12px;text-align:center}
.count .n{font-family:'Space Mono',monospace;font-weight:700;font-size:20px}
.count .l{font-size:10.5px;color:var(--ink2);letter-spacing:.05em;margin-top:1px}
.count.g .n{color:var(--green)} .count.a .n{color:var(--gold-d)}
.searchbar{position:relative;margin-bottom:14px}
.searchbar svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);
  width:17px;height:17px;color:var(--ink2)}
.searchbar input{width:100%;border:1.5px solid var(--line);background:var(--card);
  border-radius:11px;padding:12px 13px 12px 38px;font-family:inherit;font-size:14px}
.searchbar input:focus{outline:none;border-color:var(--gold)}
.entry{background:var(--card);border:1.5px solid var(--line);border-radius:13px;
  padding:13px 15px;margin-bottom:10px}
.entry .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.entry .ecode{font-family:'Space Mono',monospace;font-weight:700;font-size:15px;letter-spacing:.04em}
.entry .names{font-size:13px;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.entry .names svg{width:13px;height:13px;color:var(--ink2)}
.entry .meta{font-size:11.5px;color:var(--ink2);margin-top:7px;display:flex;
  justify-content:space-between;gap:10px;flex-wrap:wrap}
.entry .eamt{font-family:'Space Mono',monospace;font-weight:700;font-size:14px}
.empty{text-align:center;color:var(--ink2);font-size:13px;padding:40px 20px;line-height:1.5}
.foot{text-align:center;font-size:11px;color:var(--ink2);padding:22px 24px 0;line-height:1.5}
.foot svg{width:13px;height:13px;vertical-align:-2px;margin-right:4px;color:var(--gold-d)}
.qrwrap{display:flex;justify-content:center;margin-bottom:12px}
.qrcard{background:#fff;padding:10px;border:1.5px solid var(--line);border-radius:14px;line-height:0}
.sharenote{background:var(--green-soft);color:var(--green);border:1px solid #BFE3CE;border-radius:11px;
  padding:10px 13px;font-size:12.5px;font-weight:600;display:flex;gap:8px;align-items:center;margin-bottom:12px;line-height:1.4}
.sharenote svg{width:16px;height:16px;flex-shrink:0}
.sharehint{text-align:center;font-size:11.5px;color:var(--ink2);margin:11px 4px 2px;line-height:1.45}
.payrow{display:flex;gap:10px;margin-top:12px}
.payrow .btn{flex:1}
.scanov{position:fixed;inset:0;background:#06100F;z-index:50;display:flex;
  flex-direction:column;align-items:center;justify-content:center}
.scanvid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scanframe{position:relative;width:64vw;max-width:280px;aspect-ratio:1;border-radius:22px;
  box-shadow:0 0 0 100vmax rgba(6,16,15,.62);border:3px solid rgba(255,255,255,.9);z-index:2}
.scanframe::before,.scanframe::after{content:"";position:absolute;width:30px;height:30px;border:4px solid var(--gold)}
.scanframe::before{top:-3px;left:-3px;border-right:0;border-bottom:0;border-top-left-radius:22px}
.scanframe::after{bottom:-3px;right:-3px;border-left:0;border-top:0;border-bottom-right-radius:22px}
.scanhint{position:relative;z-index:2;color:#fff;font-size:14px;font-weight:600;
  margin-top:26px;text-align:center;padding:0 30px;line-height:1.4}
.scancancel{position:relative;z-index:2;margin-top:22px;width:auto;padding:12px 26px;
  background:rgba(255,255,255,.14);color:#fff;border:1.5px solid rgba(255,255,255,.3)}
@media (prefers-reduced-motion:reduce){.kobe *{animation:none!important;transition:none!important}}
`;

export default function Tuma() {
  const [lang, setLang] = useState("sw");
  const [tab, setTab] = useState("send");
  const [transfers, setTransfers] = useState([]);
  const t = (k) => STR[lang][k];

  const loadAll = async () => {
    try {
      const res = await store.list("kobeos:transfer:");
      const keys = (res && res.keys) || [];
      const items = [];
      for (const k of keys) {
        try { const r = await store.get(k); if (r && r.value) items.push(JSON.parse(r.value)); } catch { /* skip corrupt row */ }
      }
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransfers(items);
    } catch { setTransfers([]); }
  };
  useEffect(() => { loadAll(); }, []);

  return (
    <div className="kobe">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="topbar">
          <div className="brandwrap">
            <div className="mark"><ShieldCheck strokeWidth={2.4} /></div>
            <div>
              <div className="brandname">{t("brand")}</div>
              <div className="brandtag">{t("tagline")}</div>
            </div>
          </div>
          <div className="lang">
            <button className={lang === "sw" ? "on" : ""} onClick={() => setLang("sw")}>SW</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>

        <div className="tabs">
          <button className={tab === "send" ? "on" : ""} onClick={() => setTab("send")}>
            <Send strokeWidth={2.2} />{t("tSend")}
          </button>
          <button className={tab === "pay" ? "on" : ""} onClick={() => setTab("pay")}>
            <Wallet strokeWidth={2.2} />{t("tPay")}
          </button>
          <button className={tab === "book" ? "on" : ""} onClick={() => { setTab("book"); loadAll(); }}>
            <BookOpen strokeWidth={2.2} />{t("tBook")}
          </button>
        </div>

        {tab === "send" && <SendView t={t} lang={lang} onCreated={loadAll} />}
        {tab === "pay" && <PayView t={t} onPaid={loadAll} />}
        {tab === "book" && <BookView t={t} transfers={transfers} reload={loadAll} />}

        <div className="foot"><ShieldCheck />{t("footer")}</div>
      </div>
    </div>
  );
}

function SendView({ t, lang, onCreated }) {
  const blank = { senderName: "", senderPhone: "", receiverName: "", receiverPhone: "", amount: "", purpose: "", agent: "" };
  const [f, setF] = useState(blank);
  const [missing, setMissing] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const [copied, setCopied] = useState("");
  const [shareNote, setShareNote] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const buildMessage = (v) => {
    const L = (sw, en) => (lang === "sw" ? sw : en);
    return [
      `🔐 KobeOS — ${L("HATI YA MALIPO", "PAYOUT VOUCHER")}`, "",
      `${L("Namba ya muamala", "Transaction code")}: ${v.code}`,
      `${L("Mtumaji", "Sender")}: ${v.senderName}${v.senderPhone ? " (" + v.senderPhone + ")" : ""}`,
      `${L("Mpokeaji", "Receiver")}: ${v.receiverName}${v.receiverPhone ? " (" + v.receiverPhone + ")" : ""}`,
      `${L("Kiasi", "Amount")}: ${fmtAmt(v.amount)} TZS`,
      v.purpose ? `${L("Madhumuni", "Purpose")}: ${v.purpose}` : null,
      `${L("Wakala/Mahali", "Agent/Location")}: ${v.agent}`,
      `${L("Tarehe", "Date")}: ${fmtDate(v.createdAt)}`, "",
      L(
        "Mpokeaji athibitishe kwa namba ya muamala hapo juu kabla ya kulipwa. PIN ya kuchukua utatumiwa kando.",
        "The receiver must be verified by the transaction code above before payout. The collection PIN is sent separately."
      ),
    ].filter(Boolean).join("\n");
  };
  const pinShareText = (v) =>
    lang === "sw"
      ? `PIN ya kuchukua ${v.code} ni: ${v.pin}. Usimpe mtu mwingine.`
      : `Collection PIN for ${v.code} is: ${v.pin}. Do not share with anyone else.`;

  const copy = async (text, which) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* paste fallback unsupported */ }
      document.body.removeChild(ta);
    }
    setCopied(which); setTimeout(() => setCopied(""), 1600);
  };

  const vLabels = () => ({
    header: lang === "sw" ? "KobeOS · Hati ya Malipo" : "KobeOS · Payout Voucher",
    codeLabel: lang === "sw" ? "Namba ya muamala" : "Transaction code",
    to: lang === "sw" ? "Kwa" : "To",
  });

  const shareVoucher = async (v) => {
    let blob = null;
    try { blob = await buildVoucherBlob(v, vLabels()); } catch { /* canvas blocked */ }
    const text = buildMessage(v);
    const file = blob ? new File([blob], `KobeOS-${v.code}.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: "KobeOS" }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (blob) downloadBlob(blob, `KobeOS-${v.code}.png`);
    await copy(text, "code");
    setShareNote(t("shareSaved")); setTimeout(() => setShareNote(""), 4500);
  };

  const saveQr = async (v) => {
    try { const blob = await buildVoucherBlob(v, vLabels()); if (blob) downloadBlob(blob, `KobeOS-${v.code}.png`); } catch { /* canvas blocked */ }
  };

  const submit = async () => {
    const need = [];
    if (!f.senderName.trim()) need.push(t("senderName"));
    if (!f.receiverName.trim()) need.push(t("receiverName"));
    if (!(Number(String(f.amount).replace(/[^\d.]/g, "")) > 0)) need.push(t("amount"));
    if (!f.agent.trim()) need.push(t("agent"));
    if (need.length) { setMissing(need); return; }
    setMissing([]);
    const v = {
      ...f,
      amount: Number(String(f.amount).replace(/[^\d.]/g, "")),
      code: genCode(), pin: genPin(),
      status: "PENDING", createdAt: new Date().toISOString(),
      paidAt: null, paidBy: null,
    };
    try { await store.set(KEY(v.code), JSON.stringify(v)); } catch { /* offline */ }
    setVoucher(v); onCreated();
  };

  if (voucher) {
    const v = voucher;
    return (
      <div className="page">
        <div className="voucher">
          <div className="vtop">
            <div className="vhead">
              <div className="vbrand"><ShieldCheck strokeWidth={2.2} />{t("voucher")}</div>
              <div className="chip pend">{t("pending")}</div>
            </div>
            <div className="amtbig">{fmtAmt(v.amount)}<small>TZS</small></div>
            <div className="vrows">
              <div className="vrow"><span className="k">{t("from")}</span><span className="v">{v.senderName}{v.senderPhone ? " · " + v.senderPhone : ""}</span></div>
              <div className="vrow"><span className="k">{t("to")}</span><span className="v">{v.receiverName}{v.receiverPhone ? " · " + v.receiverPhone : ""}</span></div>
              {v.purpose && <div className="vrow"><span className="k">{t("purpose")}</span><span className="v">{v.purpose}</span></div>}
              <div className="vrow"><span className="k">{t("agent")}</span><span className="v">{v.agent}</span></div>
              <div className="vrow"><span className="k">{t("on")}</span><span className="v">{fmtDate(v.createdAt)}</span></div>
            </div>
          </div>
          <div className="perf" />
          <div className="vstub">
            <div className="qrwrap"><div className="qrcard"><QRCode value={v.code} size={148} /></div></div>
            <div className="stublbl">{t("txCode")}</div>
            <div className="code">{v.code}</div>
          </div>
        </div>

        {shareNote && (<div className="sharenote"><Check strokeWidth={2.4} />{shareNote}</div>)}
        <button className="btn gold" onClick={() => shareVoucher(v)}>
          <Share2 strokeWidth={2.2} />{t("shareReceiver")}
        </button>
        <div className="copyrow" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={() => copy(buildMessage(v), "code")}>
            {copied === "code" ? <><Check strokeWidth={2.5} />{t("copied")}</> : <><Copy strokeWidth={2.2} />{t("copyCode")}</>}
          </button>
          <button className="btn ghost" onClick={() => saveQr(v)}>
            <Download strokeWidth={2.2} />{t("saveQr")}
          </button>
        </div>
        <div className="sharehint">{t("shareHint")}</div>

        <div className="pinbox">
          <div className="top">
            <span className="pinlbl"><Lock strokeWidth={2.2} />{t("pinTitle")}</span>
            <button className="pincopy" onClick={() => copy(pinShareText(v), "pin")}>
              {copied === "pin" ? <><Check strokeWidth={2.5} />{t("copied")}</> : <><Copy strokeWidth={2.2} />{t("copyPin")}</>}
            </button>
          </div>
          <div className="pinval">{v.pin}</div>
          <div className="pinwarn">{t("pinWarn")}</div>
        </div>

        <button className="btn ghost" onClick={() => { setVoucher(null); setF(blank); }}>
          <Plus strokeWidth={2.2} />{t("another")}
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="eyebrow">{t("tSend")}</div>
      <div className="h1">{t("newTitle")}</div>
      <div className="sub">{lang === "sw"
        ? "Jaza taarifa upate namba ya muamala na PIN ya kuchukua."
        : "Fill in the details to get a transaction code and collection PIN."}</div>

      {missing.length > 0 && (
        <div className="alert">
          <AlertTriangle strokeWidth={2.2} />
          <span>{t("missing")} {missing.join(", ")}.</span>
        </div>
      )}

      <div className="row2">
        <div className="field"><label>{t("senderName")}</label><input value={f.senderName} onChange={set("senderName")} placeholder="Salehe Sigala" /></div>
        <div className="field"><label>{t("senderPhone")}</label><input value={f.senderPhone} onChange={set("senderPhone")} inputMode="tel" placeholder="0712…" /></div>
      </div>
      <div className="row2">
        <div className="field"><label>{t("receiverName")}</label><input value={f.receiverName} onChange={set("receiverName")} placeholder="Alfred Mtega" /></div>
        <div className="field"><label>{t("receiverPhone")}</label><input value={f.receiverPhone} onChange={set("receiverPhone")} inputMode="tel" placeholder="0769…" /></div>
      </div>
      <div className="field amt"><label>{t("amount")}</label><input value={f.amount} onChange={set("amount")} inputMode="numeric" placeholder="200,000" /></div>
      <div className="field"><label>{t("purpose")}</label><input value={f.purpose} onChange={set("purpose")} placeholder="Harusi…" /></div>
      <div className="field"><label>{t("agent")}</label><input value={f.agent} onChange={set("agent")} placeholder="Cashworld Wakala, Rising Sun…" /></div>

      <button className="btn gold" onClick={submit}><Send strokeWidth={2.2} />{t("create")}</button>
    </div>
  );
}

function PayView({ t, onPaid }) {
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("idle");
  const [cur, setCur] = useState(null);
  const [pin, setPin] = useState("");
  const [agent, setAgent] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const canScan = typeof window !== "undefined" && "BarcodeDetector" in window &&
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";

  const reset = () => { setCode(""); setPhase("idle"); setCur(null); setPin(""); setAgent(""); setErr(""); };

  const normalize = (raw) => {
    let c = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (c && !c.startsWith("KOB-")) c = c.startsWith("KOB") ? "KOB-" + c.slice(3) : "KOB-" + c;
    return c;
  };

  const find = async (raw) => {
    const c = normalize(raw != null ? raw : code);
    if (!c) return;
    let v = null;
    try { const r = await store.get(KEY(c)); if (r && r.value) v = JSON.parse(r.value); } catch { /* not found */ }
    if (!v) { setCode(c); setPhase("notfound"); return; }
    setCode(c); setCur(v);
    setPhase(v.status === "PAID" ? "already" : "found");
  };

  const stopScan = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
    setScanning(false);
  };

  const startScan = async () => {
    setScanErr(""); setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found && found.length) { const raw = found[0].rawValue || ""; stopScan(); find(raw); return; }
        } catch { /* keep scanning */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      stopScan(); setScanErr(t("scanFail"));
    }
  };

  useEffect(() => () => stopScan(), []);

  const confirm = async () => {
    setErr("");
    if (!agent.trim()) { setErr(t("needAgent")); return; }
    if (pin.trim() !== cur.pin) {
      setErr(t("wrongPin")); setShake(true); setTimeout(() => setShake(false), 450); return;
    }
    const updated = { ...cur, status: "PAID", paidAt: new Date().toISOString(), paidBy: agent.trim() };
    try { await store.set(KEY(updated.code), JSON.stringify(updated)); } catch { /* offline */ }
    setCur(updated); setPhase("paidnow"); onPaid();
  };

  if (phase === "notfound")
    return (
      <div className="page">
        <div className="verdict red">
          <div className="vicon"><XCircle strokeWidth={2.2} /></div>
          <h2>{t("notFound")}</h2>
          <p>{t("notFoundSub")}</p>
        </div>
        <button className="btn ghost" onClick={reset}><RefreshCw strokeWidth={2.2} />{t("payAnother")}</button>
      </div>
    );

  if (phase === "already")
    return (
      <div className="page">
        <div className="verdict amber">
          <div className="vicon"><AlertTriangle strokeWidth={2.2} /></div>
          <h2>{t("already")}</h2>
          <p>{t("alreadySub")}</p>
          <div className="vcard">
            <div className="ln"><span className="k">{t("txCode")}</span><span className="v mono">{cur.code}</span></div>
            <div className="ln"><span className="k">{t("amount")}</span><span className="v amt">{fmtAmt(cur.amount)} TZS</span></div>
            <div className="ln"><span className="k">{t("paidByLbl")}</span><span className="v">{cur.paidBy || "—"}</span></div>
            <div className="ln"><span className="k">{t("paidOnLbl")}</span><span className="v">{cur.paidAt ? fmtDate(cur.paidAt) : "—"}</span></div>
          </div>
        </div>
        <button className="btn ghost" onClick={reset}><RefreshCw strokeWidth={2.2} />{t("payAnother")}</button>
      </div>
    );

  if (phase === "paidnow")
    return (
      <div className="page">
        <div className="verdict green">
          <div className="vicon"><CheckCircle2 strokeWidth={2.2} /></div>
          <h2>{t("paidNow")}</h2>
          <p>{t("paidNowSub")}</p>
          <div className="vcard">
            <div className="ln"><span className="k">{t("txCode")}</span><span className="v mono">{cur.code}</span></div>
            <div className="ln"><span className="k">{t("to")}</span><span className="v">{cur.receiverName}</span></div>
            <div className="ln"><span className="k">{t("amount")}</span><span className="v amt">{fmtAmt(cur.amount)} TZS</span></div>
            <div className="ln"><span className="k">{t("paidByLbl")}</span><span className="v">{cur.paidBy}</span></div>
            <div className="ln"><span className="k">{t("paidOnLbl")}</span><span className="v">{fmtDate(cur.paidAt)}</span></div>
          </div>
        </div>
        <button className="btn gold" onClick={reset}><RefreshCw strokeWidth={2.2} />{t("payAnother")}</button>
      </div>
    );

  if (phase === "found")
    return (
      <div className="page">
        <div className="detailcard">
          <div className="dtop">
            <span className="dcode">{cur.code}</span>
            <span className="chip pend">{t("pending")}</span>
          </div>
          <div className="amtbig" style={{ fontSize: 28 }}>{fmtAmt(cur.amount)}<small>TZS</small></div>
          <div className="vrows" style={{ marginTop: 13 }}>
            <div className="vrow"><span className="k">{t("to")}</span><span className="v">{cur.receiverName}{cur.receiverPhone ? " · " + cur.receiverPhone : ""}</span></div>
            <div className="vrow"><span className="k">{t("from")}</span><span className="v">{cur.senderName}</span></div>
            {cur.purpose && <div className="vrow"><span className="k">{t("purpose")}</span><span className="v">{cur.purpose}</span></div>}
            <div className="vrow"><span className="k">{t("agent")}</span><span className="v">{cur.agent}</span></div>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>{t("verifyTitle")}</div>
        <div className={"pinentry" + (shake ? " shake" : "")}>
          <div className="field" style={{ margin: 0 }}>
            <label>{t("agentName")}</label>
            <input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="—" />
          </div>
          <div className="field codeinput" style={{ margin: 0 }}>
            <label>{t("enterPin")}</label>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" />
          </div>
          {err && <div className="alert" style={{ margin: 0 }}><AlertTriangle strokeWidth={2.2} /><span>{err}</span></div>}
          <button className="btn gold" onClick={confirm}><CheckCircle2 strokeWidth={2.2} />{t("confirm")}</button>
          <button className="btn ghost" onClick={reset}>{t("payAnother")}</button>
        </div>
      </div>
    );

  return (
    <div className="page">
      <div className="eyebrow">{t("tPay")}</div>
      <div className="h1">{t("payTitle")}</div>
      <div className="sub">{t("paySub")}</div>
      <div className="field codeinput">
        <label>{t("enterCode")}</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KOB-XXXXXX"
          onKeyDown={(e) => e.key === "Enter" && find()} />
      </div>
      {scanErr && <div className="alert"><AlertTriangle strokeWidth={2.2} /><span>{scanErr}</span></div>}
      <div className="payrow">
        <button className="btn ink" onClick={() => find()}><Search strokeWidth={2.2} />{t("find")}</button>
        {canScan && (
          <button className="btn gold" onClick={startScan}><ScanLine strokeWidth={2.2} />{t("scan")}</button>
        )}
      </div>

      {scanning && (
        <div className="scanov">
          <video ref={videoRef} playsInline muted className="scanvid" />
          <div className="scanframe" />
          <div className="scanhint">{t("scanHint")}</div>
          <button className="btn scancancel" onClick={stopScan}>{t("cancel")}</button>
        </div>
      )}
    </div>
  );
}

function BookView({ t, transfers, reload }) {
  const [q, setQ] = useState("");
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const today = new Date().toDateString();
  const paidToday = transfers.filter((x) => x.paidAt && new Date(x.paidAt).toDateString() === today);
  const pending = transfers.filter((x) => x.status === "PENDING");
  const paid = transfers.filter((x) => x.status === "PAID");

  const ql = q.trim().toLowerCase();
  const list = ql
    ? transfers.filter((x) =>
        [x.code, x.senderName, x.receiverName, x.senderPhone, x.receiverPhone]
          .filter(Boolean).some((s) => String(s).toLowerCase().includes(ql)))
    : transfers;

  return (
    <div className="page">
      <div className="eyebrow">{t("tBook")}</div>
      <div className="h1">{t("bookTitle")}</div>
      <div className="sub">{t("bookSub")}</div>

      <div className="counts">
        <div className="count"><div className="n">{paidToday.length}</div><div className="l">{t("cToday")}</div></div>
        <div className="count a"><div className="n">{pending.length}</div><div className="l">{t("cPending")}</div></div>
        <div className="count g"><div className="n">{paid.length}</div><div className="l">{t("cPaid")}</div></div>
      </div>

      <div className="searchbar">
        <Search strokeWidth={2.2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} />
      </div>

      {transfers.length === 0 && <div className="empty">{t("empty")}</div>}
      {transfers.length > 0 && list.length === 0 && <div className="empty">{t("noRes")}</div>}

      {list.map((x) => (
        <div className="entry" key={x.code}>
          <div className="top">
            <span className="ecode">{x.code}</span>
            <span className={"chip " + (x.status === "PAID" ? "paid" : "pend")}>
              {x.status === "PAID" ? t("paid") : t("pending")}
            </span>
          </div>
          <div className="names">
            {x.senderName} <ArrowRight strokeWidth={2.2} /> {x.receiverName}
          </div>
          <div className="meta">
            <span className="eamt">{fmtAmt(x.amount)} TZS</span>
            <span>{x.status === "PAID" && x.paidBy ? `${t("paidByLbl")}: ${x.paidBy}` : fmtDate(x.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
