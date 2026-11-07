import { Guardrail, SUGGESTED_GUARDRAILS } from './guardrail.entity';
import { checkInput, checkOutput, checkTool, compilePattern, sanitiseRules, withinWindow } from './guardrail.rules';

const reason = 'blocked for a reason';

describe('assistant guardrails', () => {
  describe('regex rules', () => {
    it('blocks an input that matches, and allows one that does not', () => {
      const rules: Guardrail[] = [{ kind: 'input_block', pattern: 'delete everything', reason }];
      expect(checkInput('Delete everything now', rules)).toMatchObject({ allowed: false, reason });
      expect(checkInput('What sold today?', rules).allowed).toBe(true);
    });

    it('blocks a reply that matches', () => {
      const rules: Guardrail[] = [{ kind: 'output_block', pattern: 'internal only', reason }];
      expect(checkOutput('This is INTERNAL ONLY', rules).allowed).toBe(false);
    });

    it('ignores a rule whose pattern does not compile, instead of throwing', () => {
      // Patterns are typed by a shop owner; one bad rule must not take the
      // assistant down with it.
      const rules: Guardrail[] = [{ kind: 'input_block', pattern: '([unclosed', reason }];
      expect(() => checkInput('anything', rules)).not.toThrow();
      expect(checkInput('anything', rules).allowed).toBe(true);
    });

    it('refuses an absurdly long pattern rather than running it on every message', () => {
      expect(compilePattern({ kind: 'input_block', pattern: 'a'.repeat(500), reason })).toBeNull();
    });

    it('catches the suggested card-number rule on a real-looking number', () => {
      const card = SUGGESTED_GUARDRAILS.find((rule) => rule.kind === 'output_block')!;
      expect(checkOutput('pay to 4111 1111 1111 1111 today', [card]).allowed).toBe(false);
      expect(checkOutput('the total is 12,500 TZS', [card]).allowed).toBe(true);
    });
  });

  describe('tool rules', () => {
    const ctx = { write: false, hour: 12, writesThisHour: 0 };

    it('blocks a named tool whether it reads or writes', () => {
      const rules: Guardrail[] = [{ kind: 'tool_block', tools: ['record_expense'], reason }];
      expect(checkTool('record_expense', ctx, rules).allowed).toBe(false);
      expect(checkTool('sales_today', ctx, rules).allowed).toBe(true);
    });

    it('lets reads through outside the write window', () => {
      // Asking "what sold today" at 23:00 is exactly when a shopkeeper asks;
      // the window exists to contain writes, not answers.
      const rules: Guardrail[] = [{ kind: 'write_window', startHour: 8, endHour: 18, reason }];
      expect(checkTool('sales_today', { ...ctx, hour: 23 }, rules).allowed).toBe(true);
      expect(checkTool('record_expense', { ...ctx, write: true, hour: 23 }, rules).allowed).toBe(false);
      expect(checkTool('record_expense', { ...ctx, write: true, hour: 9 }, rules).allowed).toBe(true);
    });

    it('stops writes once the hourly cap is reached', () => {
      const rules: Guardrail[] = [{ kind: 'write_rate', maxPerHour: 3, reason }];
      expect(checkTool('record_expense', { ...ctx, write: true, writesThisHour: 2 }, rules).allowed).toBe(true);
      expect(checkTool('record_expense', { ...ctx, write: true, writesThisHour: 3 }, rules).allowed).toBe(false);
      expect(checkTool('sales_today', { ...ctx, writesThisHour: 99 }, rules).allowed).toBe(true);
    });

    it('allows everything when no rules are configured', () => {
      expect(checkTool('record_expense', { ...ctx, write: true }, []).allowed).toBe(true);
    });
  });

  describe('windows', () => {
    it('treats the window as start-inclusive and end-exclusive', () => {
      expect(withinWindow(8, 8, 18)).toBe(true);
      expect(withinWindow(17, 8, 18)).toBe(true);
      expect(withinWindow(18, 8, 18)).toBe(false);
    });

    it('handles a window that wraps past midnight', () => {
      // A bar trading 22:00–06:00 is a real shop, not a typo.
      expect(withinWindow(23, 22, 6)).toBe(true);
      expect(withinWindow(2, 22, 6)).toBe(true);
      expect(withinWindow(12, 22, 6)).toBe(false);
    });

    it('treats an empty window as closed rather than always open', () => {
      expect(withinWindow(12, 9, 9)).toBe(false);
    });
  });

  describe('stored configuration', () => {
    it('drops rules it does not understand', () => {
      expect(sanitiseRules([
        { kind: 'nonsense', reason },
        { kind: 'input_block' },
        { kind: 'input_block', pattern: 'ok', reason },
      ])).toEqual([{ kind: 'input_block', pattern: 'ok', reason }]);
    });

    it('drops a rule whose pattern would not compile', () => {
      expect(sanitiseRules([{ kind: 'output_block', pattern: '([bad', reason }])).toEqual([]);
    });

    it('rejects an out-of-range hour', () => {
      expect(sanitiseRules([{ kind: 'write_window', startHour: 8, endHour: 99, reason }])).toEqual([]);
    });

    it('survives being handed something that is not a list', () => {
      expect(sanitiseRules(null)).toEqual([]);
      expect(sanitiseRules('rules')).toEqual([]);
    });

    it('accepts every suggested rule it offers', () => {
      expect(sanitiseRules(SUGGESTED_GUARDRAILS)).toHaveLength(SUGGESTED_GUARDRAILS.length);
    });

    it('caps how many rules can be stored', () => {
      const many = Array.from({ length: 80 }, () => ({ kind: 'input_block', pattern: 'x', reason }));
      expect(sanitiseRules(many)).toHaveLength(50);
    });
  });
});
