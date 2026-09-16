import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_LABELS, EARN_IDEAS, GOAL_CATALOG, HABIT_CATALOG, earnIdeasForAge, findCatalogItem, findHabit } from '@pocketpilot/core';
import { HttpError } from '../app.js';
import type { Repo } from '../repo.js';
import type { PriceSearchService } from '../services/priceSearch/index.js';

const KEY = /^(goal|habit|custom):[a-z0-9-]{1,60}$/;

const searchInput = z.object({
  query: z.string().trim().min(2).max(200),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  country: z.string().trim().length(2).toLowerCase().optional(),
  /** When set, the found median price is stored as the price for this catalog key. */
  applyToKey: z.string().regex(KEY).optional(),
  /** Bypass the cache and hit the provider again. */
  fresh: z.boolean().optional(),
});

const priceInput = z.object({
  price: z.number().min(0).max(10_000_000),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

export function catalogRouter(repo: Repo, priceSearch: PriceSearchService) {
  const r = Router();

  r.get('/catalog', (_req, res) => {
    res.json({ ...repo.catalogWithPrices(), categories: CATEGORY_LABELS });
  });

  r.get('/earn', (req, res) => {
    const age = Number(req.query.age);
    res.json(Number.isFinite(age) ? earnIdeasForAge(age) : EARN_IDEAS);
  });

  r.get('/prices', (_req, res) => {
    res.json({ providers: priceSearch.providerStatus(), overrides: repo.listPrices() });
  });

  r.get('/prices/:key/history', (req, res) => {
    const key = String(req.params.key);
    if (!KEY.test(key)) throw new HttpError(400, 'Invalid price key');
    res.json(repo.priceHistory(key));
  });

  /** Manually change a price ("the store near us charges more"). */
  r.put('/prices/:key', (req, res) => {
    const key = String(req.params.key);
    if (!KEY.test(key)) throw new HttpError(400, 'Invalid price key');
    const input = priceInput.parse(req.body);
    const base = baseItem(key);
    const name = input.name ?? base?.name;
    if (!name) throw new HttpError(400, 'Custom prices need a name');
    res.json(
      repo.setPrice({
        key,
        name,
        price: input.price,
        currency: input.currency ?? base?.currency ?? 'USD',
        source: 'manual',
        query: base?.searchQuery ?? null,
        note: input.note ?? null,
      }),
    );
  });

  /** Forget a manual/online price and go back to the catalog value. */
  r.delete('/prices/:key', (req, res) => {
    const key = String(req.params.key);
    if (!KEY.test(key)) throw new HttpError(400, 'Invalid price key');
    repo.resetPrice(key);
    res.status(204).end();
  });

  /** Search the web for a price, optionally saving it. */
  r.post('/prices/search', async (req, res) => {
    const input = searchInput.parse(req.body);
    const result = await priceSearch.search(input.query, { currency: input.currency, country: input.country }, { skipCache: input.fresh ?? false });
    let saved = null;
    if (input.applyToKey) {
      const base = baseItem(input.applyToKey);
      saved = repo.setPrice({
        key: input.applyToKey,
        name: base?.name ?? input.query,
        price: result.summary.median,
        currency: result.summary.currency,
        source: `online:${result.provider}`,
        query: input.query,
        note: `Found ${result.summary.count} prices from ${result.summary.low} to ${result.summary.high}`,
      });
    }
    res.json({ ...result, saved });
  });

  /** Refresh every catalog item that has a search query. Runs sequentially to be polite to providers. */
  r.post('/prices/refresh', async (req, res) => {
    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : undefined;
    const country = typeof req.body?.country === 'string' ? req.body.country.toLowerCase() : undefined;
    if (!priceSearch.hasAnyProvider) throw new HttpError(503, 'No online price provider is configured.');
    const items: { key: string; name: string; query: string; currency: string }[] = [
      ...GOAL_CATALOG.filter((g) => g.searchQuery).map((g) => ({ key: `goal:${g.id}`, name: g.name, query: g.searchQuery as string, currency: g.currency })),
      ...HABIT_CATALOG.filter((h) => h.searchQuery).map((h) => ({ key: `habit:${h.id}`, name: h.name, query: h.searchQuery as string, currency: h.currency })),
    ];
    const updated: { key: string; price: number; currency: string; provider: string }[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const item of items) {
      try {
        const result = await priceSearch.search(item.query, { currency: currency ?? item.currency, country });
        repo.setPrice({
          key: item.key,
          name: item.name,
          price: result.summary.median,
          currency: result.summary.currency,
          source: `online:${result.provider}`,
          query: item.query,
          note: `Found ${result.summary.count} prices from ${result.summary.low} to ${result.summary.high}`,
        });
        updated.push({ key: item.key, price: result.summary.median, currency: result.summary.currency, provider: result.provider });
      } catch (err) {
        failed.push({ key: item.key, error: err instanceof Error ? err.message : String(err) });
      }
    }
    res.json({ updated, failed });
  });

  return r;
}

function baseItem(key: string): { name: string; currency: string; searchQuery?: string } | undefined {
  const [kind, id] = key.split(':') as [string, string];
  if (kind === 'goal') return findCatalogItem(id);
  if (kind === 'habit') return findHabit(id);
  return undefined;
}
