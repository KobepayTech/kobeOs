import { describe, expect, it } from 'vitest';
import { relativeTime } from './ai-chat';

const NOW = new Date('2026-09-18T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('conversation timestamps', () => {
  it('shows nothing for a thread that has no messages yet', () => {
    expect(relativeTime(null, NOW)).toBe('');
  });

  it('ignores a timestamp it cannot parse rather than rendering NaN', () => {
    expect(relativeTime('not a date', NOW)).toBe('');
  });

  it('reads naturally across the ranges a shop actually sees', () => {
    expect(relativeTime(ago(5_000), NOW)).toBe('just now');
    expect(relativeTime(ago(3 * 60_000), NOW)).toBe('3 min ago');
    expect(relativeTime(ago(5 * 3_600_000), NOW)).toBe('5 h ago');
    expect(relativeTime(ago(3 * 86_400_000), NOW)).toBe('3 d ago');
  });

  it('falls back to a date once a week has passed', () => {
    const old = ago(30 * 86_400_000);
    expect(relativeTime(old, NOW)).toBe(new Date(old).toLocaleDateString());
  });

  it('never shows a negative age when a clock runs behind', () => {
    // The server's timestamp can be slightly ahead of the shop machine's clock.
    expect(relativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toBe('just now');
  });
});
