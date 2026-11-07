import { ledgerUnits, ledgerNumber } from './ledger-money';

describe('ledger fixed decimal units', () => {
  it('quantizes decimal and exponential inputs consistently', () => {
    expect(ledgerUnits(1.00005)).toBe(10001n);
    expect(ledgerUnits(0.00005)).toBe(1n);
    expect(ledgerUnits(1e-7)).toBe(0n);
    expect(ledgerUnits(-1.00005)).toBe(-10001n);
    expect(ledgerNumber(ledgerUnits(0.1) + ledgerUnits(0.2))).toBe(0.3);
  });
  it('refuses unsafe values instead of silently losing money precision', () => {
    expect(() => ledgerUnits(Infinity)).toThrow('finite');
    expect(() => ledgerUnits(1e20)).toThrow('safe numeric range');
    expect(() => ledgerNumber(9007199254740992n)).toThrow('safe numeric range');
  });
});
