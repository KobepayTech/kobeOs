/**
 * M-Pesa SMS parser.
 *
 * The iPhone Shortcuts bridge forwards the raw M-Pesa SMS text; the server does
 * all the intelligence here so that when M-Pesa changes its wording we update
 * this file, not every phone. Patterns are deliberately tolerant and can be
 * overridden with env vars once a real sample is confirmed:
 *
 *   MPESA_TXID_REGEX   — capture group 1 = transaction id
 *   MPESA_AMOUNT_REGEX — capture group 1 = amount (commas/decimals allowed)
 *   MPESA_REF_REGEX    — capture group 1 = the student reference (e.g. KBP48291)
 *
 * NOTE: the exact default matcher should be finalised against one real
 * "money received" SMS. Until then these cover the common Vodacom TZ format.
 */

export interface ParsedMpesaSms {
  transactionId: string;
  amount: number;
  senderName: string;
  senderPhone: string;
  reference: string;
  direction: 'RECEIVED' | 'SENT' | 'REVERSAL' | 'UNKNOWN';
  raw: string;
}

function regexFromEnv(name: string, fallback: RegExp): RegExp {
  const raw = process.env[name];
  if (!raw) return fallback;
  try { return new RegExp(raw, 'i'); } catch { return fallback; }
}

// Transaction id: M-Pesa TZ confirmation codes are ~10 uppercase alphanumerics,
// usually the first token of the SMS (e.g. "QGH7K12345 Confirmed.").
const TXID = () => regexFromEnv('MPESA_TXID_REGEX', /\b([A-Z0-9]{8,12})\b(?=\s+Confirmed|\s+imethibitishwa|\.)/);
const TXID_FALLBACK = /^\s*([A-Z0-9]{8,12})\b/;
// Amount: "TSh50,000.00" / "TZS 50,000" / "Tsh 5,000".
const AMOUNT = () => regexFromEnv('MPESA_AMOUNT_REGEX', /(?:tsh|tzs)\s*([\d,]+(?:\.\d{1,2})?)/i);
// Phone: 2557xxxxxxxx / +2557xxxxxxxx / 07xxxxxxxx.
const PHONE = /(\+?255\d{9}|0\d{9})/;
// Student reference: KBP48291 / "ref KBP48291" / "account: 48291".
const REF = () => regexFromEnv('MPESA_REF_REGEX', /\b(KBP[- ]?[A-Z0-9]{3,})\b/i);
const REF_ACCOUNT = /(?:ref(?:erence)?|account|acc|kumb\.?)\s*[:.\-]?\s*([A-Za-z0-9-]{3,})/i;

function toAmount(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function detectDirection(text: string): ParsedMpesaSms['direction'] {
  const t = text.toLowerCase();
  if (/reversal|imerejeshwa|umerejeshewa/.test(t)) return 'REVERSAL';
  if (/received|umepokea|you have received/.test(t)) return 'RECEIVED';
  if (/sent to|umelipa|umetuma|paid to/.test(t)) return 'SENT';
  return 'UNKNOWN';
}

function extractName(text: string): string {
  // "...from 0712345678 JOHN DOE ..." or "...kutoka JOHN DOE 0712..."
  const afterFrom = text.match(/(?:from|kutoka)\s+(?:\+?255\d{9}|0\d{9})?\s*([A-Za-z][A-Za-z .'-]{2,40})/i);
  if (afterFrom) return afterFrom[1].trim().replace(/\s+/g, ' ');
  const beforePhone = text.match(/([A-Za-z][A-Za-z .'-]{2,40})\s+(?:\+?255\d{9}|0\d{9})/);
  return beforePhone ? beforePhone[1].trim().replace(/\s+/g, ' ') : '';
}

/**
 * Parse a raw M-Pesa SMS. Returns null when there is no recognisable amount or
 * transaction id (so junk / non-payment SMS is ignored rather than crediting).
 */
export function parseMpesaSms(raw: string | null | undefined): ParsedMpesaSms | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();

  const idMatch = text.match(TXID()) || text.match(TXID_FALLBACK);
  const amountMatch = text.match(AMOUNT());
  if (!idMatch || !amountMatch) return null;

  const amount = toAmount(amountMatch[1]);
  if (amount <= 0) return null;

  const refMatch = text.match(REF()) || text.match(REF_ACCOUNT);
  const phoneMatch = text.match(PHONE);

  return {
    transactionId: idMatch[1].toUpperCase(),
    amount,
    senderName: extractName(text),
    senderPhone: phoneMatch ? phoneMatch[1] : '',
    reference: refMatch ? refMatch[1].replace(/\s+/g, '').toUpperCase() : '',
    direction: detectDirection(text),
    raw: text,
  };
}
