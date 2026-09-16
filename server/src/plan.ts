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
import type { Goal, IncomeSource, LedgerEntry, Profile, Skip } from './repo.js';

/** Out-categories that really are money leaving. "saving" is a transfer, not a spend. */
export const SPENDING_CATEGORIES = ['snacks', 'games', 'toys', 'clothes', 'fun', 'sharing', 'other'] as const;

/** In-categories that are real income. A "saving" inflow is money coming back out of the jar. */
export const INCOME_CATEGORIES = ['allowance', 'chores', 'gift', 'other'] as const;

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
  skips: Skip[] = [],
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

  // The Save jar is a pocket, not a purchase. Money moved into it is still the
  // kid's, and money taken back out to buy the thing is not new income, so both
  // sides of a "saving" entry are kept out of the income and spending figures.
  const spentThisMonth = sumSince(ledger, 'out', 30, SPENDING_CATEGORIES);
  const savedThisMonth = sumSince(ledger, 'out', 30, ['saving']) - sumSince(ledger, 'in', 30, ['saving']);
  const receivedThisMonth = sumSince(ledger, 'in', 30, INCOME_CATEGORIES);
  const totalIn = ledger.filter((e) => e.kind === 'in' && e.category !== 'saving').reduce((s, e) => s + e.amount, 0);
  const jarIn = ledger.filter((e) => e.kind === 'out' && e.category === 'saving').reduce((s, e) => s + e.amount, 0);
  const jarOut = ledger.filter((e) => e.kind === 'in' && e.category === 'saving').reduce((s, e) => s + e.amount, 0);
  const inSaveJar = Math.max(0, jarIn - jarOut);
  const totalSpent = ledger.filter((e) => e.kind === 'out' && e.category !== 'saving').reduce((s, e) => s + e.amount, 0);
  const totalOut = totalSpent + jarIn;
  /** Everything the kid has, jar included: what they started with, plus income, minus what was really spent. */
  const balanceNow = profile.startingBalance + totalIn - totalSpent;
  /** Money that is not already promised to a goal. */
  const spendableNow = balanceNow - inSaveJar;
  /** True when purchases are logged but income never is, which makes the balance look wrong. */
  const missingIncome = ledger.length > 0 && totalIn === 0 && profile.startingBalance === 0;
  const savingStreakWeeks = savingStreak(ledger);

  // Skipped treats are money that was never spent. It only becomes real saved
  // money once it is banked, so the two totals are reported separately.
  const pendingSkips = skips.filter((s) => s.movedAt === null);
  const skipsSummary = {
    count: skips.length,
    pendingCount: pendingSkips.length,
    /** Not yet moved into savings. */
    pendingTotal: round(pendingSkips.reduce((sum, s) => sum + s.amount, 0)),
    /** Everything ever skipped, banked or not. */
    total: round(skips.reduce((sum, s) => sum + s.amount, 0)),
    thisWeek: round(skips.filter((s) => ledgerTime(s.at) >= Date.now() - 7 * 86400_000).reduce((sum, s) => sum + s.amount, 0)),
  };
  const byCategory: Record<string, number> = {};
  for (const e of ledger) {
    if (e.kind !== 'out' || e.category === 'saving') continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  const activeGoals = localGoals.filter((g) => !g.completedAt);
  const doneGoals = localGoals.filter((g) => g.completedAt);
  const favorite = activeGoals.find((g) => g.isFavorite) ?? activeGoals[0];
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
    goals: activeGoals.map((g) => ({
      ...g,
      plans: goalPlans(g.price, normalized.perWeek, g.savedSoFar),
      progress: g.price > 0 ? Math.min(1, g.savedSoFar / g.price) : 1,
      deadline: deadlinePlan(g, normalized.perWeek, rate),
      reached: g.savedSoFar >= g.price,
    })),
    doneGoals: doneGoals.map((g) => ({ ...g, progress: 1 })),
    /** A whole year of income expressed in weeks, handy for the wishlist. */
    weeksPerYear: WEEKS_PER_YEAR,
    habits: habitPreview,
    ledgerSummary: {
      spentThisMonth: round(spentThisMonth),
      savedThisMonth: round(savedThisMonth),
      receivedThisMonth: round(receivedThisMonth),
      byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, round(v)])),
      entries: ledger.length,
      totalIn: round(totalIn),
      totalOut: round(totalOut),
      totalSpent: round(totalSpent),
      inSaveJar: round(inSaveJar),
      balanceNow: round(balanceNow),
      spendableNow: round(spendableNow),
      missingIncome,
      savingStreakWeeks,
    },
    skips: skipsSummary,
    insights: buildInsights({
      name: profile.name,
      ...(profile.age !== null ? { age: profile.age } : {}),
      currency: profile.currency,
      income: normalized,
      savingsRate: rate,
      annualRatePct: growth,
      startingBalance: profile.startingBalance,
      ...(habits.find((h) => h.id === 'candy') ? { candyPrice: (habits.find((h) => h.id === 'candy') as { price: number }).price } : {}),
      logged: {
        entries: ledger.length,
        spentThisMonth: round(spentThisMonth),
        receivedThisMonth: round(receivedThisMonth),
        topCategory: topCategory(byCategory),
        savingStreakWeeks,
        skippedTotal: skipsSummary.total,
        pendingSkipTotal: skipsSummary.pendingTotal,
      },
      ...(favorite ? { goal: { name: favorite.name, price: favorite.price - favorite.savedSoFar } } : {}),
      ...(topHabit ? { habit: { name: topHabit.name, price: topHabit.price, timesPerWeek: topHabit.timesPerWeek } } : {}),
    }),
  };
}

/** Money is summed as floating point, so round to cents before it leaves the API. */
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** The single biggest spending category, if there is one. */
function topCategory(byCategory: Record<string, number>): { name: string; amount: number } | null {
  const entries = Object.entries(byCategory);
  if (entries.length === 0) return null;
  const [name, amount] = entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { name, amount: round(amount) };
}

/** SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; user-supplied ISO strings are normalized the same way on insert. */
export function ledgerTime(at: string): number {
  const t = Date.parse(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? t : 0;
}

function sumSince(ledger: LedgerEntry[], kind: 'in' | 'out', days: number, categories?: readonly string[]): number {
  const cutoff = Date.now() - days * 86400 * 1000;
  return ledger
    .filter((e) => e.kind === kind && ledgerTime(e.at) >= cutoff && (!categories || categories.includes(e.category)))
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Consecutive weeks, counting back from this week, with at least one entry in
 * the "saving" category. The current week counts even if it just started.
 */
export function savingStreak(ledger: LedgerEntry[], now = Date.now()): number {
  const WEEK = 7 * 86400_000;
  const weeks = new Set<number>();
  for (const e of ledger) {
    if (e.kind !== 'out' || e.category !== 'saving') continue;
    weeks.add(Math.floor((now - ledgerTime(e.at)) / WEEK));
  }
  let streak = 0;
  while (weeks.has(streak)) streak++;
  return streak;
}
