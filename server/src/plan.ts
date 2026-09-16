import {
  WEEKS_PER_YEAR,
  buildInsights,
  canConvert,
  compoundGrowth,
  convertPrice,
  goalPlans,
  normalizeAll,
  projectBalance,
  skipHabit,
  splitPlan,
  type IncomeSource as CoreIncome,
  type RateTable,
} from '@pocketpilot/core';
import type { Goal, IncomeSource, LedgerEntry, Profile } from './repo.js';

export interface DeadlinePlan {
  targetDate: string;
  weeksLeft: number;
  /** Weekly saving needed to make it, given what is already saved. */
  neededPerWeek: number;
  /** neededPerWeek as a share of weekly income, 0..n (over 1 = impossible on allowance alone). */
  shareOfIncome: number;
  onTrack: boolean;
}

export function deadlinePlan(goal: { price: number; savedSoFar: number; targetDate: string | null }, weeklyIncome: number, currentRate: number, now = new Date()): DeadlinePlan | null {
  if (!goal.targetDate) return null;
  const target = Date.parse(`${goal.targetDate}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  const weeksLeft = Math.max(0, (target - now.getTime()) / (7 * 86400_000));
  const remaining = Math.max(0, goal.price - goal.savedSoFar);
  const neededPerWeek = remaining === 0 ? 0 : weeksLeft <= 0 ? Infinity : remaining / weeksLeft;
  const shareOfIncome = weeklyIncome > 0 ? neededPerWeek / weeklyIncome : neededPerWeek === 0 ? 0 : Infinity;
  return { targetDate: goal.targetDate, weeksLeft, neededPerWeek, shareOfIncome, onTrack: neededPerWeek <= weeklyIncome * currentRate + 1e-9 };
}

/** Everything the dashboard needs, computed in one place so the numbers agree everywhere. */
export function buildPlan(
  profile: Profile,
  income: IncomeSource[],
  goals: Goal[],
  ledger: LedgerEntry[],
  habits: { id: string; name: string; price: number; timesPerWeek: number }[],
  rates?: RateTable,
) {
  const sources: (CoreIncome & { id: number | null })[] = [
    { id: null, label: 'Allowance', amount: profile.allowanceAmount, cadence: profile.allowanceCadence },
    ...income.map((i) => ({ id: i.id, label: i.label, amount: i.amount, cadence: i.cadence })),
  ];
  // Goals priced in another currency are shown in the profile currency.
  const localGoals = goals.map((g) => {
    if (g.currency.toUpperCase() === profile.currency.toUpperCase() || !rates || !canConvert(g.currency, profile.currency, rates)) {
      return { ...g, convertedFrom: null as { price: number; currency: string } | null };
    }
    return { ...g, price: convertPrice(g.price, g.currency, profile.currency, rates), currency: profile.currency, convertedFrom: { price: g.price, currency: g.currency } };
  });
  const normalized = normalizeAll(sources);
  const rate = profile.savingsRate;
  const growth = profile.growthRatePct;

  const balanceOneYear = projectBalance({ monthlyIncome: normalized.perMonth, savingsRate: rate, months: 12, annualRatePct: growth, startingBalance: profile.startingBalance });
  const yearsTo18 = profile.age !== null && profile.age < 18 ? 18 - profile.age : 10;
  const untilAdult = compoundGrowth({
    monthlyContribution: normalized.perMonth * rate,
    annualRatePct: growth,
    years: yearsTo18,
    startingBalance: profile.startingBalance,
    ...(profile.age !== null ? { startAge: profile.age } : {}),
  });
  const untilAdultNoGrowth = compoundGrowth({ monthlyContribution: normalized.perMonth * rate, annualRatePct: 0, years: yearsTo18, startingBalance: profile.startingBalance });

  const spentThisMonth = sumSince(ledger, 'out', 30);
  const receivedThisMonth = sumSince(ledger, 'in', 30);
  const byCategory: Record<string, number> = {};
  for (const e of ledger) {
    if (e.kind !== 'out') continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  const favorite = localGoals.find((g) => g.isFavorite) ?? localGoals[0];
  const habitPreview = habits.slice(0, 4).map((h) => ({
    ...h,
    oneYear: skipHabit({ costPerItem: h.price, timesPerWeek: h.timesPerWeek, years: 1, annualRatePct: growth }),
    fiveYears: skipHabit({ costPerItem: h.price, timesPerWeek: h.timesPerWeek, years: 5, annualRatePct: growth }),
  }));
  const topHabit = habits[0];

  return {
    profile,
    sources,
    normalized,
    split: splitPlan(normalized.perMonth, profile.split),
    balanceOneYear,
    untilAdult: { years: yearsTo18, withGrowth: untilAdult, noGrowth: untilAdultNoGrowth },
    goals: localGoals.map((g) => ({
      ...g,
      plans: goalPlans(g.price, normalized.perWeek, g.savedSoFar),
      progress: g.price > 0 ? Math.min(1, g.savedSoFar / g.price) : 1,
      deadline: deadlinePlan(g, normalized.perWeek, rate),
    })),
    /** A whole year of income expressed in weeks, handy for the wishlist. */
    weeksPerYear: WEEKS_PER_YEAR,
    habits: habitPreview,
    ledgerSummary: { spentThisMonth, receivedThisMonth, byCategory, entries: ledger.length },
    insights: buildInsights({
      name: profile.name,
      ...(profile.age !== null ? { age: profile.age } : {}),
      currency: profile.currency,
      income: normalized,
      savingsRate: rate,
      annualRatePct: growth,
      startingBalance: profile.startingBalance,
      ...(habits.find((h) => h.id === 'candy') ? { candyPrice: (habits.find((h) => h.id === 'candy') as { price: number }).price } : {}),
      ...(favorite ? { goal: { name: favorite.name, price: favorite.price - favorite.savedSoFar } } : {}),
      ...(topHabit ? { habit: { name: topHabit.name, price: topHabit.price, timesPerWeek: topHabit.timesPerWeek } } : {}),
    }),
  };
}

function sumSince(ledger: LedgerEntry[], kind: 'in' | 'out', days: number): number {
  const cutoff = Date.now() - days * 86400 * 1000;
  return ledger.filter((e) => e.kind === kind && Date.parse(e.at.replace(' ', 'T') + (e.at.endsWith('Z') ? '' : 'Z')) >= cutoff).reduce((s, e) => s + e.amount, 0);
}
