import { MONTHS_PER_YEAR, WEEKS_PER_YEAR } from './money.js';

/** One row of a savings projection. */
export interface BalancePoint {
  /** Months from today (0 = today). */
  month: number;
  /** Money you put in yourself so far. */
  contributed: number;
  /** Interest / growth earned so far. */
  growth: number;
  /** contributed + growth + starting balance. */
  balance: number;
}

export interface ProjectBalanceInput {
  /** Money coming in each month (allowance + chores). */
  monthlyIncome: number;
  /** Fraction of income that is saved, 0..1. */
  savingsRate: number;
  months: number;
  /** Annual growth in percent (e.g. 5 = 5% a year). 0 for a plain piggy bank. */
  annualRatePct?: number;
  startingBalance?: number;
}

/**
 * Month-by-month balance when saving `savingsRate` of income.
 * Growth compounds monthly, applied to the balance at the start of each month.
 */
export function projectBalance(input: ProjectBalanceInput): BalancePoint[] {
  const { monthlyIncome, savingsRate, months, annualRatePct = 0, startingBalance = 0 } = input;
  const monthly = Math.max(0, monthlyIncome) * clamp01(savingsRate);
  const r = Math.max(0, annualRatePct) / 100 / MONTHS_PER_YEAR;
  const points: BalancePoint[] = [];
  let balance = Math.max(0, startingBalance);
  let contributed = 0;
  let growth = 0;
  points.push({ month: 0, contributed, growth, balance });
  for (let m = 1; m <= Math.max(0, Math.floor(months)); m++) {
    const earned = balance * r;
    growth += earned;
    balance += earned + monthly;
    contributed += monthly;
    points.push({ month: m, contributed, growth, balance });
  }
  return points;
}

export interface YearPoint {
  year: number;
  age?: number;
  contributed: number;
  growth: number;
  balance: number;
}

export interface CompoundGrowthInput {
  monthlyContribution: number;
  annualRatePct: number;
  years: number;
  startingBalance?: number;
  /** If given, each point also carries the child's age that year. */
  startAge?: number;
}

export interface CompoundGrowthResult {
  points: YearPoint[];
  totalContributed: number;
  totalGrowth: number;
  finalBalance: number;
}

/** Year-end snapshots of a monthly contribution compounding at `annualRatePct`. */
export function compoundGrowth(input: CompoundGrowthInput): CompoundGrowthResult {
  const { monthlyContribution, annualRatePct, years, startingBalance = 0, startAge } = input;
  const monthly = projectBalance({
    monthlyIncome: monthlyContribution,
    savingsRate: 1,
    months: Math.max(0, Math.round(years * MONTHS_PER_YEAR)),
    annualRatePct,
    startingBalance,
  });
  const points: YearPoint[] = [];
  for (let y = 0; y <= years; y++) {
    const p = monthly[Math.min(monthly.length - 1, y * MONTHS_PER_YEAR)];
    if (!p) continue;
    points.push({
      year: y,
      ...(startAge !== undefined ? { age: startAge + y } : {}),
      contributed: p.contributed,
      growth: p.growth,
      balance: p.balance,
    });
  }
  const last = points[points.length - 1] ?? { contributed: 0, growth: 0, balance: startingBalance };
  return {
    points,
    totalContributed: last.contributed,
    totalGrowth: last.growth,
    finalBalance: last.balance,
  };
}

export interface GoalTiming {
  /** Weeks until the goal is affordable. Infinity if never. */
  weeks: number;
  /** Same as weeks but in months (52/12 weeks per month). */
  months: number;
  /** How much still needs to be saved. */
  remaining: number;
  affordableNow: boolean;
}

/** How long until `price` is reached, saving `weeklySaving` every week. */
export function weeksToGoal(price: number, weeklySaving: number, startingBalance = 0): GoalTiming {
  const remaining = Math.max(0, price - Math.max(0, startingBalance));
  if (remaining <= 0) return { weeks: 0, months: 0, remaining: 0, affordableNow: true };
  if (weeklySaving <= 0) return { weeks: Infinity, months: Infinity, remaining, affordableNow: false };
  const weeks = remaining / weeklySaving;
  return { weeks, months: weeks / (WEEKS_PER_YEAR / MONTHS_PER_YEAR), remaining, affordableNow: false };
}

