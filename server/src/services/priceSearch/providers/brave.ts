import { extractPrices, type ParsedPrice } from '@pocketpilot/core';
import type { FetchLike, PriceProvider, PriceSource, ProviderResult, SearchOptions } from '../types.js';

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

/** Brave Search API: general web results, prices parsed from titles and snippets. */
export class BraveProvider implements PriceProvider {
  readonly name = 'brave';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, options: SearchOptions): Promise<ProviderResult> {
    const params = new URLSearchParams({
      q: `${query} price`,
      count: '20',
      country: (options.country ?? 'us').toUpperCase(),
      search_lang: 'en',
      extra_snippets: 'true',
    });
    const res = await this.fetchImpl(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': this.apiKey ?? '' },
      signal: options.signal ?? null,
    });
    if (!res.ok) throw new Error(`brave responded ${res.status}`);
    const data = (await res.json()) as BraveResponse;
    return parseBrave(data);
  }
}

export function parseBrave(data: BraveResponse): ProviderResult {
  const prices: ParsedPrice[] = [];
  const sources: PriceSource[] = [];
  for (const r of data.web?.results ?? []) {
    const text = [r.title, r.description, ...(r.extra_snippets ?? [])].filter(Boolean).join(' ');
    const found = extractPrices(text);
    if (found.length === 0) continue;
    prices.push(...found);
    const first = found[0];
    sources.push({ title: r.title ?? r.url ?? 'Web result', url: r.url, snippet: r.description, price: first?.value, currency: first?.currency });
  }
  return { provider: 'brave', prices, sources };
}
