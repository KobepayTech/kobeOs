import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Calculator from '../index';

let getByRoleRef: ReturnType<typeof render>['getByRole'];

function clickBtn(label: string) {
  getByRoleRef('button', { name: label }).click();
}

function getDisplay(): string {
  // The display div has a distinctive font-mono + text-2xl class combination.
  // Query it by its test-stable class rather than text content to avoid
  // matching history entries that also contain numbers.
  const el = document.querySelector('.font-mono.tracking-wider');
  return el?.textContent ?? '';
}

describe('Calculator', () => {
  beforeEach(() => {
    const view = render(<Calculator />);
    getByRoleRef = view.getByRole;
  });

  // ── Basic arithmetic ──────────────────────────────────────────────────────

  it('displays 0 on initial render', () => {
    expect(getDisplay()).toBe('0');
  });

  it('adds two numbers', () => {
    clickBtn('3');
    clickBtn('+');
    clickBtn('5');
    clickBtn('=');
    expect(getDisplay()).toBe('8');
  });

  it('subtracts two numbers', () => {
    clickBtn('9');
    clickBtn('-');
    clickBtn('4');
    clickBtn('=');
    expect(getDisplay()).toBe('5');
  });

  it('multiplies two numbers', () => {
    clickBtn('6');
    clickBtn('*');
    clickBtn('7');
    clickBtn('=');
    expect(getDisplay()).toBe('42');
  });

  it('divides two numbers', () => {
    clickBtn('8');
    clickBtn('/');
    clickBtn('4');
    clickBtn('=');
    expect(getDisplay()).toBe('2');
  });

  // ── Bug fix: decimal point ────────────────────────────────────────────────

  it('allows a single decimal point in a number', () => {
    clickBtn('3');
    clickBtn('.');
    clickBtn('1');
    clickBtn('4');
    expect(getDisplay()).toBe('3.14');
  });

  it('does not allow multiple decimal points in one number', () => {
    clickBtn('3');
    clickBtn('.');
    clickBtn('.');
    clickBtn('1');
    expect(getDisplay()).toBe('3.1');
  });

  it('prefixes lone decimal with 0', () => {
    clickBtn('C');
    clickBtn('.');
    expect(getDisplay()).toBe('0.');
  });

  // ── Bug fix: chaining operators ───────────────────────────────────────────

  it('swaps operator without computing when operator is pressed twice', () => {
    clickBtn('5');
    clickBtn('+');
    clickBtn('-');
    clickBtn('3');
    clickBtn('=');
    expect(getDisplay()).toBe('2');
  });

  // ── Bug fix: repeat equals ────────────────────────────────────────────────

  it('repeats the last operation when = is pressed again', () => {
    clickBtn('2');
    clickBtn('+');
    clickBtn('3');
    clickBtn('=');
    expect(getDisplay()).toBe('5');
    clickBtn('=');
    expect(getDisplay()).toBe('8');
    clickBtn('=');
    expect(getDisplay()).toBe('11');
  });

  // ── Division by zero ──────────────────────────────────────────────────────

  it('shows Error on division by zero', () => {
    clickBtn('5');
    clickBtn('/');
    clickBtn('0');
    clickBtn('=');
    expect(getDisplay()).toBe('Error');
  });

  // ── Clear ─────────────────────────────────────────────────────────────────

  it('C resets display to 0', () => {
    clickBtn('9');
    clickBtn('C');
    expect(getDisplay()).toBe('0');
  });

  it('C clears repeat-equals state', () => {
    clickBtn('4');
    clickBtn('+');
    clickBtn('2');
    clickBtn('=');
    clickBtn('C');
    clickBtn('=');
    expect(getDisplay()).toBe('0');
  });

  // ── Backspace ─────────────────────────────────────────────────────────────

  it('del removes the last digit', () => {
    clickBtn('1');
    clickBtn('2');
    clickBtn('3');
    clickBtn('del');
    expect(getDisplay()).toBe('12');
  });

  it('del on single digit resets to 0', () => {
    clickBtn('7');
    clickBtn('del');
    expect(getDisplay()).toBe('0');
  });

  // ── Negation ──────────────────────────────────────────────────────────────

  it('± negates the current value', () => {
    clickBtn('5');
    clickBtn('±');
    expect(getDisplay()).toBe('-5');
  });
});
