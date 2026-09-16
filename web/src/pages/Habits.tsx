import { useEffect, useMemo, useState } from 'react';
import { skipHabit } from '@pocketpilot/core';
import { BarRows } from '../components/LineChart.tsx';
import { Card, Segmented, Slider, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { Catalog, PricedHabit, Skip } from '../lib/types.ts';

export default function Habits() {
  const { profile, plan, refresh, money } = useProfile();
  const catalog = useAsync<Catalog>(() => api.catalog(profile?.currency), [profile?.currency]);
  const [selected, setSelected] = useState<PricedHabit | null>(null);
  const [cost, setCost] = useState(2.5);
  const [times, setTimes] = useState(5);
  const [years, setYears] = useState<'1' | '5' | '10'>('1');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [bankGoal, setBankGoal] = useState<string>('');
  const skips = useAsync<Skip[]>(() => (profile ? api.skips.list(profile.id) : Promise.resolve([])), [profile?.id, plan?.skips.count]);

  useEffect(() => {
    const first = catalog.data?.habits[0];
    if (first && !selected) {
      setSelected(first);
      setCost(first.price);
      setTimes(first.timesPerWeek);
    }
  }, [catalog.data, selected]);

  const result = useMemo(() => skipHabit({ costPerItem: cost, timesPerWeek: times, years: Number(years), annualRatePct: profile?.growthRatePct ?? 7 }), [cost, times, years, profile]);
  const half = useMemo(() => skipHabit({ costPerItem: cost, timesPerWeek: times / 2, years: Number(years), annualRatePct: profile?.growthRatePct ?? 7 }), [cost, times, years, profile]);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const share = plan.normalized.perYear > 0 ? result.yearlyCost / plan.normalized.perYear : 0;
  const favorite = plan.goals.find((g) => g.isFavorite) ?? plan.goals[0];
  const goalsWorth = favorite && favorite.price > 0 ? result.investedValue / favorite.price : null;

  return (
    <div className="stack">
      <div className="page-title">
        <h1>The daily stuff 🧋</h1>
        <p>Small things you buy all the time add up faster than anything.</p>
      </div>

      <Card title="Pick a habit" emoji="🛒">
        {catalog.error && <div className="alert">{catalog.error}</div>}
        <div className="grid grid-4">
          {(catalog.data?.habits ?? []).map((h) => (
            <button
              key={h.id}
              type="button"
              className={`tile ${selected?.id === h.id ? 'on' : ''}`}
              onClick={() => {
                setSelected(h);
                setCost(h.price);
                setTimes(h.timesPerWeek);
              }}
            >
              <span className="emoji">{h.emoji}</span>
              <span className="name">{h.name}</span>
              <span className="price">{money(h.price)} each</span>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Skip it, keep the money"
        emoji="🙅"
        right={plan.skips.pendingTotal > 0 ? <span className="pill accent">{money(plan.skips.pendingTotal)} waiting</span> : undefined}
      >
        <p className="muted small">
          Every time you decide not to buy something, tap the button. Nothing moves yet, it just keeps score. When you are ready, move the whole
          pile into your Save jar and it becomes real money.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={!selected || busy}
            onClick={async () => {
              if (!profile || !selected) return;
              setBusy(true);
              setNote(null);
              try {
                await api.skips.add(profile.id, { habitId: selected.id, name: selected.name, amount: cost });
                await refresh();
                await skips.reload();
              } catch (err) {
                setNote(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            🙅 I skipped {selected ? selected.name.toLowerCase() : 'it'} ({money(cost)})
          </button>
          {plan.goals.length > 0 && (
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span className="small">Bank it toward</span>
              <select value={bankGoal} onChange={(e) => setBankGoal(e.target.value)} style={{ width: 'auto' }}>
                <option value="">just my Save jar</option>
                {plan.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji} {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="btn secondary"
            disabled={busy || plan.skips.pendingTotal <= 0}
            onClick={async () => {
              if (!profile) return;
              setBusy(true);
              setNote(null);
              try {
                const r = await api.skips.bank(profile.id, bankGoal ? Number(bankGoal) : null);
                setNote(`Moved ${money(r.moved)} from ${r.count} skipped treat${r.count === 1 ? '' : 's'} into your savings. That is real money now.`);
                await refresh();
                await skips.reload();
              } catch (err) {
                setNote(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            🫙 Move {money(plan.skips.pendingTotal)} into savings
          </button>
        </div>
        {note && <p className="small" style={{ marginTop: 10 }}>{note}</p>}
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <Stat label="Skipped this week" value={money(plan.skips.thisWeek)} />
          <Stat label="Waiting to be banked" value={money(plan.skips.pendingTotal)} delta={`${plan.skips.pendingCount} treat${plan.skips.pendingCount === 1 ? '' : 's'}`} />
          <Stat label="Skipped in total" value={money(plan.skips.total)} delta={`${plan.skips.count} time${plan.skips.count === 1 ? '' : 's'}`} />
        </div>
        {(skips.data ?? []).length > 0 && (
          <ul className="list" style={{ marginTop: 12 }}>
            {(skips.data ?? []).slice(0, 6).map((sk) => (
              <li key={sk.id} className="item">
                <span className="emoji">{sk.movedAt ? '🫙' : '🙅'}</span>
                <div className="body">
                  <div className="name">{sk.name}</div>
                  <div className="meta">{sk.movedAt ? 'moved into savings' : 'waiting to be banked'}</div>
                </div>
                <span className="price">{money(sk.amount)}</span>
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={`Remove the skipped ${sk.name}`}
                  onClick={async () => {
                    await api.skips.remove(sk.id);
                    await refresh();
                    await skips.reload();
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title={selected ? `${selected.emoji} ${selected.name}` : 'Your habit'} emoji="🎛️">
          <div className="stack">
            <Slider label="What it costs each time" value={cost} onChange={setCost} min={0.25} max={25} step={0.25} format={(v) => money(v)} />
            <Slider label="How many times a week" value={times} onChange={setTimes} min={0} max={21} step={1} format={(v) => `${v}x`} />
            <div className="row">
              <span className="small muted">Look ahead</span>
              <Segmented value={years} onChange={setYears} options={[{ value: '1', label: '1 year' }, { value: '5', label: '5 years' }, { value: '10', label: '10 years' }]} />
            </div>
          </div>
        </Card>
        <div className="stack">
          <div className="grid grid-3">
            <Stat label="Costs a week" value={money(result.weeklyCost)} />
            <Stat label="Costs a year" value={money(result.yearlyCost)} delta={plan.normalized.perYear > 0 ? `${Math.round(share * 100)}% of your allowance` : undefined} />
            <Stat label={`In ${years} year${years === '1' ? '' : 's'}`} value={money(result.totalSpent, { compact: true })} delta={`${result.itemsSkipped.toLocaleString()} purchases`} />
          </div>
          <div className={`insight ${share >= 0.5 ? 'warning' : 'wow'}`}>
            <span className="emoji">{share >= 1 ? '😱' : share >= 0.5 ? '😬' : '🤔'}</span>
            <div>
              <h3>
                Skip it and grow the money instead: {money(result.investedValue, { compact: true })}
              </h3>
              <p>
                Put that {money(result.weeklyCost)} a week into a jar growing at {profile.growthRatePct}% and after {years} year{years === '1' ? '' : 's'} you'd have {money(result.investedValue)}.{' '}
                {result.growthBonus > 1 ? `${money(result.growthBonus)} of that is pure growth. ` : ''}
                {goalsWorth !== null && favorite ? `That is ${goalsWorth.toFixed(1)} × ${favorite.emoji} ${favorite.name}.` : ''}
              </p>
            </div>
          </div>
          <div className="insight tip">
            <span className="emoji">🤝</span>
            <div>
              <h3>Not all or nothing</h3>
              <p>
                Cut it in half instead of quitting and you still keep {money(half.investedValue)} after {years} year{years === '1' ? '' : 's'}. Pick the {Math.ceil(times / 2)} times a week that make you happiest and skip the rest.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card title="What each habit costs in a year" emoji="📊">
        <BarRows
          rows={(catalog.data?.habits ?? []).map((h) => ({ label: `${h.emoji} ${h.name}`, value: skipHabit({ costPerItem: h.price, timesPerWeek: h.timesPerWeek, years: 1 }).yearlyCost })).sort((a, b) => b.value - a.value)}
          format={(v) => money(v)}
        />
        <p className="tiny" style={{ marginTop: 8 }}>Using typical prices and how often kids usually buy each one. Your numbers may differ, so use the sliders above.</p>
      </Card>
    </div>
  );
}
