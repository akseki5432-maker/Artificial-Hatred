import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db.js';
import { FxService } from '../src/services/fx.js';
import type { FetchLike } from '../src/services/priceSearch/types.js';

function feed(rates: Record<string, number> | null, status = 200): { fetch: FetchLike; calls: number } {
  const state = { calls: 0 } as { fetch: FetchLike; calls: number };
  state.fetch = async () => {
    state.calls++;
    return new Response(rates ? JSON.stringify({ base: 'USD', date: '2026-09-10', rates }) : 'nope', { status, headers: { 'content-type': 'application/json' } });
  };
  return state;
}

describe('FxService', () => {
  it('uses live rates and caches them in sqlite', async () => {
    const db = openDb(':memory:');
    const fetchImpl = feed({ EUR: 0.5, GBP: 0.25 });
    const fx = new FxService(db, fetchImpl.fetch, 24);
    expect(await fx.convert(10, 'USD', 'EUR')).toBe(5);
    expect(await fx.convert(10, 'USD', 'GBP')).toBe(2.5);
    // Currencies the feed lacks fall back to the static table.
    expect(await fx.convert(1, 'USD', 'JPY')).toBe(150);
    expect((await fx.status()).source).toBe('live');
    expect(fetchImpl.calls).toBe(1);
    // A fresh service instance reads the sqlite cache instead of fetching.
    const fx2 = new FxService(db, fetchImpl.fetch, 24);
    expect(await fx2.convert(10, 'USD', 'EUR')).toBe(5);
    expect(fetchImpl.calls).toBe(1);
  });

  it('falls back to static rates when the feed fails, without hammering it', async () => {
    const fetchImpl = feed(null, 500);
    const fx = new FxService(null, fetchImpl.fetch, 24);
    expect(await fx.convert(1, 'USD', 'EUR')).toBe(0.92);
    expect(await fx.convert(1, 'USD', 'EUR')).toBe(0.92);
    expect((await fx.status()).source).toBe('static');
    expect(fetchImpl.calls).toBe(1);
  });

  it('never fetches when disabled', async () => {
    const fetchImpl = feed({ EUR: 0.5 });
    const fx = new FxService(null, fetchImpl.fetch, 24, false);
    expect(await fx.convert(1, 'USD', 'EUR')).toBe(0.92);
    expect(fetchImpl.calls).toBe(0);
  });
});