export interface GoalPlan {
  /** Fraction of income saved, 0..1. */
  savingsRate: number;
  weeklySaving: number;
  timing: GoalTiming;
}

/** Compare a goal against several savings rates so kids can see the trade-off. */
export function goalPlans(
  price: number,
  weeklyIncome: number,
  startingBalance = 0,
  rates: number[] = [0.25, 0.5, 0.75, 1],
): GoalPlan[] {
  return rates.map((rate) => {
    const weeklySaving = Math.max(0, weeklyIncome) * clamp01(rate);
    return { savingsRate: rate, weeklySaving, timing: weeksToGoal(price, weeklySaving, startingBalance) };
  });
}

export interface SkipHabitInput {
  /** Cost of one purchase (a snack, a soda, a game pack...). */
  costPerItem: number;
  timesPerWeek: number;
  years: number;
  /** Growth if the money is saved/invested instead. 0 = a jar under the bed. */
  annualRatePct?: number;
}

export interface SkipHabitResult {
  itemsSkipped: number;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
  /** Cash spent over the whole period if the habit continues. */
  totalSpent: number;
  /** What that same cash becomes if saved and grown instead. */
  investedValue: number;
  /** investedValue - totalSpent. */
  growthBonus: number;
}

/** The "latte factor" for kids: what a small repeated purchase really costs. */
export function skipHabit(input: SkipHabitInput): SkipHabitResult {
  const { costPerItem, timesPerWeek, years, annualRatePct = 0 } = input;
  const weeklyCost = Math.max(0, costPerItem) * Math.max(0, timesPerWeek);
  const monthlyCost = (weeklyCost * WEEKS_PER_YEAR) / MONTHS_PER_YEAR;
  const yearlyCost = weeklyCost * WEEKS_PER_YEAR;
  const totalSpent = yearlyCost * Math.max(0, years);
  const grown = compoundGrowth({ monthlyContribution: monthlyCost, annualRatePct, years });
  return {
    itemsSkipped: Math.round(Math.max(0, timesPerWeek) * WEEKS_PER_YEAR * Math.max(0, years)),
    weeklyCost,
    monthlyCost,
    yearlyCost,
    totalSpent,
    investedValue: grown.finalBalance,
    growthBonus: grown.finalBalance - totalSpent,
  };
}

/** What a purchase price would be worth later if it were invested instead of spent. */
export function opportunityCost(price: number, annualRatePct: number, years: number): number {
  return Math.max(0, price) * Math.pow(1 + Math.max(0, annualRatePct) / 100, Math.max(0, years));
}

export interface SplitPercentages {
  save: number;
  spend: number;
  share: number;
  invest: number;
}

export interface SplitAmounts extends SplitPercentages {
  total: number;
}

/** Ensure the four buckets add up to 100. Extra or missing points go to "save". */
export function normalizeSplit(split: Partial<SplitPercentages>): SplitPercentages {
  const clean = (v: number | undefined) => Math.max(0, Math.min(100, Number.isFinite(v as number) ? (v as number) : 0));
  const spend = clean(split.spend);
  const share = clean(split.share);
  const invest = clean(split.invest);
  let save = clean(split.save);
  const sum = save + spend + share + invest;
  if (sum !== 100) {
    save = Math.max(0, 100 - (spend + share + invest));
    const sum2 = save + spend + share + invest;
    if (sum2 > 100) {
      // Scale the other buckets down proportionally when they alone exceed 100.
      const factor = 100 / (spend + share + invest);
      return { save: 0, spend: spend * factor, share: share * factor, invest: invest * factor };
    }
  }
  return { save, spend, share, invest };
}

/** Split a monthly amount into the four jars. */
export function splitPlan(monthlyIncome: number, split: Partial<SplitPercentages>): SplitAmounts {
  const pct = normalizeSplit(split);
  const total = Math.max(0, monthlyIncome);
  return {
    total,
    save: (total * pct.save) / 100,
    spend: (total * pct.spend) / 100,
    share: (total * pct.share) / 100,
    invest: (total * pct.invest) / 100,
  };
}

/** "Your yearly allowance is 240 candy bars" - amount expressed in units of a cheap item. */
export function equivalentUnits(amount: number, unitPrice: number): number {
  if (unitPrice <= 0) return 0;
  return Math.floor(Math.max(0, amount) / unitPrice);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
