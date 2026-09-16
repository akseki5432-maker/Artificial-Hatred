import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db.js';
import { PriceSearchError, PriceSearchService } from '../src/services/priceSearch/index.js';
import type { PriceProvider, ProviderResult } from '../src/services/priceSearch/types.js';

function provider(name: string, configured: boolean, impl: () => Promise<ProviderResult>): PriceProvider & { calls: number } {
  const p = {
    name,
    calls: 0,
    isConfigured: () => configured,
    async search() {
      p.calls++;
      return impl();
    },
  };
  return p;
}

const found = (provider: string, values: number[]): ProviderResult => ({
  provider,
  prices: values.map((v) => ({ value: v, currency: 'USD', raw: `$${v}` })),
  sources: values.map((v) => ({ title: `src ${v}`, price: v, currency: 'USD' })),
});

describe('PriceSearchService', () => {
  it('uses the first configured provider that finds a price', async () => {
    const a = provider('a', false, async () => found('a', [1]));
    const b = provider('b', true, async () => {
      throw new Error('boom');
    });
    const c = provider('c', true, async () => found('c', [10, 12, 11]));
    const svc = new PriceSearchService([a, b, c], null, 0);
    const r = await svc.search('thing');
    expect(r.provider).toBe('c');
    expect(r.summary.median).toBe(11);
    expect(a.calls).toBe(0);
    expect(b.calls).toBe(1);
  });

  it('reports when nothing is configured', async () => {
    const svc = new PriceSearchService([provider('a', false, async () => found('a', [1]))], null, 0);
    await expect(svc.search('thing')).rejects.toBeInstanceOf(PriceSearchError);
    await expect(svc.search('thing')).rejects.toMatchObject({ status: 503 });
  });

  it('reports when every provider fails', async () => {
    const svc = new PriceSearchService([provider('a', true, async () => found('a', []))], null, 0);
    await expect(svc.search('thing')).rejects.toMatchObject({ status: 502 });
  });

  it('caches results in sqlite', async () => {
    const db = openDb(':memory:');
    const p = provider('a', true, async () => found('a', [5]));
    const svc = new PriceSearchService([p], db, 24);
    const first = await svc.search('Thing');
    const second = await svc.search('thing ');
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(p.calls).toBe(1);
    const fresh = await svc.search('thing', {}, { skipCache: true });
    expect(fresh.fromCache).toBe(false);
    expect(p.calls).toBe(2);
  });
});
