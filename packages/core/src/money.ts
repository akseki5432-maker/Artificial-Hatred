/**
 * Money math for allowances. Everything is normalized to a yearly figure first
 * so daily / weekly / monthly amounts can be compared fairly.
 */

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface IncomeSource {
  /** Amount received each period, in the profile currency. */
  amount: number;
  cadence: Cadence;
  /** Optional label, e.g. "Allowance" or "Dog walking". */
  label?: string;
}

export interface Normalized {
  perDay: number;
  perWeek: number;
  perMonth: number;
  perYear: number;
}

export const DAYS_PER_YEAR = 365;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

const PERIODS_PER_YEAR: Record<Cadence, number> = {
  daily: DAYS_PER_YEAR,
  weekly: WEEKS_PER_YEAR,
  monthly: MONTHS_PER_YEAR,
  yearly: 1,
};

export const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function isCadence(value: unknown): value is Cadence {
  return typeof value === 'string' && (CADENCES as string[]).includes(value);
}

export function periodsPerYear(cadence: Cadence): number {
  return PERIODS_PER_YEAR[cadence];
}

/** Convert an amount received per `cadence` into a per-year amount. */
export function toYearly(amount: number, cadence: Cadence): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount * PERIODS_PER_YEAR[cadence];
}

/** Convert a per-year amount into an amount per `cadence`. */
export function fromYearly(perYear: number, cadence: Cadence): number {
  return perYear / PERIODS_PER_YEAR[cadence];
}

export function normalizeYearly(perYear: number): Normalized {
  return {
    perDay: perYear / DAYS_PER_YEAR,
    perWeek: perYear / WEEKS_PER_YEAR,
    perMonth: perYear / MONTHS_PER_YEAR,
    perYear,
  };
}

/** Normalize one income source. */
export function normalize(source: IncomeSource): Normalized {
  return normalizeYearly(toYearly(source.amount, source.cadence));
}

/** Normalize and sum several income sources (allowance + chores + gifts ...). */
export function normalizeAll(sources: IncomeSource[]): Normalized {
  const perYear = sources.reduce((sum, s) => sum + toYearly(s.amount, s.cadence), 0);
  return normalizeYearly(perYear);
}

/** Round to cents to avoid floating-point noise in display and comparisons. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface FormatOptions {
  currency?: string;
  locale?: string;
  /** Drop the cents when the value is a whole number of units (default true). */
  compactWhole?: boolean;
  /** Use compact notation for big numbers (1.2K, 3.4M). */
  compact?: boolean;
}

/** Format a number as money. Falls back gracefully for unknown currency codes. */
export function formatMoney(value: number, options: FormatOptions = {}): string {
  const { currency = 'USD', locale = 'en-US', compactWhole = true, compact = false } = options;
  const safe = Number.isFinite(value) ? value : 0;
  const isWhole = Math.abs(safe - Math.round(safe)) < 0.005;
  const useCompact = compact && Math.abs(safe) >= 10_000;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: useCompact ? 0 : compactWhole && isWhole ? 0 : 2,
      maximumFractionDigits: useCompact ? 1 : 2,
      ...(useCompact ? { notation: 'compact' as const } : {}),
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(isWhole && compactWhole ? 0 : 2)}`;
  }
}

/** Human-readable duration from a number of weeks, e.g. "3 weeks", "1 year 2 months". */
export function describeWeeks(weeks: number): string {
  if (!Number.isFinite(weeks)) return 'never (start saving something!)';
  if (weeks <= 0) return 'right now';
  if (weeks < 1) return 'less than a week';
  const totalWeeks = Math.ceil(weeks);
  if (totalWeeks < 9) return `${totalWeeks} week${totalWeeks === 1 ? '' : 's'}`;
  const months = totalWeeks / (WEEKS_PER_YEAR / MONTHS_PER_YEAR);
  if (months < 12) {
    const m = Math.round(months);
    return `about ${m} month${m === 1 ? '' : 's'}`;
  }
  const years = Math.floor(months / 12);
  const restMonths = Math.round(months - years * 12);
  if (restMonths === 0 || restMonths === 12) {
    const y = restMonths === 12 ? years + 1 : years;
    return `about ${y} year${y === 1 ? '' : 's'}`;
  }
  return `about ${years} year${years === 1 ? '' : 's'} ${restMonths} month${restMonths === 1 ? '' : 's'}`;
}
