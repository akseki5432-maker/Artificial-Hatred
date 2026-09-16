import { describe, expect, it } from 'vitest';
import {
  compoundGrowth,
  goalPlans,
  normalizeSplit,
  opportunityCost,
  projectBalance,
  skipHabit,
  splitPlan,
  weeksToGoal,
} from '../src/projections.js';

describe('projectBalance', () => {
  it('adds contributions with no growth', () => {
    const pts = projectBalance({ monthlyIncome: 100, savingsRate: 0.5, months: 12 });
    expect(pts).toHaveLength(13);
    expect(pts[12]?.balance).toBe(600);
    expect(pts[12]?.growth).toBe(0);
  });

  it('compounds monthly', () => {
    const pts = projectBalance({ monthlyIncome: 100, savingsRate: 1, months: 12, annualRatePct: 12 });
    // 100 a month at 1%/month: FV = 100 * ((1.01^12 - 1) / 0.01) = 1268.25
    expect(pts[12]?.balance).toBeCloseTo(1268.25, 2);
    expect(pts[12]?.contributed).toBe(1200);
  });

  it('respects a starting balance', () => {
    const pts = projectBalance({ monthlyIncome: 0, savingsRate: 1, months: 12, annualRatePct: 12, startingBalance: 1000 });
    expect(pts[12]?.balance).toBeCloseTo(1000 * 1.01 ** 12, 6);
  });
});

describe('compoundGrowth', () => {
  it('reports yearly points with age', () => {
    const r = compoundGrowth({ monthlyContribution: 50, annualRatePct: 7, years: 10, startAge: 8 });
    expect(r.points).toHaveLength(11);
    expect(r.points[0]?.age).toBe(8);
    expect(r.points[10]?.age).toBe(18);
    expect(r.totalContributed).toBe(6000);
    expect(r.finalBalance).toBeGreaterThan(8000);
    expect(r.finalBalance).toBeLessThan(9000);
    expect(r.totalGrowth).toBeCloseTo(r.finalBalance - 6000, 6);
  });
});

describe('weeksToGoal', () => {
  it('computes weeks', () => {
    const t = weeksToGoal(100, 10);
    expect(t.weeks).toBe(10);
    expect(t.affordableNow).toBe(false);
  });
  it('handles already affordable and impossible', () => {
    expect(weeksToGoal(100, 10, 150).affordableNow).toBe(true);
    expect(weeksToGoal(100, 0).weeks).toBe(Infinity);
  });
  it('compares savings rates', () => {
    const plans = goalPlans(100, 20);
    expect(plans.map((p) => p.timing.weeks)).toEqual([20, 10, 100 / 15, 5]);
  });
});

describe('skipHabit', () => {
  it('shows what a snack habit costs', () => {
    const r = skipHabit({ costPerItem: 2, timesPerWeek: 5, years: 1 });
    expect(r.weeklyCost).toBe(10);
    expect(r.yearlyCost).toBe(520);
    expect(r.totalSpent).toBe(520);
    expect(r.itemsSkipped).toBe(260);
    expect(r.investedValue).toBeCloseTo(520, 6);
  });
  it('grows the skipped money', () => {
    const r = skipHabit({ costPerItem: 2, timesPerWeek: 5, years: 5, annualRatePct: 7 });
    expect(r.investedValue).toBeGreaterThan(r.totalSpent);
    expect(r.growthBonus).toBeCloseTo(r.investedValue - r.totalSpent, 6);
  });
});

describe('split', () => {
  it('normalizes to 100 with save absorbing the difference', () => {
    expect(normalizeSplit({ save: 10, spend: 30, share: 10, invest: 10 })).toEqual({ save: 50, spend: 30, share: 10, invest: 10 });
  });
  it('scales down when the others exceed 100', () => {
    const s = normalizeSplit({ save: 0, spend: 100, share: 50, invest: 50 });
    expect(s.save).toBe(0);
    expect(s.spend + s.share + s.invest).toBeCloseTo(100, 6);
  });
  it('splits amounts', () => {
    const a = splitPlan(200, { save: 50, spend: 30, share: 10, invest: 10 });
    expect(a).toEqual({ total: 200, save: 100, spend: 60, share: 20, invest: 20 });
  });
});

describe('opportunityCost', () => {
  it('grows a price', () => {
    expect(opportunityCost(100, 10, 2)).toBeCloseTo(121, 6);
  });
});
