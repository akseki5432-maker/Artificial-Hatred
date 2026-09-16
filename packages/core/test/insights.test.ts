import { describe, expect, it } from 'vitest';
import { buildInsights } from '../src/insights.js';
import { normalize } from '../src/money.js';

const income = normalize({ amount: 10, cadence: 'weekly' });

describe('buildInsights', () => {
  it('asks for an allowance when there is none', () => {
    const out = buildInsights({ income: normalize({ amount: 0, cadence: 'weekly' }) });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('no-income');
  });

  it('covers the basics without a log', () => {
    const ids = buildInsights({ income, age: 10 }).map((i) => i.id);
    expect(ids).toContain('yearly');
    expect(ids).toContain('candy');
    expect(ids).toContain('ten-years');
    expect(ids).toContain('age-18');
    expect(ids).not.toContain('kept');
  });

  it('uses the money log when there is one', () => {
    const out = buildInsights({
      income,
      logged: { entries: 6, spentThisMonth: 20, receivedThisMonth: 40, topCategory: { name: 'snacks', amount: 15 }, savingStreakWeeks: 3, skippedTotal: 12, pendingSkipTotal: 12 },
    });
    const byId = Object.fromEntries(out.map((i) => [i.id, i]));
    expect(byId.top_category ?? byId['top-category']).toBeDefined();
    expect(byId['top-category']?.title).toContain('snacks');
    expect(byId.kept?.title).toContain('50%');
    expect(byId.kept?.tone).toBe('win');
    expect(byId.streak?.title).toContain('3 weeks');
    expect(byId.skips?.body).toContain('still waiting');
  });

  it('warns when more went out than came in', () => {
    const out = buildInsights({ income, logged: { entries: 3, spentThisMonth: 60, receivedThisMonth: 40, topCategory: { name: 'games', amount: 50 }, savingStreakWeeks: 0, skippedTotal: 0, pendingSkipTotal: 0 } });
    const kept = out.find((i) => i.id === 'kept');
    expect(kept?.tone).toBe('warning');
    expect(kept?.title).toContain('spent more');
    expect(out.find((i) => i.id === 'streak')).toBeUndefined();
    expect(out.find((i) => i.id === 'skips')).toBeUndefined();
  });
});
