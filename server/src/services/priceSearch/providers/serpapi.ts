import { extractPrices, type ParsedPrice } from '@pocketpilot/core';
import type { FetchLike, PriceProvider, PriceSource, ProviderResult, SearchOptions } from '../types.js';

interface ShoppingResult {
  title?: string;
  link?: string;
  product_link?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
}

interface SerpApiResponse {
  shopping_results?: ShoppingResult[];
  error?: string;
}

/** Google Shopping via SerpApi. Structured prices, most reliable when a key is set. */
export class SerpApiProvider implements PriceProvider {
  readonly name = 'serpapi';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, options: SearchOptions): Promise<ProviderResult> {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      api_key: this.apiKey ?? '',
      gl: options.country ?? 'us',
      hl: 'en',
      num: '20',
    });
    const res = await this.fetchImpl(`https://serpapi.com/search.json?${params}`, { signal: options.signal ?? null });
    if (!res.ok) throw new Error(`serpapi responded ${res.status}`);
    const data = (await res.json()) as SerpApiResponse;
    if (data.error) throw new Error(`serpapi: ${data.error}`);
    return parseSerpApi(data, options.currency);
  }
}

export function parseSerpApi(data: SerpApiResponse, currencyHint?: string): ProviderResult {
  const prices: ParsedPrice[] = [];
  const sources: PriceSource[] = [];
  for (const r of data.shopping_results ?? []) {
    const fromText = r.price ? extractPrices(r.price) : [];
    const first = fromText[0];
    const value = typeof r.extracted_price === 'number' ? r.extracted_price : first?.value;
    if (!value || value <= 0) continue;
    const currency = first?.currency ?? currencyHint ?? 'USD';
    prices.push({ value, currency, raw: r.price ?? String(value) });
    sources.push({ title: r.title ?? r.source ?? 'Shopping result', url: r.product_link ?? r.link, price: value, currency, snippet: r.source });
  }
  return { provider: 'serpapi', prices, sources };
}
