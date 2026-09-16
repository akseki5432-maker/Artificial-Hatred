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
  const catalog = useAsync<Catalog>(() => api.catalog(profile?.currency), [profile?.currency]);
  const [category, setCategory] = useState<string>('all');
  const [custom, setCustom] = useState({ name: '', price: 0, emoji: '🎯', targetDate: '' });
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [busyGoal, setBusyGoal] = useState<number | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [wish, setWish] = useState<Record<string, number>>({});

  const items = useMemo(() => {
    const all = catalog.data?.goals ?? [];
    return category === 'all' ? all : all.filter((g) => g.category === category);
  }, [catalog.data, category]);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const weekly = plan.normalized.perWeek;
  const yearly = plan.normalized.perYear;
  const sym = currencySymbol(profile.currency);
  const showOriginal = (item: { originalPrice: number; originalCurrency: string; currency: string }) => item.originalCurrency !== item.currency;

  const wishRows = Object.entries(wish)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: catalog.data?.goals.find((g) => g.id === id), qty }))
    .filter((r): r is { item: PricedCatalogItem; qty: number } => Boolean(r.item));
  const wishTotal = wishRows.reduce((s, r) => s + r.item.price * r.qty, 0);
  const wishShare = yearly > 0 ? wishTotal / yearly : Infinity;
  const wishWeeks = weekly > 0 ? wishTotal / weekly : Infinity;

  async function addFromCatalog(item: PricedCatalogItem) {
    if (!profile) return;
    setGoalError(null);
    try {
      await api.goals.create(profile.id, { catalogId: item.id, isFavorite: plan?.goals.length === 0 });
      await refresh();
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addCustom() {
    if (!profile || !custom.name.trim() || custom.price <= 0) return;
    setGoalError(null);
    try {
      await api.goals.create(profile.id, {
        name: custom.name.trim(),
        price: custom.price,
        emoji: custom.emoji || '🎯',
        currency: profile.currency,
        isFavorite: plan?.goals.length === 0,
        targetDate: custom.targetDate || null,
      });
      setCustom({ name: '', price: 0, emoji: '🎯', targetDate: '' });
      setSearchNote(null);
      await refresh();
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : String(err));
    }
  }

  async function findPrice() {
    if (!custom.name.trim() || !profile) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const r = await api.prices.search({ query: custom.name.trim(), currency: profile.currency });
      const price = r.converted?.price ?? r.summary.median;
      setCustom((c) => ({ ...c, price }));
      const range = r.converted ? `${money(r.converted.low)} to ${money(r.converted.high)}` : `${money(r.summary.low)} to ${money(r.summary.high)}`;
      setSearchNote(`Found ${r.summary.count} prices online (${range}) via ${r.provider}${r.converted ? `, converted from ${r.summary.currency}` : ''}. Using the middle one.`);
    } catch (err) {
      setSearchNote(err instanceof ApiError ? err.message : 'Could not search right now. Type the price in.');
    } finally {
      setSearching(false);
    }
  }

  async function refreshGoalPrice(goalId: number, query: string | null, name: string) {
    if (!profile) return;
    setBusyGoal(goalId);
    setGoalError(null);
    try {
      const r = await api.prices.search({ query: query ?? `${name} price`, currency: profile.currency, fresh: true });
      const price = r.converted?.price ?? r.summary.median;
      const currency = r.converted?.currency ?? r.summary.currency;
      await api.goals.update(goalId, { price, currency });
      await refresh();
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : String(err));
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

      {goalError && <div className="alert">{goalError}</div>}

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
            const d = g.deadline;
            return (
              <Card key={g.id} emoji={g.emoji} title={g.name} right={<span className="pill accent">{money(g.price)}</span>}>
                <div className="stack" style={{ gap: 10 }}>
                  {g.convertedFrom && (
                    <div className="tiny">
                      Price found as {g.convertedFrom.price} {g.convertedFrom.currency}, shown in {profile.currency}.
                    </div>
                  )}
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
                  {d && remaining > 0 && (
                    <div className={`alert ${d.onTrack ? 'ok' : d.shareOfIncome > 1 ? '' : 'info'}`}>
                      {d.weeksLeft <= 0 ? (
                        <>The date you picked has passed. Pick a new one or keep going at your own pace.</>
                      ) : d.shareOfIncome > 1 ? (
                        <>
                          To have it by {formatDate(d.targetDate)} you'd need {money(d.neededPerWeek)} a week, more than you get. Push the date back, add a way to earn, or ask about a birthday boost.
                        </>
                      ) : d.onTrack ? (
                        <>
                          On track! Saving {Math.round(profile.savingsRate * 100)}% gets you {g.name} before {formatDate(d.targetDate)}. You need {money(d.neededPerWeek)} a week.
                        </>
                      ) : (
                        <>
                          To have it by {formatDate(d.targetDate)} you need to save {money(d.neededPerWeek)} a week, that's {Math.round(d.shareOfIncome * 100)}% of your money instead of {Math.round(profile.savingsRate * 100)}%.
                        </>
                      )}
                    </div>
                  )}
                  <p className="tiny">
                    Fun fact: {money(g.price)} saved and grown at {profile.growthRatePct}% for 10 years would be {money(later)}. Is this worth {money(later)} to you? Sometimes yes!
                  </p>
                  <div className="row">
                    <UpdateSaved goalId={g.id} value={g.savedSoFar} sym={sym} onDone={refresh} />
                    <DeadlinePicker goalId={g.id} value={g.targetDate} onDone={refresh} />
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
        <div className="grid grid-4">
          <label className="field">
            What do you want?
            <input type="text" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Telescope, guitar, hoverboard…" />
          </label>
          <NumberField label="Price" value={custom.price} onChange={(v) => setCustom({ ...custom, price: v })} step={0.01} prefix={sym} />
          <label className="field">
            Want it by (optional)
            <input type="date" value={custom.targetDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCustom({ ...custom, targetDate: e.target.value })} />
          </label>
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

      <Card
        title="What does a year buy?"
        emoji="🛒"
        right={
          wishRows.length > 0 ? (
            <button type="button" className="btn ghost sm" onClick={() => setWish({})}>
              Clear
            </button>
          ) : undefined
        }
      >
        <p className="muted small">
          Tap things below to put them in your cart and see how much of a year's allowance ({money(yearly)}) they eat.
        </p>
        {wishRows.length === 0 ? (
          <p className="tiny">Your cart is empty. Tap the 🛒 on any idea below.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <ul className="list">
              {wishRows.map(({ item, qty }) => (
                <li key={item.id} className="item">
                  <span className="emoji">{item.emoji}</span>
                  <div className="body">
                    <div className="name">{item.name}</div>
                    <div className="meta">
                      {money(item.price)} × {qty}
                    </div>
                  </div>
                  <span className="price">{money(item.price * qty)}</span>
                  <button type="button" className="btn ghost sm" aria-label={`Remove one ${item.name}`} onClick={() => setWish({ ...wish, [item.id]: qty - 1 })}>
                    −
                  </button>
                </li>
              ))}
            </ul>
            <Progress value={Math.min(1, wishShare)} />
            <div className={`alert ${wishShare <= 0.5 ? 'ok' : wishShare <= 1 ? 'info' : ''}`}>
              <strong>{money(wishTotal)}</strong> total. {Number.isFinite(wishShare) ? `That's ${Math.round(wishShare * 100)}% of a year's allowance` : 'Add an allowance to compare'}
              {Number.isFinite(wishWeeks) ? `, or ${describeWeeks(wishWeeks)} of saving everything.` : '.'}{' '}
              {wishShare > 1 ? 'More than a year. Which one matters most?' : wishShare <= 0.25 ? 'Easy. What else?' : ''}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Ideas"
        emoji="💡"
        right={
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
        }
      >
        {catalog.error && <div className="alert">{catalog.error}</div>}
        <div className="grid grid-4">
          {items.map((item) => {
            const weeks = weekly * profile.savingsRate > 0 ? item.price / (weekly * profile.savingsRate) : Infinity;
            const inCart = wish[item.id] ?? 0;
            return (
              <div key={item.id} className={`tile ${inCart > 0 ? 'on' : ''}`} style={{ cursor: 'default' }}>
                <span className="emoji">{item.emoji}</span>
                <span className="name">{item.name}</span>
                <span className="price">
                  {money(item.price)}
                  {item.source !== 'catalog' && <span className="pill good" style={{ marginLeft: 6 }}>live</span>}
                </span>
                {showOriginal(item) && <span className="tiny">≈ {item.originalPrice} {item.originalCurrency}</span>}
                <span className="tiny">{describeWeeks(weeks)}</span>
                <span className="row" style={{ gap: 4, marginTop: 4 }}>
                  <button type="button" className="btn sm secondary" onClick={() => addFromCatalog(item)}>
                    🎯 Goal
                  </button>
                  <button type="button" className="btn sm secondary" onClick={() => setWish({ ...wish, [item.id]: inCart + 1 })} aria-label={`Add ${item.name} to cart`}>
                    🛒{inCart > 0 ? ` ${inCart}` : ''}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Times shown use your current savings rate ({Math.round(profile.savingsRate * 100)}%). Prices are typical list prices
          {catalog.data?.currency && catalog.data.currency !== 'USD' ? ` converted into ${catalog.data.currency}` : ''}; check the Prices page to update them from the web.
        </p>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

function DeadlinePicker({ goalId, value, onDone }: { goalId: number; value: string | null; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(value ?? '');
  if (!open)
    return (
      <button type="button" className="btn sm secondary" onClick={() => setOpen(true)}>
        📅 {value ? `By ${formatDate(value)}` : 'Set a date'}
      </button>
    );
  return (
    <span className="row" style={{ gap: 6 }}>
      <input type="date" value={v} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setV(e.target.value)} aria-label="Want it by" style={{ width: 'auto' }} />
      <button type="button" className="btn sm" onClick={async () => { await api.goals.update(goalId, { targetDate: v || null }); setOpen(false); await onDone(); }}>
        Save
      </button>
      {value && (
        <button type="button" className="btn ghost sm" onClick={async () => { await api.goals.update(goalId, { targetDate: null }); setV(''); setOpen(false); await onDone(); }}>
          Clear
        </button>
      )}
    </span>
  );
}
