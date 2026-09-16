import { describe, expect, it } from 'vitest';
import { canConvert, convertMoney, convertPrice, type RateTable } from '../src/fx.js';

const table: RateTable = { base: 'USD', date: '2026-01-01', source: 'live', rates: { USD: 1, EUR: 0.5, JPY: 100 } };

describe('fx', () => {
  it('converts through USD', () => {
    expect(convertMoney(10, 'USD', 'EUR', table)).toBe(5);
    expect(convertMoney(5, 'EUR', 'USD', table)).toBe(10);
    expect(convertMoney(5, 'EUR', 'JPY', table)).toBe(1000);
    expect(convertMoney(7, 'usd', 'usd', table)).toBe(7);
  });
  it('rounds like a shop price', () => {
    expect(convertPrice(9.99, 'USD', 'EUR', table)).toBe(5);
    expect(convertPrice(9.99, 'USD', 'JPY', table)).toBe(999);
    expect(convertPrice(1234.56, 'USD', 'EUR', table)).toBe(617.28);
    expect(convertPrice(2500, 'USD', 'EUR', table)).toBe(1250);
    expect(convertPrice(2000.4, 'EUR', 'USD', table)).toBe(4001);
    expect(convertPrice(1.234, 'EUR', 'USD', table)).toBe(2.47);
  });
  it('reports unknown currencies', () => {
    expect(canConvert('USD', 'XXX', table)).toBe(false);
    expect(canConvert('EUR', 'JPY', table)).toBe(true);
    expect(() => convertMoney(1, 'USD', 'XXX', table)).toThrow(/XXX/);
  });
});
