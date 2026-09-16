/**
 * Currency conversion. Rates are "units of currency per 1 USD".
 * The static table is an approximate fallback; the server replaces it with
 * live rates when it can reach a rate provider.
 */

export interface RateTable {
  base: 'USD';
  rates: Record<string, number>;
  /** ISO date the rates are from. */
  date: string;
  source: 'static' | 'live';
}

export const STATIC_RATES: RateTable = {
  base: 'USD',
  date: '2026-09-01',
  source: 'static',
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.52,
    NZD: 1.66,
    INR: 84,
    JPY: 150,
    MXN: 18.5,
    BRL: 5.4,
    ZAR: 18,
    SGD: 1.34,
    CHF: 0.88,
    SEK: 10.5,
    NOK: 10.8,
    DKK: 6.9,
    PLN: 3.95,
    TRY: 34,
    KRW: 1380,
    CNY: 7.2,
    HKD: 7.8,
  },
};

/** Currencies with no minor units in everyday use. */
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW']);

export function convertMoney(amount: number, from: string, to: string, table: RateTable = STATIC_RATES): number {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  const fromRate = table.rates[f];
  const toRate = table.rates[t];
  if (!fromRate || !toRate) throw new Error(`No exchange rate for ${!fromRate ? f : t}`);
  return (amount / fromRate) * toRate;
}

export function canConvert(from: string, to: string, table: RateTable = STATIC_RATES): boolean {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  return f === t || (Boolean(table.rates[f]) && Boolean(table.rates[t]));
}

/**
 * Convert and round to a "shop price" in the target currency:
 * cents for most currencies, whole units for zero-decimal ones, and
 * whole units once the amount is large enough that cents are noise.
 */
export function convertPrice(amount: number, from: string, to: string, table: RateTable = STATIC_RATES): number {
  const raw = convertMoney(amount, from, to, table);
  if (ZERO_DECIMAL_CURRENCIES.has(to.toUpperCase()) || raw >= 1000) return Math.round(raw);
  return Math.round(raw * 100) / 100;
}
