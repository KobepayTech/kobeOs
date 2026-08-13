import { parsePaymentSms, parseMpesaSms, ParsedPaymentSms } from './mpesa-parser';

function must(v: ParsedPaymentSms | null): ParsedPaymentSms {
  if (!v) throw new Error('expected a parsed SMS, got null');
  return v;
}

describe('parsePaymentSms — real samples', () => {
  it('M-Pesa person receive', () => {
    const p = must(parsePaymentSms(
      'DH8C7263CE Confirmed. On 8/8/26, 8:41 pm Receive Tsh150,000.00 from ROMANA MAURUS KIMENA New balance is Tsh150,000.11. Send or receive money to 200 countries.',
    ));
    expect(p.transactionId).toBe('DH8C7263CE');
    expect(p.amount).toBe(150000);
    expect(p.senderName).toContain('ROMANA MAURUS KIMENA');
    expect(p.direction).toBe('RECEIVED');
  });

  it('M-Pesa business/paybill receive', () => {
    const p = must(parsePaymentSms(
      'DHCC7286JJ confirmed. You have received a payment of Tsh40,000.00 from 922746 - TIPS-CRDB on 12/8/26 at 8:55 pm. New M-Pesa balance is Tsh40,000.11',
    ));
    expect(p.transactionId).toBe('DHCC7286JJ');
    expect(p.amount).toBe(40000);
    expect(p.direction).toBe('RECEIVED');
  });

  it('M-Pesa Swahili confirmation has the SAME transaction id (deduped by engine)', () => {
    const en = must(parsePaymentSms('DHCC7286JJ confirmed. You have received a payment of Tsh40,000.00 from 922746 - TIPS-CRDB on 12/8/26.'));
    const sw = must(parsePaymentSms('DHCC7286JJ imethibitishwa. Umepokea Tshs 40,000.00 kutoka CRDB Bank, Akaunti ****2200 - FAUSTINE HILMARY NZIKU tarehe 12/08/2026 saa 20:55:08.'));
    expect(sw.transactionId).toBe(en.transactionId);
    expect(sw.amount).toBe(40000); // tolerates "Tshs 40,000.00"
    expect(sw.direction).toBe('RECEIVED');
  });

  it('M-Pesa deductions and sends are NOT received', () => {
    const deducted = must(parsePaymentSms('DH8C725XFN Confirmed. Tsh36,630.00 has been deducted from your M-Pesa account on 8/8/26 at 8:41 pm as a repayment of M-Pesa Overdraft service. New M-Pesa balance is Tsh65,387.11.'));
    expect(deducted.direction).toBe('SENT');
    const sent = must(parsePaymentSms('DHCC727U0E Confirmed. Tsh5,000.00 sent to business J4U M-PESA on 12/8/26 at 10:07 am. New M-Pesa balance is Tsh0.11.'));
    expect(sent.direction).toBe('SENT');
  });

  it('NBC deposit with a REF and odd decimal', () => {
    const withRef = must(parsePaymentSms(
      'Ndugu STEPHENE SOSTERI NZIKU ,TSH 5,600,000.00 imewekwa kwenye AC:050*****0147 kutoka Wakala 48157 Tar 10-08-2026 17:08 REF:622217024333. Kama hutambui muamala huu piga 0768984000. NBC Wakala, Mtaa kwa Mtaa!',
    ));
    expect(withRef.amount).toBe(5600000);
    expect(withRef.transactionId).toBe('622217024333');
    expect(withRef.direction).toBe('RECEIVED');

    const oddDecimal = must(parsePaymentSms('Mpendwa Mteja, Tshs . 4684.6 imewekwa kwenye akaunti yako XX0147 tarehe 01-AUG-2026. Piga 0768984000 kama hutambui muamala.'));
    expect(oddDecimal.amount).toBeCloseTo(4684.6, 2);
    expect(oddDecimal.direction).toBe('RECEIVED');
    // No code and no REF → a stable synthetic id so an exact re-forward dedupes.
    expect(oddDecimal.transactionId.startsWith('SMS-')).toBe(true);
    expect(parsePaymentSms(oddDecimal.raw)!.transactionId).toBe(oddDecimal.transactionId);
  });

  it('extracts a Kobepay student reference when present (paybill deposits)', () => {
    const p = must(parsePaymentSms('DH8C7263CE Confirmed. Receive Tsh30,000.00 from JANE DOE. Reference KBP48291. New balance is Tsh30,000.00'));
    expect(p.reference).toBe('KBP48291');
  });

  it('ignores non-payment text and keeps the back-compat alias', () => {
    expect(parsePaymentSms('Karibu! Your bundle is active.')).toBeNull();
    expect(parsePaymentSms('')).toBeNull();
    expect(parsePaymentSms(undefined)).toBeNull();
    expect(parseMpesaSms).toBe(parsePaymentSms);
  });
});
