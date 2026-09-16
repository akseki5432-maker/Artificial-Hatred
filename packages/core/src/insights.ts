import { HABIT_CATALOG } from './catalog.js';
import { describeWeeks, formatMoney, type Normalized } from './money.js';
import { compoundGrowth, equivalentUnits, skipHabit, weeksToGoal } from './projections.js';

export interface Insight {
  id: string;
  emoji: string;
  title: string;
  body: string;
  tone: 'wow' | 'tip' | 'warning' | 'win';
}

export interface InsightContext {
  name?: string;
  age?: number;
  currency?: string;
  income: Normalized;
  savingsRate?: number;
  /** Growth used for "if you invested it" lines. */
  annualRatePct?: number;
  /** Money already saved, included in growth projections. */
  startingBalance?: number;
  /** Price of a favorite goal, if any. */
  goal?: { name: string; price: number };
  /** A habit the kid logged, if any. */
  habit?: { name: string; price: number; timesPerWeek: number };
  /** Price of one candy bar in the kid's currency, for the "how many candy bars" line. */
  candyPrice?: number;
  /** Real numbers from the kid's money log, when they have been keeping one. */
  logged?: {
    entries: number;
    spentThisMonth: number;
    receivedThisMonth: number;
    topCategory: { name: string; amount: number } | null;
    savingStreakWeeks: number;
    skippedTotal: number;
    pendingSkipTotal: number;
  };
}

