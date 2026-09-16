import { useMemo, useState } from 'react';
import { describeWeeks, opportunityCost } from '@pocketpilot/core';
import { Card, Empty, NumberField, Progress } from '../components/ui.tsx';
import { api, ApiError } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { Catalog, PricedCatalogItem } from '../lib/types.ts';
import { currencySymbol } from './Start.tsx';

export default function Goals() {
  const { profile, plan, refresh, money } = useProfile();
  const catalog = useAsync<Catalog>(() => api.catalog(), []);
  const [category, setCategory] = useState<string>('all');
  const [custom, setCustom] = useState({ name: '', price: 0, emoji: '🎯' });
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [busyGoal, setBusyGoal] = useState<number | null>(null);

  const items = useMemo(() => {
    const all = catalog.data?.goals ?? [];
    return category === 'all' ? all : all.filter((g) => g.category === category);
  }, [catalog.data, category]);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const weekly = plan.normalized.perWeek;
  const sym = currencySymbol(profile.currency);

  async function addFromCatalog(item: PricedCatalogItem) {
    if (!profile) return;
    await api.goals.create(profile.id, { catalogId: item.id, isFavorite: plan?.goals.length === 0 });
    await refresh();
  }

  async function addCustom() {
    if (!profile || !custom.name.trim() || custom.price <= 0) return;
    await api.goals.create(profile.id, { name: custom.name.trim(), price: custom.price, emoji: custom.emoji || '🎯', currency: profile.currency, isFavorite: plan?.goals.length === 0 });
    setCustom({ name: '', price: 0, emoji: '🎯' });
    setSearchNote(null);
    await refresh();
  }

  async function findPrice() {
    if (!custom.name.trim() || !profile) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const r = await api.prices.search({ query: custom.name.trim(), currency: profile.currency });
      setCustom((c) => ({ ...c, price: r.summary.median }));
      setSearchNote(`Found ${r.summary.count} prices online (${money(r.summary.low)} to ${money(r.summary.high)}) via ${r.provider}. Using the middle one.`);
    } catch (err) {
      setSearchNote(err instanceof ApiError ? err.message : 'Could not search right now. Type the price in.');
    } finally {
      setSearching(false);
    }
  }

  async function refreshGoalPrice(goalId: number, query: string | null, name: string) {
    if (!profile) return;
    setBusyGoal(goalId);
    try {
      const r = await api.prices.search({ query: query ?? `${name} price`, currency: profile.currency, fresh: true });
      await api.goals.update(goalId, { price: r.summary.median, currency: r.summary.currency });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyGoal(null);
    }
  }

  return (
    <div className="stack">
      <div className="page-title">
        <h1>What can I get with it? 🎯</h1>
        <p>Pick something you want and see how long it takes.</p>
      </div>

      {plan.goals.length === 0 ? (
        <Empty>
          <h3>No goals yet</h3>
          <p className="muted">Pick something from the list below, or add your own.</p>
        </Empty>
      ) : (
        <div className="grid grid-2">
          {plan.goals.map((g) => {
            const remaining = Math.max(0, g.price - g.savedSoFar);
            const later = opportunityCost(g.price, profile.growthRatePct, 10);
            return (
              <Card key={g.id} emoji={g.emoji} title={g.name} right={<span className="pill accent">{money(g.price)}</span>}>
                <div className="stack" style={{ gap: 10 }}>
                  <Progress value={g.progress} />
                  <div className="row spread small muted">
                    <span>
                      Saved {money(g.savedSoFar)} of {money(g.price)}
                    </span>
                    <span>{Math.round(g.progress * 100)}%</span>
                  </div>
                  {remaining === 0 ? (
                    <div className="alert ok">You can get this right now. 🎉</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>If you save…</th>
                          <th className="num">a week</th>
                          <th>you get it in</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.plans.map((p) => (
                          <tr key={p.savingsRate} style={{ fontWeight: Math.abs(p.savingsRate - profile.savingsRate) < 0.01 ? 800 : 400 }}>
                            <td>{Math.round(p.savingsRate * 100)}% of your money</td>
                            <td className="num">{money(p.weeklySaving)}</td>
                            <td>{describeWeeks(p.timing.weeks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="tiny">
                    Fun fact: {money(g.price)} saved and grown at {profile.growthRatePct}% for 10 years would be {money(later)}. Is this worth {money(later)} to you? Sometimes yes!
                  </p>
                  <div className="row">
                    <UpdateSaved goalId={g.id} value={g.savedSoFar} sym={sym} onDone={refresh} />
                    <button type="button" className="btn ghost sm" onClick={async () => { await api.goals.update(g.id, { isFavorite: !g.isFavorite }); await refresh(); }}>
                      {g.isFavorite ? '⭐ Favorite' : '☆ Make favorite'}
                    </button>
                    <button type="button" className="btn ghost sm" disabled={busyGoal === g.id} onClick={() => refreshGoalPrice(g.id, g.searchQuery, g.name)} title="Search the web for today's price">
                      {busyGoal === g.id ? 'Searching…' : '🔎 Check price online'}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={async () => { if (confirm(`Remove ${g.name}?`)) { await api.goals.remove(g.id); await refresh(); } }}>
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="Add your own goal" emoji="✨">
        <div className="grid grid-3">
          <label className="field">
            What do you want?
            <input type="text" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Telescope, guitar, hoverboard…" />
          </label>
          <NumberField label="Price" value={custom.price} onChange={(v) => setCustom({ ...custom, price: v })} step={0.01} prefix={sym} />
          <label className="field">
            Emoji
            <input type="text" value={custom.emoji} onChange={(e) => setCustom({ ...custom, emoji: e.target.value })} maxLength={4} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn secondary" disabled={searching || !custom.name.trim()} onClick={findPrice}>
            {searching ? 'Searching the web…' : '🔎 Find the price online'}
          </button>
          <button type="button" className="btn" disabled={!custom.name.trim() || custom.price <= 0} onClick={addCustom}>
            Add goal
          </button>
        </div>
        {searchNote && <p className="small muted" style={{ marginTop: 10 }}>{searchNote}</p>}
      </Card>

      <Card title="Ideas" emoji="💡" right={
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 'auto' }} aria-label="Category">
          <option value="all">Everything</option>
          {Object.entries(catalog.data?.categories ?? {})
            .filter(([k]) => k !== 'custom')
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      }>
        {catalog.error && <div className="alert">{catalog.error}</div>}
        <div className="grid grid-4">
          {items.map((item) => {
            const weeks = weekly * profile.savingsRate > 0 ? item.price / (weekly * profile.savingsRate) : Infinity;
            return (
              <button key={item.id} type="button" className="tile" onClick={() => addFromCatalog(item)} title="Add to my goals">
                <span className="emoji">{item.emoji}</span>
                <span className="name">{item.name}</span>
                <span className="price">
                  {money(item.price)}
                  {item.source !== 'catalog' && <span className="pill good" style={{ marginLeft: 6 }}>live</span>}
                </span>
                <span className="tiny">{describeWeeks(weeks)}</span>
              </button>
            );
          })}
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Times shown use your current savings rate ({Math.round(profile.savingsRate * 100)}%). Prices are typical list prices; check the Prices page to update them from the web.
        </p>
      </Card>
    </div>
  );
}

function UpdateSaved({ goalId, value, sym, onDone }: { goalId: number; value: number; sym: string; onDone: () => Promise<void> }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn sm secondary" onClick={() => setOpen(true)}>
        💰 I saved some
      </button>
    );
  return (
    <span className="row" style={{ gap: 6 }}>
      <span style={{ fontWeight: 800 }}>{sym}</span>
      <input type="number" min={0} step={0.5} value={v} onChange={(e) => setV(Number(e.target.value))} style={{ width: 110 }} aria-label="Saved so far" />
      <button type="button" className="btn sm" onClick={async () => { await api.goals.update(goalId, { savedSoFar: Math.max(0, v) }); setOpen(false); await onDone(); }}>
        Save
      </button>
    </span>
  );
}
