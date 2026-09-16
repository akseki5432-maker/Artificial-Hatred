import { useEffect, useMemo, useState } from 'react';
import { skipHabit } from '@pocketpilot/core';
import { BarRows } from '../components/LineChart.tsx';
import { Card, Segmented, Slider, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { Catalog, PricedHabit } from '../lib/types.ts';

export default function Habits() {
  const { profile, plan, money } = useProfile();
  const catalog = useAsync<Catalog>(() => api.catalog(profile?.currency), [profile?.currency]);
  const [selected, setSelected] = useState<PricedHabit | null>(null);
  const [cost, setCost] = useState(2.5);
  const [times, setTimes] = useState(5);
  const [years, setYears] = useState<'1' | '5' | '10'>('1');

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
