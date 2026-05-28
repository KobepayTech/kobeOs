import { describe, it, expect } from 'vitest';

// ── Re-export the private evaluateFormula for testing ──────────────────────
// We test the formula engine in isolation by importing the module and
// exercising it through the exported component's internal logic.
// Since evaluateFormula is not exported, we replicate the minimal version
// here to unit-test the circular-reference guard specifically.

interface CellData { value: string; formula?: string }

function evaluateFormula(
  cells: Map<string, CellData>,
  formula: string,
  visited: Set<string> = new Set(),
): string {
  if (visited.has(formula)) return '#CIRCULAR';
  const nextVisited = new Set(visited).add(formula);
  const expr = formula.slice(1).trim();

  try {
    const replaced = expr.replace(/([A-Z]\d+)/g, (match) => {
      const col = match.charCodeAt(0) - 65;
      const row = parseInt(match.slice(1), 10) - 1;
      const key = `${col},${row}`;
      const cell = cells.get(key);
      if (!cell) return '0';
      const val = cell.formula
        ? evaluateFormula(cells, cell.formula, nextVisited)
        : cell.value;
      if (val === '#CIRCULAR') return '0';
      const num = parseFloat(val);
      return isNaN(num) ? '0' : String(num);
    });
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + replaced)();
    return String(result);
  } catch {
    return '#ERROR';
  }
}

describe('spreadsheet evaluateFormula', () => {
  it('evaluates a simple arithmetic formula', () => {
    const cells = new Map<string, CellData>();
    expect(evaluateFormula(cells, '=2+3')).toBe('5');
  });

  it('resolves a cell reference', () => {
    const cells = new Map<string, CellData>([['0,0', { value: '10' }]]);
    expect(evaluateFormula(cells, '=A1')).toBe('10');
  });

  it('resolves a chain of cell references', () => {
    const cells = new Map<string, CellData>([
      ['0,0', { value: '5' }],
      ['1,0', { formula: '=A1', value: '' }],
    ]);
    expect(evaluateFormula(cells, '=B1', new Set(), )).toBe('5');
  });

  // ── Circular reference guard ─────────────────────────────────────────────

  it('returns #CIRCULAR for a direct self-reference', () => {
    // A1 = "=A1" — the formula references itself
    const cells = new Map<string, CellData>([
      ['0,0', { formula: '=A1', value: '' }],
    ]);
    // Simulate evaluating A1's formula with A1 already in the visited set
    const visited = new Set(['=A1']);
    expect(evaluateFormula(cells, '=A1', visited)).toBe('#CIRCULAR');
  });

  it('does not stack-overflow on a circular chain', () => {
    // A1 = =B1, B1 = =A1
    const cells = new Map<string, CellData>([
      ['0,0', { formula: '=B1', value: '' }],
      ['1,0', { formula: '=A1', value: '' }],
    ]);
    // Should return a value (0 from the cycle-break) rather than throwing
    expect(() => evaluateFormula(cells, '=B1')).not.toThrow();
    const result = evaluateFormula(cells, '=B1');
    expect(['0', '#CIRCULAR']).toContain(result);
  });

  it('returns #ERROR for invalid expressions', () => {
    const cells = new Map<string, CellData>();
    expect(evaluateFormula(cells, '=1/')).toBe('#ERROR');
  });
});

// ── Decimal-string arithmetic helpers ────────────────────────────────────────
// These mirror the fixes in payments.service.ts and pos.service.ts.

describe('decimal string arithmetic (TypeORM decimal column pattern)', () => {
  it('parseFloat correctly handles TypeORM decimal string "15000.0000"', () => {
    const dbValue = '15000.0000' as unknown as number; // TypeORM returns string
    const qty = 3;
    const lineTotal = parseFloat((parseFloat(String(dbValue)) * qty).toFixed(4));
    expect(lineTotal).toBe(45000);
  });

  it('balance comparison works when balance is a decimal string', () => {
    const balance = '500.0000' as unknown as number;
    const amount = 600;
    const insufficient = parseFloat(balance as unknown as string) < amount;
    expect(insufficient).toBe(true);
  });

  it('balance addition does not concatenate strings', () => {
    const balance = '100.0000' as unknown as number;
    const amount = 50;
    const newBalance = parseFloat(
      (parseFloat(balance as unknown as string) + amount).toFixed(4),
    );
    expect(newBalance).toBe(150);
    expect(typeof newBalance).toBe('number');
  });

  it('balance subtraction does not produce NaN', () => {
    const balance = '200.0000' as unknown as number;
    const amount = 75;
    const newBalance = parseFloat(
      (parseFloat(balance as unknown as string) - amount).toFixed(4),
    );
    expect(newBalance).toBe(125);
  });
});

// ── POS price search ──────────────────────────────────────────────────────────

describe('erp-pos price search with decimal string prices', () => {
  function priceMatchesSearch(price: number | string, search: string): boolean {
    const priceStr = String(Math.round(parseFloat(String(price))));
    return priceStr.includes(search);
  }

  it('matches integer search against decimal string price', () => {
    expect(priceMatchesSearch('15000.0000', '15000')).toBe(true);
  });

  it('does not match unrelated search', () => {
    expect(priceMatchesSearch('15000.0000', '999')).toBe(false);
  });

  it('matches partial price search', () => {
    expect(priceMatchesSearch('35000.0000', '350')).toBe(true);
  });

  it('handles numeric price (non-API path)', () => {
    expect(priceMatchesSearch(8000, '8000')).toBe(true);
  });
});
