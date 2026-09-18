/**
 * Providers disagree about webhook shape — Beem, Meta Cloud API and the
 * various gateways a Tanzanian shop might use all nest the message
 * differently. Parsing is kept here, pure and total, so an unexpected payload
 * is ignored rather than throwing inside a public endpoint.
 */
export interface InboundMessage {
  from: string;
  body: string;
  externalId: string;
  name: string;
}

/** Digits only, with Tanzania's country code applied to local numbers. */
export function normalizePhone(raw: string, countryCode = '255'): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  // 0712... → 255712...
  if (digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  // Bare local number without the leading zero.
  if (digits.length <= 9) return `${countryCode}${digits}`;
  return digits;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

/**
 * Pull the messages out of a webhook body. Returns an empty list for anything
 * unrecognised — including delivery receipts and status callbacks, which
 * arrive on the same endpoint and are not customer messages.
 */
export function parseInbound(payload: unknown): InboundMessage[] {
  const root = asRecord(payload);
  const found: InboundMessage[] = [];

  // Meta Cloud API: entry[].changes[].value.messages[]
  const entries = Array.isArray(root.entry) ? root.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry).changes) ? asRecord(entry).changes as unknown[] : [];
    for (const change of changes) {
      const value = asRecord(asRecord(change).value);
      const contacts = Array.isArray(value.contacts) ? value.contacts as unknown[] : [];
      const profileName = firstString(asRecord(asRecord(contacts[0]).profile).name);
      const messages = Array.isArray(value.messages) ? value.messages as unknown[] : [];
      for (const message of messages) {
        const record = asRecord(message);
        const body = firstString(asRecord(record.text).body, record.body);
        const from = normalizePhone(firstString(record.from));
        if (!from || !body) continue;
        found.push({ from, body, externalId: firstString(record.id), name: profileName });
      }
    }
  }
  if (found.length) return found;

  // Beem-style and other flat payloads: { msisdn|from|sender, message|text|body }
  const from = normalizePhone(firstString(root.msisdn, root.from, root.sender, root.phone));
  const body = firstString(root.message, root.text, root.body, root.content);
  if (from && body) {
    found.push({
      from,
      body,
      externalId: firstString(root.id, root.message_id, root.messageId, root.request_id),
      name: firstString(root.name, root.sender_name),
    });
  }
  return found;
}

/**
 * Recognise a customer asking to be left alone. Checked before any automatic
 * reply, in both English and Swahili, because continuing to message someone
 * who said stop is the fastest way to lose a WhatsApp sender number.
 */
export function isOptOut(body: string): boolean {
  const text = (body ?? '').trim().toLowerCase();
  if (!text) return false;
  return /^(stop|unsubscribe|acha|sitaki|ondoa|hapana tuma)\b/.test(text);
}
