import { extractPrices, type ParsedPrice } from '@pocketpilot/core';
import type { FetchLike, PriceProvider, PriceSource, ProviderResult, SearchOptions } from '../types.js';

/**
 * Key-free fallback that reads DuckDuckGo's HTML results page. It can be
 * rate-limited or change layout, so it sits last in the chain.
 */
export class DuckDuckGoProvider implements PriceProvider {
  readonly name = 'duckduckgo';

  constructor(
    private readonly enabled: boolean,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return this.enabled;
  }

  async search(query: string, options: SearchOptions): Promise<ProviderResult> {
    const params = new URLSearchParams({ q: `${query} price`, kl: `${options.country ?? 'us'}-en` });
    const res = await this.fetchImpl(`https://html.duckduckgo.com/html/?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: options.signal ?? null,
    });
    if (!res.ok) throw new Error(`duckduckgo responded ${res.status}`);
    return parseDuckDuckGoHtml(await res.text());
  }
}

const RESULT_BLOCK = /<div class="result\b[\s\S]*?(?=<div class="result\b|<div class="nav-link|<\/div>\s*<\/div>\s*<\/div>\s*<\/form>)/g;
const TITLE = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
const SNIPPET = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

export function parseDuckDuckGoHtml(html: string): ProviderResult {
  const prices: ParsedPrice[] = [];
  const sources: PriceSource[] = [];
  for (const block of html.match(RESULT_BLOCK) ?? []) {
    const t = TITLE.exec(block);
    const s = SNIPPET.exec(block);
    const title = stripTags(t?.[2] ?? '');
    const snippet = stripTags(s?.[1] ?? '');
    const found = extractPrices(`${title} ${snippet}`);
    if (found.length === 0) continue;
    prices.push(...found);
    const first = found[0];
    sources.push({ title: title || 'Result', url: unwrapDdgUrl(t?.[1]), snippet, price: first?.value, currency: first?.currency });
  }
  return { provider: 'duckduckgo', prices, sources };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapDdgUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const m = /[?&]uddg=([^&]+)/.exec(href);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return href;
    }
  }
  return href.startsWith('//') ? `https:${href}` : href;
}
