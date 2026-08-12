import { parseMpesaSms, ParsedMpesaSms } from './mpesa-parser';

function must(v: ParsedMpesaSms | null): ParsedMpesaSms {
  if (!v) throw new Error('expected a parsed SMS, got null');
  return v;
}

describe('parseMpesaSms', () => {
  it('parses a typical received-money SMS', () => {
    const sms = 'QGH7K12345 Confirmed. You have received TSh50,000.00 from 0712345678 JOHN DOE on 12/9/26. New M-PESA balance is TSh120,000.00. Reference KBP48291';
    const p = must(parseMpesaSms(sms));
    expect(p.transactionId).toBe('QGH7K12345');
    expect(p.amount).toBe(50000);
    expect(p.senderPhone).toBe('0712345678');
    expect(p.senderName).toContain('JOHN DOE');
    expect(p.reference).toBe('KBP48291');
    expect(p.direction).toBe('RECEIVED');
  });

  it('extracts the reference from an account/kumbukumbu field', () => {
    const sms = 'AB12CD34EF Confirmed. Umepokea TZS 25,000 kutoka 0765000111 AMINA S. Kumb. S4T7Q2';
    const p = must(parseMpesaSms(sms));
    expect(p.amount).toBe(25000);
    expect(p.reference).toBe('S4T7Q2');
  });

  it('ignores non-payment text', () => {
    expect(parseMpesaSms('Karibu! Your bundle is active.')).toBeNull();
    expect(parseMpesaSms('')).toBeNull();
    expect(parseMpesaSms(undefined)).toBeNull();
  });

  it('requires both a transaction id and an amount', () => {
    expect(parseMpesaSms('You have received TSh10,000')).toBeNull(); // no id
    expect(parseMpesaSms('QGH7K12345 Confirmed. Thanks')).toBeNull(); // no amount
  });

  it('detects outgoing payments distinctly', () => {
    const sms = 'QGH7K99999 Confirmed. Tsh 3,000.00 sent to SCHOOL CANTEEN 0700111222.';
    const p = must(parseMpesaSms(sms));
    expect(p.direction).toBe('SENT');
  });
});
