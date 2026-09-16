import { STATIC_RATES, convertPrice, type RateTable } from '@pocketpilot/core';
import type { Db } from '../db.js';
import type { FetchLike } from './priceSearch/types.js';

interface FrankfurterResponse {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/**
 * Exchange rates with three layers: an in-memory copy, a SQLite cache, and a
 * static fallback table. Live rates come from frankfurter.app (free, no key).
 */
export class FxService {
  private memo: { table: RateTable; fetchedAt: number } | null = null;
  private inflight: Promise<RateTable> | null = null;

  constructor(
    private readonly db: Db | null,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly maxAgeHours = 24,
    private readonly enabled = true,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  /** Current best rate table. Never throws; falls back to the static table. */
  async getTable(): Promise<RateTable> {
    const now = Date.now();
    if (this.memo && now - this.memo.fetchedAt < this.maxAgeHours * 3600_000) return this.memo.table;
    const cached = this.readCache();
    if (cached && now - cached.fetchedAt < this.maxAgeHours * 3600_000) {
      this.memo = cached;
      return cached.table;
    }
    if (!this.enabled) return cached?.table ?? STATIC_RATES;
    if (!this.inflight) {
      this.inflight = this.fetchLive()
        .then((table) => {
          this.memo = { table, fetchedAt: Date.now() };
          this.writeCache(table);
          return table;
        })
        .catch((err: unknown) => {
          this.log(`live exchange rates unavailable: ${err instanceof Error ? err.message : String(err)}`);
          // Remember the failure briefly so every request doesn't retry.
          const fallback = cached?.table ?? STATIC_RATES;
          this.memo = { table: fallback, fetchedAt: Date.now() - (this.maxAgeHours - 1) * 3600_000 };
          return fallback;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) return amount;
    return convertPrice(amount, from, to, await this.getTable());
  }

  async status(): Promise<{ source: RateTable['source']; date: string; currencies: string[] }> {
    const t = await this.getTable();
    return { source: t.source, date: t.date, currencies: Object.keys(t.rates).sort() };
  }

  private async fetchLive(): Promise<RateTable> {
    const res = await this.fetchImpl('https://api.frankfurter.app/latest?from=USD', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`frankfurter responded ${res.status}`);
    const data = (await res.json()) as FrankfurterResponse;
    if (!data.rates || Object.keys(data.rates).length === 0) throw new Error('frankfurter returned no rates');
    // Keep static entries for currencies the live feed doesn't carry.
    return { base: 'USD', date: data.date ?? new Date().toISOString().slice(0, 10), source: 'live', rates: { ...STATIC_RATES.rates, ...data.rates, USD: 1 } };
  }

  private readCache(): { table: RateTable; fetchedAt: number } | null {
    if (!this.db) return null;
    const row = this.db.prepare('SELECT table_json, fetched_at FROM fx_rates WHERE id = 1').get() as { table_json: string; fetched_at: string } | undefined;
    if (!row) return null;
    try {
      return { table: JSON.parse(row.table_json) as RateTable, fetchedAt: Date.parse(row.fetched_at) };
    } catch {
      return null;
    }
  }

  private writeCache(table: RateTable): void {
    this.db?.prepare('INSERT OR REPLACE INTO fx_rates (id, table_json, fetched_at) VALUES (1, ?, ?)').run(JSON.stringify(table), new Date().toISOString());
  }
}
