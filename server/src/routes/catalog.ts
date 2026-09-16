import { Router } from 'express';
import { z } from 'zod';
import { CATALOG_LAST_REVIEWED, CATEGORY_LABELS, EARN_IDEAS, GOAL_CATALOG, HABIT_CATALOG, earnIdeasForAge, findCatalogItem, findHabit } from '@pocketpilot/core';
import { HttpError } from '../app.js';
import type { Repo } from '../repo.js';
import type { PriceSearchService } from '../services/priceSearch/index.js';
import type { FxService } from '../services/fx.js';

const KEY = /^(goal|habit|custom):[a-z0-9-]{1,60}$/;

/**
 * Pause between lookups during a full refresh, so a provider is not hit ~45
 * times in a burst. Tests run with no delay so the suite stays fast.
 */
const REFRESH_DELAY_MS = Number(process.env.PRICE_REFRESH_DELAY_MS ?? (process.env.NODE_ENV === 'test' ? 0 : 400));

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

export function catalogRouter(repo: Repo, priceSearch: PriceSearchService, fx: FxService) {
  const r = Router();
  let refreshing = false;

  r.get('/catalog', async (req, res) => {
    const currency = typeof req.query.currency === 'string' && req.query.currency.length === 3 ? req.query.currency.toUpperCase() : undefined;
    const rates = currency ? await fx.getTable() : undefined;
    res.json({ ...repo.catalogWithPrices(currency, rates), categories: CATEGORY_LABELS, catalogReviewed: CATALOG_LAST_REVIEWED });
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
    // If the web answered in another currency, also say what that is in the one asked for.
    let converted: { price: number; currency: string; low: number; high: number } | null = null;
    if (input.currency && result.summary.currency !== input.currency) {
      try {
        converted = {
          currency: input.currency,
          price: await fx.convert(result.summary.median, result.summary.currency, input.currency),
          low: await fx.convert(result.summary.low, result.summary.currency, input.currency),
          high: await fx.convert(result.summary.high, result.summary.currency, input.currency),
        };
      } catch {
        converted = null;
      }
    }
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
    res.json({ ...result, converted, saved });
  });

  /** Refresh every catalog item that has a search query. Runs sequentially to be polite to providers. */
  r.post('/prices/refresh', async (req, res) => {
    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : undefined;
    const country = typeof req.body?.country === 'string' ? req.body.country.toLowerCase() : undefined;
    if (!priceSearch.hasAnyProvider) throw new HttpError(503, 'No online price provider is configured.');
    if (refreshing) throw new HttpError(409, 'A refresh is already running. Give it a minute.');
    refreshing = true;
    const items: { key: string; name: string; query: string; currency: string }[] = [
      ...GOAL_CATALOG.filter((g) => g.searchQuery).map((g) => ({ key: `goal:${g.id}`, name: g.name, query: g.searchQuery as string, currency: g.currency })),
      ...HABIT_CATALOG.filter((h) => h.searchQuery).map((h) => ({ key: `habit:${h.id}`, name: h.name, query: h.searchQuery as string, currency: h.currency })),
    ];
    const updated: { key: string; price: number; currency: string; provider: string }[] = [];
    const failed: { key: string; error: string }[] = [];
    try {
    let index = 0;
    for (const item of items) {
      // Space the requests out so a real provider is not hit ~45 times in a burst.
      if (index++ > 0 && REFRESH_DELAY_MS > 0) await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));
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
    } finally {
      refreshing = false;
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
