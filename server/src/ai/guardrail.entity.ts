import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Declarative checks applied around the assistant, adapted from the guardrail
 * layers in DeskcommCRM (MIT). The kinds are chosen for what KobeOS actually
 * risks: an assistant with tools that can change stock, record expenses and
 * message customers, running unattended on a shop counter.
 *
 * - `input_block`    refuse to act on a request matching a pattern
 * - `output_block`   refuse to send a reply matching a pattern
 * - `tool_block`     never run a named tool
 * - `write_window`   only allow data-changing tools inside business hours
 * - `write_rate`     cap data-changing tool calls per hour
 */
export type GuardrailKind =
  | 'input_block'
  | 'output_block'
  | 'tool_block'
  | 'write_window'
  | 'write_rate';

export interface GuardrailBase {
  kind: GuardrailKind;
  /** Shown to the user when this rule stops something. */
  reason: string;
}

export interface RegexGuardrail extends GuardrailBase {
  kind: 'input_block' | 'output_block';
  pattern: string;
  flags?: string;
}

export interface ToolBlockGuardrail extends GuardrailBase {
  kind: 'tool_block';
  tools: string[];
}

export interface WriteWindowGuardrail extends GuardrailBase {
  kind: 'write_window';
  /** Local hours, inclusive start, exclusive end. 8→18 means 08:00–17:59. */
  startHour: number;
  endHour: number;
}

export interface WriteRateGuardrail extends GuardrailBase {
  kind: 'write_rate';
  maxPerHour: number;
}

export type Guardrail =
  | RegexGuardrail
  | ToolBlockGuardrail
  | WriteWindowGuardrail
  | WriteRateGuardrail;

/**
 * Suggested rules a shop can adopt. NOT applied automatically — an assistant
 * that starts refusing things nobody asked it to refuse is worse than one
 * with no guardrails, so these are offered and stored only when chosen.
 */
export const SUGGESTED_GUARDRAILS: Guardrail[] = [
  {
    kind: 'output_block',
    // 13–19 digits with optional separators: a card number the assistant
    // should never repeat back, whatever it found them in.
    pattern: '\\b(?:\\d[ -]*?){13,19}\\b',
    reason: 'Replies must not contain what looks like a card number.',
  },
  {
    kind: 'write_window',
    startHour: 6,
    endHour: 22,
    reason: 'The assistant only changes business data during opening hours.',
  },
  {
    kind: 'write_rate',
    maxPerHour: 40,
    reason: 'A runaway loop should not be able to rewrite the whole shop.',
  },
];

@Entity('ai_guardrails')
export class AiGuardrailConfig extends BaseEntity {
  @Index('IDX_ai_guardrails_owner', { unique: true })
  @Column('uuid')
  ownerId!: string;

  /** Off by default: nothing is blocked until the shop opts in. */
  @Column({ default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rules!: Guardrail[];
}
