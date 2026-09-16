import type { ParsedPrice } from '@pocketpilot/core';

export interface SearchOptions {
  /** Preferred currency code, e.g. "USD". */
  currency?: string;
  /** Two-letter country hint, e.g. "us". */
  country?: string;
  signal?: AbortSignal;
}

export interface PriceSource {
  title: string;
  url?: string;
  snippet?: string;
  /** The single price this source reported, if the provider gives one. */
  price?: number;
  currency?: string;
}

export interface ProviderResult {
  provider: string;
  prices: ParsedPrice[];
  sources: PriceSource[];
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PriceProvider {
  readonly name: string;
  /** True when the provider has what it needs (API key etc.) to run. */
  isConfigured(): boolean;
  search(query: string, options: SearchOptions): Promise<ProviderResult>;
}
