import { describe, expect, it } from 'vitest';
import { extractRemittanceCashierCode } from './remittanceCashierQr';

describe('extractRemittanceCashierCode', () => {
  it('accepts a raw KobePay code', () => {
    expect(extractRemittanceCashierCode('A7K92PQR')).toBe('A7K92PQR');
  });

  it('normalizes lowercase codes', () => {
    expect(extractRemittanceCashierCode('a7k92pqr')).toBe('A7K92PQR');
  });

  it('extracts a code from the QR URL', () => {
    expect(extractRemittanceCashierCode('https://pay.kobeapptz.com/rc/A7K92PQR')).toBe('A7K92PQR');
  });

  it('accepts a relative cashier path from hardware scanners', () => {
    expect(extractRemittanceCashierCode('/rc/A7K92PQR')).toBe('A7K92PQR');
  });

  it('rejects non-KobePay QR values', () => {
    expect(extractRemittanceCashierCode('https://example.com/pay/123')).toBeNull();
    expect(extractRemittanceCashierCode('12345678')).toBeNull();
  });
});
