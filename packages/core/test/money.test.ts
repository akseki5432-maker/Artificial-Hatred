import { describe, expect, it } from 'vitest';
import { describeWeeks, formatMoney, fromYearly, normalize, normalizeAll, toYearly } from '../src/money.js';

describe('normalize', () => {
  it('turns a daily allowance into a year', () => {
    const n = normalize({ amount: 2, cadence: 'daily' });
    expect(n.perYear).toBe(730);
    expect(n.perMonth).toBeCloseTo(60.83, 2);
    expect(n.perWeek).toBeCloseTo(14.04, 2);
  });

  it('turns a weekly allowance into a year', () => {
    const n = normalize({ amount: 10, cadence: 'weekly' });
    expect(n.perYear).toBe(520);
    expect(n.perDay).toBeCloseTo(1.42, 2);
  });

  it('turns a monthly allowance into a year', () => {
    const n = normalize({ amount: 40, cadence: 'monthly' });
    expect(n.perYear).toBe(480);
    expect(n.perWeek).toBeCloseTo(9.23, 2);
  });

  it('sums several sources', () => {
    const n = normalizeAll([
      { amount: 10, cadence: 'weekly' },
      { amount: 20, cadence: 'monthly' },
    ]);
    expect(n.perYear).toBe(520 + 240);
  });

  it('ignores negatives and NaN', () => {
    expect(toYearly(-5, 'weekly')).toBe(0);
    expect(toYearly(Number.NaN, 'daily')).toBe(0);
    expect(fromYearly(520, 'weekly')).toBe(10);
  });
});

describe('formatMoney', () => {
  it('drops cents for whole numbers', () => {
    expect(formatMoney(520)).toBe('$520');
    expect(formatMoney(12.5)).toBe('$12.50');
  });
  it('compacts big numbers without throwing', () => {
    expect(formatMoney(16335.14, { compact: true })).toBe('$16.3K');
    expect(formatMoney(1234567, { compact: true })).toBe('$1.2M');
    expect(formatMoney(9999.5, { compact: true })).toBe('$9,999.50');
  });
  it('handles other currencies and bad codes', () => {
    expect(formatMoney(10, { currency: 'EUR' })).toContain('10');
    expect(formatMoney(10, { currency: 'NOT_A_CODE' })).toBe('NOT_A_CODE 10');
  });
});

describe('describeWeeks', () => {
  it('describes durations', () => {
    expect(describeWeeks(0)).toBe('right now');
    expect(describeWeeks(0.4)).toBe('less than a week');
    expect(describeWeeks(1)).toBe('1 week');
    expect(describeWeeks(3.2)).toBe('4 weeks');
    expect(describeWeeks(13)).toBe('about 3 months');
    expect(describeWeeks(52)).toBe('about 1 year');
    expect(describeWeeks(78)).toBe('about 1 year 6 months');
    expect(describeWeeks(Infinity)).toContain('never');
  });
});
