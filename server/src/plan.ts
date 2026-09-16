import {
  buildInsights,
  compoundGrowth,
  goalPlans,
  normalizeAll,
  projectBalance,
  skipHabit,
  splitPlan,
  type IncomeSource as CoreIncome,
} from '@pocketpilot/core';
import type { Goal, IncomeSource, LedgerEntry, Profile } from './repo.js';

/** Everything the dashboard needs, computed in one place so the numbers agree everywhere. */
export function buildPlan(profile: Profile, income: IncomeSource[], goals: Goal[], ledger: LedgerEntry[], habits: { id: string; name: string; price: number; timesPerWeek: number }[]) {
  const sources: CoreIncome[] = [
    { label: 'Allowance', amount: profile.allowanceAmount, cadence: profile.allowanceCadence },
    ...income.map((i) => ({ label: i.label, amount: i.amount, cadence: i.cadence })),
  ];
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

  const favorite = goals.find((g) => g.isFavorite) ?? goals[0];
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
    goals: goals.map((g) => ({
      ...g,
      plans: goalPlans(g.price, normalized.perWeek, g.savedSoFar),
      progress: g.price > 0 ? Math.min(1, g.savedSoFar / g.price) : 1,
    })),
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
      ...(favorite ? { goal: { name: favorite.name, price: favorite.price - favorite.savedSoFar } } : {}),
      ...(topHabit ? { habit: { name: topHabit.name, price: topHabit.price, timesPerWeek: topHabit.timesPerWeek } } : {}),
    }),
  };
}

function sumSince(ledger: LedgerEntry[], kind: 'in' | 'out', days: number): number {
  const cutoff = Date.now() - days * 86400 * 1000;
  return ledger.filter((e) => e.kind === kind && Date.parse(e.at.replace(' ', 'T') + (e.at.endsWith('Z') ? '' : 'Z')) >= cutoff).reduce((s, e) => s + e.amount, 0);
}
