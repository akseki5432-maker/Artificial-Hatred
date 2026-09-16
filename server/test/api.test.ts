import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { FxService } from '../src/services/fx.js';
import { PriceSearchService } from '../src/services/priceSearch/index.js';
import type { PriceProvider } from '../src/services/priceSearch/types.js';

let server: Server;
let base = '';

const fakeProvider: PriceProvider = {
  name: 'fake',
  isConfigured: () => true,
  async search(query) {
    if (query.includes('nothing')) return { provider: 'fake', prices: [], sources: [] };
    return {
      provider: 'fake',
      prices: [
        { value: 100, currency: 'USD', raw: '$100' },
        { value: 120, currency: 'USD', raw: '$120' },
        { value: 110, currency: 'USD', raw: '$110' },
      ],
      sources: [{ title: 'Shop', url: 'https://shop.example', price: 110, currency: 'USD' }],
    };
  },
};

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  const db = openDb(':memory:');
  const fx = new FxService(db, async () => new Response(JSON.stringify({ base: 'USD', date: '2026-09-10', rates: { EUR: 0.5 } }), { status: 200 }), 24);
  const app = createApp({ db, priceSearch: new PriceSearchService([fakeProvider], db, 1), fx });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('API', () => {
  let profileId = 0;

  it('creates a profile and computes a plan', async () => {
    const created = await api('POST', '/api/profiles', { name: 'Sam', age: 10, allowanceAmount: 10, allowanceCadence: 'weekly' });
    expect(created.status).toBe(201);
    profileId = created.json.id;
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    expect(plan.status).toBe(200);
    expect(plan.json.normalized.perYear).toBe(520);
    expect(plan.json.untilAdult.years).toBe(8);
    expect(plan.json.insights.length).toBeGreaterThan(3);
    expect(plan.json.split.total).toBeCloseTo(520 / 12, 6);
  });

  it('rejects bad input', async () => {
    const bad = await api('POST', '/api/profiles', { name: '', allowanceCadence: 'fortnightly' });
    expect(bad.status).toBe(400);
    expect(bad.json.issues.length).toBeGreaterThan(0);
    expect((await api('GET', '/api/profiles/abc')).status).toBe(400);
    expect((await api('GET', '/api/profiles/999')).status).toBe(404);
  });

  it('adds extra income', async () => {
    const inc = await api('POST', `/api/profiles/${profileId}/income`, { label: 'Dog walking', amount: 15, cadence: 'weekly' });
    expect(inc.status).toBe(201);
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    expect(plan.json.normalized.perYear).toBe(520 + 780);
  });

  it('adds goals from the catalog and custom', async () => {
    const fromCatalog = await api('POST', `/api/profiles/${profileId}/goals`, { catalogId: 'bike', isFavorite: true });
    expect(fromCatalog.status).toBe(201);
    expect(fromCatalog.json.name).toBe('Bike');
    expect(fromCatalog.json.price).toBe(299);
    const custom = await api('POST', `/api/profiles/${profileId}/goals`, { name: 'Telescope', price: 180, emoji: '🔭' });
    expect(custom.status).toBe(201);
    const missing = await api('POST', `/api/profiles/${profileId}/goals`, { name: 'No price' });
    expect(missing.status).toBe(400);
    const list = await api('GET', `/api/profiles/${profileId}/goals`);
    expect(list.json).toHaveLength(2);
    expect(list.json[0].name).toBe('Bike');
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    expect(plan.json.goals[0].plans).toHaveLength(4);
    expect(plan.json.insights.find((i: { id: string }) => i.id === 'goal').title).toContain('Bike');
    const upd = await api('PUT', `/api/goals/${custom.json.id}`, { savedSoFar: 90 });
    expect(upd.json.savedSoFar).toBe(90);
    expect((await api('DELETE', `/api/goals/${custom.json.id}`)).status).toBe(204);
  });

  it('records the ledger', async () => {
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'in', amount: 10 })).status).toBe(201);
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'out', amount: 3.5, category: 'snacks', note: 'chips' })).status).toBe(201);
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'out', amount: -1 })).status).toBe(400);
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    expect(plan.json.ledgerSummary.spentThisMonth).toBe(3.5);
    expect(plan.json.ledgerSummary.receivedThisMonth).toBe(10);
    expect(plan.json.ledgerSummary.byCategory.snacks).toBe(3.5);
  });

  it('searches online prices, applies them, and keeps history', async () => {
    const search = await api('POST', '/api/prices/search', { query: 'kids mountain bike', applyToKey: 'goal:bike' });
    expect(search.status).toBe(200);
    expect(search.json.summary.median).toBe(110);
    expect(search.json.saved.source).toBe('online:fake');
    const catalog = await api('GET', '/api/catalog');
    const bike = catalog.json.goals.find((g: { id: string }) => g.id === 'bike');
    expect(bike.price).toBe(110);
    expect(bike.source).toBe('online:fake');
    const newGoal = await api('POST', `/api/profiles/${profileId}/goals`, { catalogId: 'bike' });
    expect(newGoal.json.price).toBe(110);

    const manual = await api('PUT', '/api/prices/goal:bike', { price: 250, note: 'The shop on Main St' });
    expect(manual.json.source).toBe('manual');
    const history = await api('GET', '/api/prices/goal:bike/history');
    expect(history.json.map((h: { price: number }) => h.price)).toEqual([250, 110]);

    const none = await api('POST', '/api/prices/search', { query: 'nothing here' });
    expect(none.status).toBe(502);
    expect((await api('PUT', '/api/prices/bad key', { price: 1 })).status).toBe(400);
    expect((await api('DELETE', '/api/prices/goal:bike')).status).toBe(204);
    const reset = await api('GET', '/api/catalog');
    expect(reset.json.goals.find((g: { id: string }) => g.id === 'bike').price).toBe(299);
  });

  it('refreshes the whole catalog', async () => {
    const r = await api('POST', '/api/prices/refresh', {});
    expect(r.status).toBe(200);
    expect(r.json.updated.length).toBeGreaterThan(30);
    expect(r.json.failed).toEqual([]);
  });

  it('converts prices for a kid who uses euros', async () => {
    const eu = await api('POST', '/api/profiles', { name: 'Lena', age: 12, currency: 'EUR', allowanceAmount: 20, allowanceCadence: 'weekly' });
    expect(eu.status).toBe(201);
    const catalog = await api('GET', '/api/catalog?currency=EUR');
    const bike = catalog.json.goals.find((g: { id: string }) => g.id === 'bike');
    expect(catalog.json.currency).toBe('EUR');
    // The refresh test above set every catalog price to the fake provider's $110 median.
    expect(bike.price).toBe(55);
    expect(bike.currency).toBe('EUR');
    expect(bike.originalPrice).toBe(110);
    expect(bike.originalCurrency).toBe('USD');
    const goal = await api('POST', `/api/profiles/${eu.json.id}/goals`, { catalogId: 'bike' });
    expect(goal.json.price).toBe(55);
    expect(goal.json.currency).toBe('EUR');
    const custom = await api('POST', `/api/profiles/${eu.json.id}/goals`, { name: 'Guitar', price: 100 });
    expect(custom.json.currency).toBe('EUR');
    expect(custom.json.price).toBe(100);
    const search = await api('POST', '/api/prices/search', { query: 'guitar', currency: 'EUR' });
    expect(search.json.summary.currency).toBe('USD');
    expect(search.json.converted).toEqual({ currency: 'EUR', price: 55, low: 50, high: 60 });
    const fxStatus = await api('GET', '/api/fx');
    expect(fxStatus.json.source).toBe('live');
    expect(fxStatus.json.currencies).toContain('EUR');
    const plan = await api('GET', `/api/profiles/${eu.json.id}/plan`);
    expect(plan.json.habits[0].currency).toBe('EUR');
  });

  it('plans toward a deadline', async () => {
    const soon = new Date(Date.now() + 10 * 7 * 86400_000).toISOString().slice(0, 10);
    const goal = await api('POST', `/api/profiles/${profileId}/goals`, { name: 'Camp', price: 100, targetDate: soon });
    expect(goal.status).toBe(201);
    expect(goal.json.targetDate).toBe(soon);
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    const camp = plan.json.goals.find((g: { name: string }) => g.name === 'Camp');
    expect(camp.deadline.weeksLeft).toBeGreaterThan(9.9);
    expect(camp.deadline.weeksLeft).toBeLessThanOrEqual(10);
    expect(camp.deadline.neededPerWeek).toBeCloseTo(10, 0);
    expect(camp.deadline.onTrack).toBe(true);
    expect((await api('POST', `/api/profiles/${profileId}/goals`, { name: 'Bad', price: 1, targetDate: 'tomorrow' })).status).toBe(400);
    const cleared = await api('PUT', `/api/goals/${goal.json.id}`, { targetDate: null });
    expect(cleared.json.targetDate).toBeNull();
  });

  it('tracks balance and a saving streak', async () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
    const lastWeek = new Date(Date.now() - 7 * 86400_000).toISOString();
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'out', amount: 2, category: 'saving', at: twoWeeksAgo })).status).toBe(201);
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'out', amount: 2, category: 'saving', at: lastWeek })).status).toBe(201);
    expect((await api('POST', `/api/profiles/${profileId}/ledger`, { kind: 'out', amount: 2, category: 'saving' })).status).toBe(201);
    const plan = await api('GET', `/api/profiles/${profileId}/plan`);
    expect(plan.json.ledgerSummary.savingStreakWeeks).toBe(3);
    expect(plan.json.ledgerSummary.totalIn).toBe(10);
    expect(plan.json.ledgerSummary.totalOut).toBe(3.5 + 6);
    // Saving is a transfer: it sits in the jar rather than counting as spending.
    expect(plan.json.ledgerSummary.inSaveJar).toBe(6);
    expect(plan.json.ledgerSummary.totalSpent).toBe(3.5);
    expect(plan.json.ledgerSummary.balanceNow).toBeCloseTo(10 - 3.5, 6);
    expect(plan.json.ledgerSummary.spentThisMonth).toBe(3.5);
    expect(plan.json.ledgerSummary.savedThisMonth).toBe(6);
    expect(plan.json.ledgerSummary.byCategory.saving).toBeUndefined();
    expect(plan.json.ledgerSummary.byCategory.snacks).toBe(3.5);
    // Older entries are normalized to sqlite's date format, so ordering by date works across sources.
    const list = await api('GET', `/api/profiles/${profileId}/ledger`);
    expect(list.json.every((e: { at: string }) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(e.at))).toBe(true);
    expect(list.json[list.json.length - 1].amount).toBe(2);
  });

  it('logs allowance day and exports csv', async () => {
    const quick = await api('POST', `/api/profiles/${profileId}/ledger/allowance`);
    expect(quick.status).toBe(201);
    expect(quick.json.amount).toBe(10);
    expect(quick.json.category).toBe('allowance');
    const res = await fetch(`${base}/api/profiles/${profileId}/ledger.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('date,kind,amount,currency,category,note');
    expect(text).toContain(',in,10,USD,allowance,Allowance');
    expect(text).toContain(',out,3.5,USD,snacks,chips');
  });

  it('serves earning ideas by age', async () => {
    const r = await api('GET', '/api/earn?age=9');
    expect(r.status).toBe(200);
    expect(r.json.every((i: { minAge: number }) => i.minAge <= 9)).toBe(true);
    expect(r.json[0].weeklyPotential).toBeGreaterThanOrEqual(r.json[1].weeklyPotential);
  });
});
