import { Guardrail, RegexGuardrail } from './guardrail.entity';

export interface GuardrailDecision {
  allowed: boolean;
  /** The user-facing reason, present only when blocked. */
  reason?: string;
  kind?: Guardrail['kind'];
}

const ALLOW: GuardrailDecision = { allowed: true };

/** Longest a pattern may be, and how much text it may scan. */
const MAX_PATTERN = 400;
const MAX_SCAN = 20_000;

/**
 * Compile a rule's pattern defensively.
 *
 * Patterns are configuration a shop owner types, so a bad one must disable
 * that single rule rather than throw inside the assistant. An over-long
 * pattern is refused outright: these run on every message, and a
 * catastrophically backtracking regex would hang the reply.
 */
export function compilePattern(rule: RegexGuardrail): RegExp | null {
  if (!rule.pattern || rule.pattern.length > MAX_PATTERN) return null;
  try {
    return new RegExp(rule.pattern, rule.flags ?? 'i');
  } catch {
    return null;
  }
}

function matches(rule: RegexGuardrail, text: string): boolean {
  const re = compilePattern(rule);
  if (!re) return false;
  // Bound the scan so a huge document pasted into the assistant cannot turn a
  // cheap check into a slow one.
  return re.test(text.slice(0, MAX_SCAN));
}

/** Should this request be acted on at all? */
export function checkInput(message: string, rules: Guardrail[]): GuardrailDecision {
  for (const rule of rules) {
    if (rule.kind !== 'input_block') continue;
    if (matches(rule, message)) return { allowed: false, reason: rule.reason, kind: rule.kind };
  }
  return ALLOW;
}

/** Should this reply be sent? */
export function checkOutput(reply: string, rules: Guardrail[]): GuardrailDecision {
  for (const rule of rules) {
    if (rule.kind !== 'output_block') continue;
    if (matches(rule, reply)) return { allowed: false, reason: rule.reason, kind: rule.kind };
  }
  return ALLOW;
}

export interface ToolContext {
  /** Tool changes data, as opposed to reading it. */
  write: boolean;
  /** Local hour, 0–23, of the machine the shop runs on. */
  hour: number;
  /** Data-changing calls already made in the last hour. */
  writesThisHour: number;
}

/**
 * Should this tool run? Read-only tools are only ever stopped by an explicit
 * tool_block — the window and rate limits exist to contain writes, and
 * applying them to reads would break the assistant's ability to answer
 * questions out of hours, which is when a shopkeeper most often asks.
 */
export function checkTool(tool: string, ctx: ToolContext, rules: Guardrail[]): GuardrailDecision {
  for (const rule of rules) {
    if (rule.kind === 'tool_block' && rule.tools?.includes(tool)) {
      return { allowed: false, reason: rule.reason, kind: rule.kind };
    }
  }

  if (!ctx.write) return ALLOW;

  for (const rule of rules) {
    if (rule.kind === 'write_window' && !withinWindow(ctx.hour, rule.startHour, rule.endHour)) {
      return { allowed: false, reason: rule.reason, kind: rule.kind };
    }
    if (rule.kind === 'write_rate' && ctx.writesThisHour >= Math.max(0, rule.maxPerHour)) {
      return { allowed: false, reason: rule.reason, kind: rule.kind };
    }
  }
  return ALLOW;
}

/**
 * Hours are inclusive of start and exclusive of end, and a window that wraps
 * past midnight (22→6, for a bar) is a real case rather than a mistake.
 */
export function withinWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Drop anything that is not a rule we understand, so bad config cannot crash. */
export function sanitiseRules(input: unknown): Guardrail[] {
  if (!Array.isArray(input)) return [];
  const kinds = new Set(['input_block', 'output_block', 'tool_block', 'write_window', 'write_rate']);
  return input.filter((rule): rule is Guardrail => {
    if (!rule || typeof rule !== 'object') return false;
    const candidate = rule as Partial<Guardrail>;
    if (!candidate.kind || !kinds.has(candidate.kind)) return false;
    if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) return false;
    if (candidate.kind === 'input_block' || candidate.kind === 'output_block') {
      return compilePattern(rule as RegexGuardrail) !== null;
    }
    if (candidate.kind === 'tool_block') {
      return Array.isArray((rule as { tools?: unknown }).tools);
    }
    if (candidate.kind === 'write_window') {
      const { startHour, endHour } = rule as { startHour?: unknown; endHour?: unknown };
      return [startHour, endHour].every((h) => typeof h === 'number' && h >= 0 && h <= 23);
    }
    return typeof (rule as { maxPerHour?: unknown }).maxPerHour === 'number';
  }).slice(0, 50);
}
