/**
 * Payment-SMS parser for the Kobepay deposit bridge.
 *
 * The iPhone Shortcuts automation forwards raw SMS from M-Pesa (Vodacom TZ) and
 * banks (NBC, CRDB, …). All the intelligence lives here so that when a provider
 * changes wording we update this file, not every phone. Verified against real
 * samples:
 *
 *   M-Pesa receive (person):
 *     "DH8C7263CE Confirmed. On 8/8/26, 8:41 pm Receive Tsh150,000.00 from
 *      ROMANA MAURUS KIMENA New balance is Tsh150,000.11..."
 *   M-Pesa receive (business/paybill):
 *     "DHCC7286JJ confirmed. You have received a payment of Tsh40,000.00 from
 *      922746 - TIPS-CRDB on 12/8/26..."
 *   M-Pesa Swahili duplicate (SAME code → deduped by the engine):
 *     "DHCC7286JJ imethibitishwa. Umepokea Tshs 40,000.00 kutoka CRDB Bank..."
 *   M-Pesa debit (IGNORED — not a deposit):
 *     "... has been deducted ...", "... sent to business ..."
 *   NBC deposit (no code / with REF):
 *     "Ndugu X ,TSH 5,600,000.00 imewekwa kwenye AC:050*****0147 kutoka Wakala
 *      48157 Tar 10-08-2026 REF:622217024333..."
 *
 * Env overrides (optional, once you want to tune matching):
 *   MPESA_TXID_REGEX / MPESA_AMOUNT_REGEX / MPESA_REF_REGEX  (group 1 = value)
 */

import { createHash } from 'crypto';

export type SmsProvider = 'MPESA' | 'NBC' | 'CRDB' | 'BANK' | 'UNKNOWN';
export type SmsDirection = 'RECEIVED' | 'SENT' | 'REVERSAL' | 'UNKNOWN';

export interface ParsedPaymentSms {
  transactionId: string;
  amount: number;
  senderName: string;
  senderPhone: string;
  reference: string;   // student-matching hint (e.g. KBP48291), often empty
  account: string;     // receiving account tail if present (e.g. **0147)
  provider: SmsProvider;
  direction: SmsDirection;
  raw: string;
}

/** Back-compat alias — the deposit engine imports these names. */
export type ParsedMpesaSms = ParsedPaymentSms;

function regexFromEnv(name: string, fallback: RegExp): RegExp {
  const raw = process.env[name];
  if (!raw) return fallback;
  try { return new RegExp(raw, 'i'); } catch { return fallback; }
}

// Leading M-Pesa confirmation code: 8–12 uppercase alphanumerics (must contain a
// digit) followed by Confirmed / confirmed / imethibitishwa.
const TXID_CONFIRMED = () => regexFromEnv('MPESA_TXID_REGEX', /\b([A-Z0-9]{8,12})\b\.?\s+(?:confirmed|imethibitishwa)/i);
const TXID_LEADING = /^\s*(?=[A-Z0-9]*[0-9])([A-Z]{2}[A-Z0-9]{6,10})\b/;
// Bank transaction reference, e.g. "REF:622217024333".
const BANK_REF = /\bREF[:\s]*([A-Z0-9]{6,})\b/i;
// Amount: Tsh / Tshs / TZS / TSH, tolerating "Tshs . 4684.6".
const AMOUNT = () => regexFromEnv('MPESA_AMOUNT_REGEX', /(?:tshs?|tzs)\s*\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
const PHONE = /(\+?255\d{9}|0\d{9})/;
// Student reference (a Kobepay code the parent puts on a paybill deposit).
const STUDENT_REF = () => regexFromEnv('MPESA_REF_REGEX', /\b(KBP[- ]?[A-Z0-9]{3,})\b/i);
// Receiving account tail: XX0147, **0147, ****2200, AC:050*****0147.
const ACCOUNT = /(?:AC[:\s]*|akaunti(?:\s+yako)?\s*|Akaunti\s*)([0-9X*]{4,}[0-9]{3,}|[X*]{2,}\d{3,}|\d{3,}[X*]+\d{3,})/i;

function toAmount(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function detectProvider(t: string): SmsProvider {
  if (/m-?pesa/i.test(t)) return 'MPESA';
  if (/\bNBC\b/i.test(t)) return 'NBC';
  if (/\bCRDB\b/i.test(t)) return 'CRDB';
  if (/imewekwa|akaunti|bank/i.test(t)) return 'BANK';
  return 'UNKNOWN';
}

function detectDirection(t: string): SmsDirection {
  if (/reversal|imerejeshwa|umerejeshewa/i.test(t)) return 'REVERSAL';
  if (/has been deducted|deducted from|sent to|umelipa|umetuma|paid to/i.test(t)) return 'SENT';
  if (/\breceive(d)?\b|received a payment|umepokea|imewekwa/i.test(t)) return 'RECEIVED';
  return 'UNKNOWN';
}

function clean(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim();
}

function extractName(t: string): string {
  const patterns = [
    /from\s+([A-Za-z][A-Za-z .'\-]+?)\s+New balance/i,          // M-Pesa person receive
    /from\s+([0-9]{3,}\s*-\s*[A-Za-z][\w .'\-]*?)\s+on\b/i,      // M-Pesa paybill "922746 - TIPS-CRDB"
    /from\s+([A-Za-z][A-Za-z .'\-]+?)\s+on\b/i,                  // M-Pesa generic "from X on"
    /kutoka\s+([A-Za-z][\w .'\-,*]+?)\s+(?:tarehe|tar\b|saa)\b/i, // Swahili "kutoka X tarehe/Tar/saa"
    /Ndugu\s+([A-Za-z][A-Za-z .'\-]+?)\s*,/i,                    // NBC "Ndugu NAME ,"
    /([A-Za-z][A-Za-z .'\-]{2,40})\s+(?:\+?255\d{9}|0\d{9})/,     // name before a phone
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return clean(m[1]);
  }
  return '';
}

/**
 * Parse a payment SMS. Returns null when there's no recognisable amount, so
 * marketing/junk SMS is ignored rather than crediting anything.
 */
export function parsePaymentSms(raw: string | null | undefined): ParsedPaymentSms | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();

  const amountMatch = text.match(AMOUNT());
  if (!amountMatch) return null;
  const amount = toAmount(amountMatch[1]);
  if (amount <= 0) return null;

  // Transaction id: M-Pesa code → bank REF → deterministic hash of the SMS
  // (so an exact re-forward dedupes, while distinct SMS differ).
  const codeMatch = text.match(TXID_CONFIRMED()) || text.match(TXID_LEADING);
  const refMatch = text.match(BANK_REF);
  const transactionId = codeMatch ? codeMatch[1].toUpperCase()
    : refMatch ? refMatch[1].toUpperCase()
    : `SMS-${createHash('sha1').update(text).digest('hex').slice(0, 16).toUpperCase()}`;

  const studentRef = text.match(STUDENT_REF());
  const acct = text.match(ACCOUNT);
  const phone = text.match(PHONE);

  return {
    transactionId,
    amount,
    senderName: extractName(text),
    senderPhone: phone ? phone[1] : '',
    reference: studentRef ? studentRef[1].replace(/\s+/g, '').toUpperCase() : '',
    account: acct ? acct[1].toUpperCase() : '',
    provider: detectProvider(text),
    direction: detectDirection(text),
    raw: text,
  };
}

/** Back-compat alias — existing callers import parseMpesaSms. */
export const parseMpesaSms = parsePaymentSms;
