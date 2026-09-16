import { useMemo, useState } from 'react';
import { Card, NumberField } from '../components/ui.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { Catalog, PriceSearchResult, ProviderStatus } from '../lib/types.ts';

const PROVIDER_HELP: Record<string, string> = {
  serpapi: 'Google Shopping results through SerpApi. Set SERPAPI_KEY in .env.',
  brave: 'Brave Search web results. Set BRAVE_SEARCH_API_KEY in .env.',
  duckduckgo: 'Key-free fallback that reads DuckDuckGo result pages. Can be rate limited.',
};

export default function Prices() {
  const { profile, refresh, money } = useProfile();
  const status = useAsync(() => api.prices.status(), []);
  const catalog = useAsync<Catalog>(() => api.catalog(), []);
  const [query, setQuery] = useState('');
  const [applyTo, setApplyTo] = useState('');
  const [result, setResult] = useState<PriceSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshReport, setRefreshReport] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; price: number } | null>(null);
  const [history, setHistory] = useState<{ key: string; rows: { price: number; currency: string; source: string; at: string }[] } | null>(null);

  const currency = profile?.currency ?? 'USD';
  const anyProvider = (status.data?.providers ?? []).some((p: ProviderStatus) => p.configured);

  const rows = useMemo(() => {
    const c = catalog.data;
    if (!c) return [];
    return [
      ...c.goals.map((g) => ({ key: `goal:${g.id}`, emoji: g.emoji, name: g.name, price: g.price, currency: g.currency, source: g.source, fetchedAt: g.fetchedAt, query: g.searchQuery })),
      ...c.habits.map((h) => ({ key: `habit:${h.id}`, emoji: h.emoji, name: h.name, price: h.price, currency: h.currency, source: h.source, fetchedAt: h.fetchedAt, query: h.searchQuery })),
    ];
  }, [catalog.data]);

  async function reloadAll() {
    await Promise.all([catalog.reload(), status.reload(), refresh()]);
  }

  async function search(fresh = false) {
    if (!query.trim()) return;
    setBusy(true);
    setSearchError(null);
    setResult(null);
    try {
      const r = await api.prices.search({ query: query.trim(), currency, fresh, ...(applyTo ? { applyToKey: applyTo } : {}) });
      setResult(r);
      if (r.saved) await reloadAll();
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshAll() {
    if (!confirm('Search the web for every item in the catalog? This makes one search per item and can take a minute.')) return;
    setRefreshing(true);
    setRefreshReport(null);
    try {
      const r = await api.prices.refreshAll({ currency });
      setRefreshReport(`Updated ${r.updated.length} prices. ${r.failed.length ? `${r.failed.length} could not be found: ${r.failed.slice(0, 3).map((f) => f.key).join(', ')}${r.failed.length > 3 ? '…' : ''}` : ''}`);
      await reloadAll();
    } catch (err) {
      setRefreshReport(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function savePrice() {
    if (!editing) return;
    await api.prices.set(editing.key, { price: editing.price, currency });
    setEditing(null);
    await reloadAll();
  }

  async function lookupRow(row: { key: string; query?: string; name: string }) {
    setBusy(true);
    setSearchError(null);
    try {
      const r = await api.prices.search({ query: row.query ?? `${row.name} price`, currency, applyToKey: row.key, fresh: true });
      setResult(r);
      setQuery(r.query);
      await reloadAll();
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Prices 🏷️</h1>
        <p>Prices change. Search the web for today's price, or type in what your local shop charges.</p>
      </div>

      <div className="grid grid-2">
        <Card title="Search the web" emoji="🔎">
          <div className="stack">
            <label className="field">
              What are you pricing?
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nintendo Switch 2, kids mountain bike, boba tea…" onKeyDown={(e) => e.key === 'Enter' && search()} />
            </label>
            <label className="field">
              Save the result as the price for
              <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)}>
                <option value="">Just show me</option>
                {rows.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.emoji} {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <button type="button" className="btn" disabled={busy || !query.trim() || !anyProvider} onClick={() => search(false)}>
                {busy ? 'Searching…' : 'Search'}
              </button>
              <button type="button" className="btn secondary" disabled={busy || !query.trim() || !anyProvider} onClick={() => search(true)} title="Skip the cache and ask the provider again">
                Search again, fresh
              </button>
            </div>
            {!anyProvider && status.data && <div className="alert">No online price provider is set up. Copy .env.example to .env and add a key, or enable the DuckDuckGo fallback. You can still type prices in by hand below.</div>}
            {searchError && <div className="alert">{searchError}</div>}
            {result && (
              <div className="alert ok">
                <strong>
                  {money(result.summary.median)} {result.summary.currency !== currency ? `(${result.summary.currency})` : ''}
                </strong>{' '}
                is the middle price from {result.summary.count} result{result.summary.count === 1 ? '' : 's'} ({money(result.summary.low)} to {money(result.summary.high)}) via {result.provider}
                {result.fromCache ? ', from the cache' : ''}.{result.saved ? ` Saved as the price for ${result.saved.name}.` : ''}
                {result.sources.length > 0 && (
                  <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {result.sources.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer noopener">
                            {s.title}
                          </a>
                        ) : (
                          s.title
                        )}
                        {s.price !== undefined ? ` · ${money(s.price)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Card>
        <Card title="Where prices come from" emoji="🌐">
          <ul className="list">
            {(status.data?.providers ?? []).map((p: ProviderStatus) => (
              <li key={p.name} className="item">
                <span className="emoji">{p.configured ? '🟢' : '⚪'}</span>
                <div className="body">
                  <div className="name">{p.name}</div>
                  <div className="meta">{PROVIDER_HELP[p.name] ?? ''}</div>
                </div>
                <span className={`pill ${p.configured ? 'good' : ''}`}>{p.configured ? 'on' : 'off'}</span>
              </li>
            ))}
          </ul>
          <p className="tiny" style={{ marginTop: 10 }}>
            Providers are tried in order and the first one that finds a price wins. Results are cached for a day. Live prices show a <span className="pill good">live</span> tag around the app.
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn secondary" disabled={refreshing || !anyProvider} onClick={refreshAll}>
              {refreshing ? 'Refreshing everything…' : '🔄 Refresh every price from the web'}
            </button>
          </div>
          {refreshReport && <p className="small" style={{ marginTop: 8 }}>{refreshReport}</p>}
        </Card>
      </div>

      <Card title="All prices" emoji="📋">
        {catalog.error && <div className="alert">{catalog.error}</div>}
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Price</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.emoji} {r.name}
                    <div className="tiny">{r.key}</div>
                  </td>
                  <td className="num">
                    {editing?.key === r.key ? (
                      <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <NumberField label="" value={editing.price} onChange={(v) => setEditing({ key: r.key, price: v })} step={0.01} />
                        <button type="button" className="btn sm" onClick={savePrice}>
                          Save
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <strong>{money(r.price)}</strong>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${r.source === 'catalog' ? '' : r.source === 'manual' ? 'accent' : 'good'}`}>{r.source.replace('online:', 'web: ')}</span>
                    {r.fetchedAt && <div className="tiny">{new Date(r.fetchedAt.includes('T') ? r.fetchedAt : `${r.fetchedAt.replace(' ', 'T')}Z`).toLocaleDateString()}</div>}
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn ghost sm" onClick={() => setEditing({ key: r.key, price: r.price })}>
                      ✏️ Edit
                    </button>
                    <button type="button" className="btn ghost sm" disabled={busy || !anyProvider} onClick={() => lookupRow(r)} title="Search the web and save the result">
                      🔎 Web
                    </button>
                    <button type="button" className="btn ghost sm" onClick={async () => setHistory({ key: r.key, rows: await api.prices.history(r.key) })}>
                      🕘
                    </button>
                    {r.source !== 'catalog' && (
                      <button type="button" className="btn ghost sm" onClick={async () => { await api.prices.reset(r.key); await reloadAll(); }} title="Go back to the built-in price">
                        ↩︎
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history && (
          <div className="card soft" style={{ marginTop: 12 }}>
            <div className="row spread">
              <strong>Price history for {history.key}</strong>
              <button type="button" className="btn ghost sm" onClick={() => setHistory(null)}>
                Close
              </button>
            </div>
            {history.rows.length === 0 ? (
              <p className="muted small">No changes recorded yet. The built-in price is being used.</p>
            ) : (
              <table>
                <tbody>
                  {history.rows.map((h, i) => (
                    <tr key={i}>
                      <td className="small muted">{h.at}</td>
                      <td>{h.source}</td>
                      <td className="num">{money(h.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
