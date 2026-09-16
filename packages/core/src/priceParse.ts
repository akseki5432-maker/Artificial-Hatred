/**
 * Pull prices out of free text (search snippets, page titles, shopping results).
 * Kept dependency-free so it runs in the browser and on the server.
 */

export interface ParsedPrice {
  value: number;
  currency: string;
  /** The raw text that matched, useful for debugging providers. */
  raw: string;
}

const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD',
  US$: 'USD',
  'U.S.$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'C$': 'CAD',
  'CA$': 'CAD',
  'A$': 'AUD',
  'AU$': 'AUD',
  'NZ$': 'NZD',
  'R$': 'BRL',
  '₩': 'KRW',
  '₺': 'TRY',
  '₽': 'RUB',
  'zł': 'PLN',
  kr: 'SEK',
  CHF: 'CHF',
};

const CODES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'NZD', 'BRL', 'KRW', 'TRY', 'RUB', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'MXN', 'ZAR', 'SGD', 'HKD', 'CNY'];

const SYMBOL_PATTERN = Object.keys(SYMBOL_TO_CODE)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');

const NUMBER = String.raw`\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

/** "$59.99", "US$ 1,299", "€ 49,99" */
const SYMBOL_FIRST = new RegExp(String.raw`(${SYMBOL_PATTERN})\s?(${NUMBER})(?![\d])`, 'g');
/** "59.99 USD", "49,99 EUR", "60 dollars" */
const CODE_LAST = new RegExp(String.raw`(?<![\w.])(${NUMBER})\s?(${CODES.join('|')}|dollars?|euros?|pounds?)(?![A-Za-z])`, 'gi');
/** "USD 59.99" */
const CODE_FIRST = new RegExp(String.raw`\b(${CODES.join('|')})\s?(${NUMBER})(?![\d])`, 'g');

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordToCode(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('dollar')) return 'USD';
  if (w.startsWith('euro')) return 'EUR';
  if (w.startsWith('pound')) return 'GBP';
  return word.toUpperCase();
}

/**
 * Turn "1,299.99" / "1.299,99" / "1 299" into a number. Decides which separator is
 * the decimal one by looking at the last separator and how many digits follow it.
 */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  let normalized: string;
  if (lastSep === -1) {
    normalized = cleaned.replace(/\s/g, '');
  } else {
    const decimals = cleaned.length - lastSep - 1;
    const intPart = cleaned.slice(0, lastSep).replace(/[.,\s]/g, '');
    const fracPart = cleaned.slice(lastSep + 1);
    // A trailing group of exactly 3 digits is a thousands separator ("1,299"), not cents.
    normalized = decimals === 3 ? intPart + fracPart : `${intPart}.${fracPart}`;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Find every price-looking token in `text`. Duplicates are kept so callers can weight them. */
export function extractPrices(text: string): ParsedPrice[] {
  const out: ParsedPrice[] = [];
  const seenSpans = new Set<string>();
  const push = (raw: string, currency: string, numberText: string, index: number) => {
    const key = `${index}:${raw}`;
    if (seenSpans.has(key)) return;
    const value = parseNumber(numberText);
    if (value === null || value <= 0) return;
    seenSpans.add(key);
    out.push({ value, currency, raw });
  };
  for (const m of text.matchAll(SYMBOL_FIRST)) {
    push(m[0], SYMBOL_TO_CODE[m[1] ?? '$'] ?? 'USD', m[2] ?? '', m.index ?? 0);
  }
  for (const m of text.matchAll(CODE_FIRST)) {
    push(m[0], (m[1] ?? 'USD').toUpperCase(), m[2] ?? '', m.index ?? 0);
  }
  for (const m of text.matchAll(CODE_LAST)) {
    push(m[0], wordToCode(m[2] ?? 'USD'), m[1] ?? '', m.index ?? 0);
  }
  return out;
}

export interface PriceSummary {
  currency: string;
  low: number;
  median: number;
  high: number;
  count: number;
}

/**
 * Summarize a bag of prices into a robust estimate. Uses the most common currency,
 * then trims wild outliers (anything more than 4x or less than 1/4 of the median)
 * so a "$4.99 screen protector" doesn't drag a console's price down.
 */
export function summarizePrices(prices: ParsedPrice[], preferredCurrency?: string): PriceSummary | null {
  if (prices.length === 0) return null;
  const byCurrency = new Map<string, number[]>();
  for (const p of prices) {
    const list = byCurrency.get(p.currency) ?? [];
    list.push(p.value);
    byCurrency.set(p.currency, list);
  }
  let currency = preferredCurrency && byCurrency.has(preferredCurrency) ? preferredCurrency : '';
  if (!currency) {
    let best = -1;
    for (const [code, list] of byCurrency) {
      if (list.length > best) {
        best = list.length;
        currency = code;
      }
    }
  }
  const values = (byCurrency.get(currency) ?? []).slice().sort((a, b) => a - b);
  if (values.length === 0) return null;
  const rawMedian = median(values);
  const trimmed = values.filter((v) => v >= rawMedian / 4 && v <= rawMedian * 4);
  const use = trimmed.length > 0 ? trimmed : values;
  return {
    currency,
    low: use[0] ?? 0,
    median: median(use),
    high: use[use.length - 1] ?? 0,
    count: use.length,
  };
}

export function median(sortedOrNot: number[]): number {
  const s = sortedOrNot.slice().sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
