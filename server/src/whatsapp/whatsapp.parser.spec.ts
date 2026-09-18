import { isOptOut, normalizePhone, parseInbound } from './whatsapp.parser';

describe('WhatsApp inbound', () => {
  describe('phone normalisation', () => {
    it('turns a Tanzanian local number into its international form', () => {
      expect(normalizePhone('0712345678')).toBe('255712345678');
      expect(normalizePhone('+255 712 345 678')).toBe('255712345678');
      expect(normalizePhone('00255712345678')).toBe('255712345678');
      expect(normalizePhone('712345678')).toBe('255712345678');
    });

    it('leaves an already-international number alone', () => {
      expect(normalizePhone('255712345678')).toBe('255712345678');
      expect(normalizePhone('447700900123')).toBe('447700900123');
    });

    it('returns nothing for input with no digits', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone('not a phone')).toBe('');
    });

    it('normalises the same person written four ways to one contact', () => {
      const forms = ['0712345678', '+255712345678', '255-712-345-678', '00255712345678'];
      expect(new Set(forms.map((f) => normalizePhone(f))).size).toBe(1);
    });
  });

  describe('payload parsing', () => {
    it('reads a Meta Cloud API delivery', () => {
      const parsed = parseInbound({
        entry: [{
          changes: [{
            value: {
              contacts: [{ profile: { name: 'Juma' } }],
              messages: [{ from: '255712345678', id: 'wamid.1', text: { body: 'Bei gani?' } }],
            },
          }],
        }],
      });
      expect(parsed).toEqual([
        { from: '255712345678', body: 'Bei gani?', externalId: 'wamid.1', name: 'Juma' },
      ]);
    });

    it('reads a flat provider payload', () => {
      expect(parseInbound({ msisdn: '0712345678', message: 'Habari', id: 'beem-9' })).toEqual([
        { from: '255712345678', body: 'Habari', externalId: 'beem-9', name: '' },
      ]);
    });

    it('ignores a status callback rather than treating it as a message', () => {
      // Delivery receipts arrive on the same endpoint and have no body.
      expect(parseInbound({
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
      })).toEqual([]);
      expect(parseInbound({ msisdn: '255712345678', status: 'DELIVERED' })).toEqual([]);
    });

    it('survives anything unexpected without throwing', () => {
      for (const payload of [null, undefined, 'text', 42, [], {}, { entry: 'nope' }]) {
        expect(() => parseInbound(payload)).not.toThrow();
        expect(parseInbound(payload)).toEqual([]);
      }
    });

    it('skips a message with no sender or no body', () => {
      expect(parseInbound({ message: 'orphan' })).toEqual([]);
      expect(parseInbound({ msisdn: '255712345678' })).toEqual([]);
    });

    it('reads every message in a batched delivery', () => {
      const parsed = parseInbound({
        entry: [{
          changes: [{
            value: {
              messages: [
                { from: '255712345678', id: 'a', text: { body: 'one' } },
                { from: '255713000000', id: 'b', text: { body: 'two' } },
              ],
            },
          }],
        }],
      });
      expect(parsed.map((m) => m.body)).toEqual(['one', 'two']);
    });
  });

  describe('opt-out', () => {
    it('recognises stop in English and Swahili', () => {
      for (const word of ['STOP', 'stop', 'Unsubscribe', 'acha', 'Sitaki', 'ondoa']) {
        expect(isOptOut(word)).toBe(true);
      }
    });

    it('does not treat an ordinary message as an opt-out', () => {
      expect(isOptOut('Do you stock stop valves?')).toBe(false);
      expect(isOptOut('')).toBe(false);
      expect(isOptOut('nataka kununua')).toBe(false);
    });
  });
});
