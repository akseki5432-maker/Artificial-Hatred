import { describe, expect, it } from 'vitest';
import { extractPrices, parseNumber, summarizePrices } from '../src/priceParse.js';

describe('parseNumber', () => {
  it('handles US and EU formats', () => {
    expect(parseNumber('59.99')).toBe(59.99);
    expect(parseNumber('1,299.99')).toBe(1299.99);
    expect(parseNumber('1.299,99')).toBe(1299.99);
    expect(parseNumber('1,299')).toBe(1299);
    expect(parseNumber('1 299')).toBe(1299);
    expect(parseNumber('49,99')).toBe(49.99);
    expect(parseNumber('')).toBeNull();
  });
});

describe('extractPrices', () => {
  it('finds symbol-first prices', () => {
    const p = extractPrices('Nintendo Switch 2 - $449.99 at Best Buy. Also US$ 459 elsewhere, and €469,99 in Germany.');
    expect(p.map((x) => [x.currency, x.value])).toEqual([
      ['USD', 449.99],
      ['USD', 459],
      ['EUR', 469.99],
    ]);
  });
  it('finds code-last and word prices', () => {
    const p = extractPrices('Costs 60 dollars or 55 EUR. USD 62.50 elsewhere.');
    const pairs = p.map((x) => [x.currency, x.value]);
    expect(pairs).toContainEqual(['USD', 60]);
    expect(pairs).toContainEqual(['EUR', 55]);
    expect(pairs).toContainEqual(['USD', 62.5]);
  });
  it('ignores zero and non-prices', () => {
    expect(extractPrices('Model 3000, version 2.5, released 2026')).toEqual([]);
    expect(extractPrices('$0 down')).toEqual([]);
  });
});

describe('summarizePrices', () => {
  it('uses the most common currency and trims outliers', () => {
    const s = summarizePrices(extractPrices('$4.99 case, $449.99 console, $459.00 bundle, $439.99 sale, €450'));
    expect(s?.currency).toBe('USD');
    expect(s?.count).toBe(3);
    expect(s?.median).toBe(449.99);
    expect(s?.low).toBe(439.99);
    expect(s?.high).toBe(459);
  });
  it('prefers a requested currency when present', () => {
    const s = summarizePrices(extractPrices('$449.99 and €450 and €460'), 'EUR');
    expect(s?.currency).toBe('EUR');
    expect(s?.median).toBe(455);
  });
  it('returns null for nothing', () => {
    expect(summarizePrices([])).toBeNull();
  });
});
