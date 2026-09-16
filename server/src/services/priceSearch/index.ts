import { summarizePrices, type PriceSummary } from '@pocketpilot/core';
import type { Db } from '../../db.js';
import type { PriceProvider, PriceSource, ProviderResult, SearchOptions } from './types.js';

export interface PriceSearchResult {
  query: string;
  provider: string;
  summary: PriceSummary;
  sources: PriceSource[];
  fetchedAt: string;
  fromCache: boolean;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
}

export class PriceSearchService {
  constructor(
    private readonly providers: PriceProvider[],
    private readonly db: Db | null,
    private readonly cacheHours: number,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  providerStatus(): ProviderStatus[] {
    return this.providers.map((p) => ({ name: p.name, configured: p.isConfigured() }));
  }

  get hasAnyProvider(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  /** Run configured providers in order and return the first that yields a price. */
  async search(query: string, options: SearchOptions = {}, { skipCache = false } = {}): Promise<PriceSearchResult> {
    const q = query.trim();
    if (!q) throw new PriceSearchError('Search query is empty', 400);
    const cacheKey = `${q.toLowerCase()}|${options.currency ?? ''}|${options.country ?? ''}`;
    if (!skipCache) {
      const cached = this.readCache(cacheKey);
      if (cached) return { ...cached, fromCache: true };
    }
    const errors: string[] = [];
    let tried = 0;
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      tried++;
      let result: ProviderResult;
      try {
        result = await provider.search(q, options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
        this.log(`price search via ${provider.name} failed: ${msg}`);
        continue;
      }
      const summary = summarizePrices(result.prices, options.currency);
      if (!summary) {
        errors.push(`${provider.name}: no prices found`);
        continue;
      }
      const out: PriceSearchResult = {
        query: q,
        provider: provider.name,
        summary,
        sources: result.sources.slice(0, 10),
        fetchedAt: new Date().toISOString(),
        fromCache: false,
      };
      this.writeCache(cacheKey, out);
      return out;
    }
    if (tried === 0) {
      throw new PriceSearchError(
        'No online price provider is configured. Add SERPAPI_KEY or BRAVE_SEARCH_API_KEY to .env, or enable the DuckDuckGo fallback.',
        503,
      );
    }
    throw new PriceSearchError(`Could not find a price online (${errors.join('; ')}). You can type the price in yourself.`, 502);
  }

  private readCache(key: string): PriceSearchResult | null {
    if (!this.db || this.cacheHours <= 0) return null;
    const row = this.db.prepare('SELECT result_json, fetched_at FROM price_cache WHERE cache_key = ?').get(key) as
      | { result_json: string; fetched_at: string }
      | undefined;
    if (!row) return null;
    const ageMs = Date.now() - Date.parse(row.fetched_at);
    if (!Number.isFinite(ageMs) || ageMs > this.cacheHours * 3600 * 1000) return null;
    try {
      return JSON.parse(row.result_json) as PriceSearchResult;
    } catch {
      return null;
    }
  }

  private writeCache(key: string, result: PriceSearchResult): void {
    if (!this.db) return;
    this.db
      .prepare('INSERT OR REPLACE INTO price_cache (cache_key, result_json, fetched_at) VALUES (?, ?, ?)')
      .run(key, JSON.stringify(result), result.fetchedAt);
  }
}

export class PriceSearchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PriceSearchError';
  }
}