/** Plain-language observations that make the numbers land for a kid. */
export function buildInsights(ctx: InsightContext): Insight[] {
  const currency = ctx.currency ?? 'USD';
  const fmt = (v: number) => formatMoney(v, { currency });
  const { income } = ctx;
  const rate = ctx.savingsRate ?? 0.5;
  const growth = ctx.annualRatePct ?? 7;
  const startingBalance = ctx.startingBalance ?? 0;
  const out: Insight[] = [];

  if (income.perYear <= 0) {
    out.push({
      id: 'no-income',
      emoji: '🌱',
      title: 'Add your allowance to start',
      body: 'Even a small amount every week turns into real money. Type in what you get and see what happens.',
      tone: 'tip',
    });
    return out;
  }

  out.push({
    id: 'yearly',
    emoji: '🤯',
    title: `That's ${fmt(income.perYear)} a year`,
    body: `${fmt(income.perWeek)} a week doesn't sound like much, but over a year it adds up to ${fmt(income.perYear)}. That is a real pile of money.`,
    tone: 'wow',
  });

  const candyPrice = ctx.candyPrice ?? HABIT_CATALOG.find((h) => h.id === 'candy')?.price ?? 1.75;
  if (candyPrice > 0) {
    const bars = equivalentUnits(income.perYear, candyPrice).toLocaleString();
    out.push({
      id: 'candy',
      emoji: '🍫',
      title: `${bars} candy bars`,
      body: `Your yearly allowance is worth ${bars} candy bars. Or one really big thing. Your choice.`,
      tone: 'wow',
    });
  }

  const tenYears = compoundGrowth({ monthlyContribution: income.perMonth * rate, annualRatePct: growth, years: 10, startingBalance });
  out.push({
    id: 'ten-years',
    emoji: '🚀',
    title: `${fmt(tenYears.finalBalance)} in ten years`,
    body: `Save ${Math.round(rate * 100)}% and let it grow at ${growth}% a year, and in ten years you would have ${fmt(tenYears.finalBalance)}. ${fmt(tenYears.totalGrowth)} of that is money your money made for you.`,
    tone: 'wow',
  });

  if (ctx.age !== undefined && ctx.age < 18) {
    const years = 18 - ctx.age;
    const to18 = compoundGrowth({ monthlyContribution: income.perMonth * rate, annualRatePct: growth, years, startingBalance });
    out.push({
      id: 'age-18',
      emoji: '🎓',
      title: `${fmt(to18.finalBalance)} by the time you are 18`,
      body: `Keep saving ${Math.round(rate * 100)}% of your allowance until you turn 18 and you could start adult life with ${fmt(to18.finalBalance)}.`,
      tone: 'win',
    });
  }

  if (ctx.goal) {
    const timing = weeksToGoal(ctx.goal.price, income.perWeek * rate);
    const allIn = weeksToGoal(ctx.goal.price, income.perWeek);
    out.push({
      id: 'goal',
      emoji: '🎯',
      title: `${ctx.goal.name} in ${describeWeeks(timing.weeks)}`,
      body: timing.affordableNow
        ? `You can already afford ${ctx.goal.name}. Nice.`
        : `Saving ${Math.round(rate * 100)}% gets you ${ctx.goal.name} in ${describeWeeks(timing.weeks)}. Save everything and it is ${describeWeeks(allIn.weeks)}.`,
      tone: 'tip',
    });
  }

  const habit = ctx.habit ?? { name: 'a snack', price: 2.5, timesPerWeek: 5 };
  const skip = skipHabit({ costPerItem: habit.price, timesPerWeek: habit.timesPerWeek, years: 1, annualRatePct: growth });
  const shareOfIncome = income.perYear > 0 ? skip.yearlyCost / income.perYear : 0;
  out.push({
    id: 'habit',
    emoji: '🧋',
    title: `${habit.name} costs ${fmt(skip.yearlyCost)} a year`,
    body:
      shareOfIncome >= 1
        ? `${habit.timesPerWeek}x a week at ${fmt(habit.price)} is ${fmt(skip.yearlyCost)} a year, which is more than your whole allowance.`
        : `${habit.timesPerWeek}x a week at ${fmt(habit.price)} is ${fmt(skip.yearlyCost)} a year, ${Math.round(shareOfIncome * 100)}% of your allowance. Skip half of them and keep ${fmt(skip.yearlyCost / 2)}.`,
    tone: shareOfIncome >= 0.5 ? 'warning' : 'tip',
  });

  // Each observation below stands on its own, so skipping treats still says
  // something useful even when no transactions have been logged yet.
  const log = ctx.logged;
  if (log) {
    // Observations from what actually happened beat generic advice.
    if (log.topCategory && log.spentThisMonth > 0) {
      const share = Math.round((log.topCategory.amount / log.spentThisMonth) * 100);
      out.push({
        id: 'top-category',
        emoji: '🔎',
        title: `Most of your money went on ${log.topCategory.name}`,
        body: `You logged ${fmt(log.topCategory.amount)} on ${log.topCategory.name}, about ${share}% of everything you spent. Nothing wrong with that, as long as it was your choice.`,
        tone: share >= 60 ? 'warning' : 'tip',
      });
    }
    if (log.receivedThisMonth > 0) {
      const kept = log.receivedThisMonth - log.spentThisMonth;
      const keptShare = Math.round((kept / log.receivedThisMonth) * 100);
      out.push({
        id: 'kept',
        emoji: keptShare >= 50 ? '🏅' : keptShare >= 20 ? '👍' : '💸',
        title: keptShare >= 0 ? `You kept ${keptShare}% of what came in` : 'You spent more than came in',
        body:
          keptShare >= 50
            ? `You brought in ${fmt(log.receivedThisMonth)} and still have ${fmt(kept)} of it. That is a seriously good habit.`
            : keptShare >= 0
              ? `You brought in ${fmt(log.receivedThisMonth)} and kept ${fmt(kept)}. Try to push that a little higher next month.`
              : `You spent ${fmt(log.spentThisMonth)} but only ${fmt(log.receivedThisMonth)} came in. The difference came out of money you already had.`,
        tone: keptShare >= 50 ? 'win' : keptShare >= 0 ? 'tip' : 'warning',
      });
    }
    if (log.savingStreakWeeks >= 2) {
      out.push({
        id: 'streak',
        emoji: '🔥',
        title: `${log.savingStreakWeeks} weeks in a row`,
        body: `You have put money away ${log.savingStreakWeeks} weeks running. Streaks are how habits are built. Do not break the chain.`,
        tone: 'win',
      });
    }
    if (log.skippedTotal > 0) {
      out.push({
        id: 'skips',
        emoji: '🙅',
        title: `${fmt(log.skippedTotal)} not spent`,
        body:
          log.pendingSkipTotal > 0
            ? `Skipping treats has saved you ${fmt(log.skippedTotal)} so far, and ${fmt(log.pendingSkipTotal)} of that is still waiting to be moved into your Save jar. Money you skip only counts once you actually put it away.`
            : `Skipping treats has saved you ${fmt(log.skippedTotal)}, and you moved all of it into savings. That is exactly how it works.`,
        tone: log.pendingSkipTotal > 0 ? 'tip' : 'win',
      });
    }
  }

  out.push({
    id: 'rule',
    emoji: '🫙',
    title: 'Try the four jars',
    body: 'Split every allowance into Save, Spend, Share, and Grow the day you get it. Money you never see in your pocket is money you never miss.',
    tone: 'tip',
  });

  return out;
}
