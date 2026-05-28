/**
 * Unit tests for the decimal-string arithmetic fix in payments.service.ts.
 *
 * TypeORM returns `decimal` columns as strings from PostgreSQL. Before the
 * fix, balance comparisons and arithmetic used raw string values, causing:
 *   - "500.0000" < 600  →  false  (string comparison, always wrong)
 *   - "100.0000" += 50  →  "100.000050"  (string concatenation)
 *
 * These tests verify the parseFloat guard pattern used in the service.
 */

describe('payments service — decimal string guard', () => {
  // Simulate what TypeORM hands back from a SELECT on a decimal column.
  function mockWalletBalance(raw: string): { balance: number } {
    return { balance: raw as unknown as number };
  }

  describe('insufficient-funds check', () => {
    it('correctly detects insufficient funds when balance is a decimal string', () => {
      const wallet = mockWalletBalance('500.0000');
      const amount = 600;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      expect(currentBalance < amount).toBe(true);
    });

    it('correctly allows a transaction when balance is sufficient', () => {
      const wallet = mockWalletBalance('1000.0000');
      const amount = 600;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      expect(currentBalance < amount).toBe(false);
    });

    it('handles exact balance equals amount (boundary)', () => {
      const wallet = mockWalletBalance('600.0000');
      const amount = 600;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      expect(currentBalance < amount).toBe(false); // exact match is allowed
    });
  });

  describe('CREDIT transaction', () => {
    it('adds amount to balance without string concatenation', () => {
      const wallet = mockWalletBalance('100.0000');
      const amount = 50;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      const txAmount = parseFloat(String(amount));
      const newBalance = parseFloat((currentBalance + txAmount).toFixed(4));
      expect(newBalance).toBe(150);
      expect(typeof newBalance).toBe('number');
    });

    it('preserves 4 decimal places', () => {
      const wallet = mockWalletBalance('100.0000');
      const amount = 0.0001;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      const newBalance = parseFloat((currentBalance + amount).toFixed(4));
      expect(newBalance).toBe(100.0001);
    });
  });

  describe('DEBIT transaction', () => {
    it('subtracts amount from balance correctly', () => {
      const wallet = mockWalletBalance('200.0000');
      const amount = 75;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      const newBalance = parseFloat((currentBalance - amount).toFixed(4));
      expect(newBalance).toBe(125);
    });

    it('does not produce NaN', () => {
      const wallet = mockWalletBalance('200.0000');
      const amount = 75;
      const currentBalance = parseFloat(wallet.balance as unknown as string);
      const newBalance = parseFloat((currentBalance - amount).toFixed(4));
      expect(isNaN(newBalance)).toBe(false);
    });
  });

  describe('TRANSFER transaction', () => {
    it('debits sender and credits receiver correctly', () => {
      const from = mockWalletBalance('500.0000');
      const to   = mockWalletBalance('200.0000');
      const amount = 150;

      const fromBalance = parseFloat(from.balance as unknown as string);
      const toBalance   = parseFloat(to.balance   as unknown as string);
      const txAmount    = parseFloat(String(amount));

      const newFrom = parseFloat((fromBalance - txAmount).toFixed(4));
      const newTo   = parseFloat((toBalance   + txAmount).toFixed(4));

      expect(newFrom).toBe(350);
      expect(newTo).toBe(350);
      // Conservation of money: total unchanged
      expect(newFrom + newTo).toBe(fromBalance + toBalance);
    });

    it('rejects transfer when sender has insufficient funds', () => {
      const from = mockWalletBalance('100.0000');
      const amount = 200;
      const fromBalance = parseFloat(from.balance as unknown as string);
      expect(fromBalance < amount).toBe(true);
    });
  });
});

describe('pos service — decimal string guard', () => {
  it('computes line total correctly when price is a decimal string', () => {
    const product = { price: '15000.0000' as unknown as number, stock: '10' as unknown as number };
    const qty = 3;
    const productPrice = parseFloat(product.price as unknown as string);
    const productStock = Number(product.stock);
    const lineTotal = parseFloat((productPrice * qty).toFixed(4));
    expect(lineTotal).toBe(45000);
    expect(productStock).toBe(10);
  });

  it('detects insufficient stock when stock is a numeric string', () => {
    const product = { stock: '2' as unknown as number };
    const qty = 5;
    const productStock = Number(product.stock);
    expect(productStock < qty).toBe(true);
  });

  it('decrements stock correctly', () => {
    const product = { stock: '10' as unknown as number };
    const qty = 3;
    const productStock = Number(product.stock);
    const newStock = productStock - qty;
    expect(newStock).toBe(7);
  });
});
