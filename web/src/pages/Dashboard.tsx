import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { equivalentUnits, normalizeSplit, type Cadence, type SplitPercentages } from '@pocketpilot/core';
import LineChart from '../components/LineChart.tsx';
import { CADENCE_SHORT, CadencePicker, Card, Hero, Insights, NumberField, Slider, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { currencySymbol } from './Start.tsx';

const JARS: { key: keyof SplitPercentages; emoji: string; label: string; blurb: string }[] = [
  { key: 'save', emoji: '🫙', label: 'Save', blurb: 'For goals you are working toward' },
  { key: 'spend', emoji: '🍦', label: 'Spend', blurb: 'Fun money, no guilt' },
  { key: 'share', emoji: '💝', label: 'Share', blurb: 'Gifts, charity, helping out' },
  { key: 'invest', emoji: '🌱', label: 'Grow', blurb: 'Long-term money that makes money' },
];

export default function Dashboard() {
  const { profile, plan, refresh, money } = useProfile();
  const [amount, setAmount] = useState(profile?.allowanceAmount ?? 0);
  const [cadence, setCadence] = useState<Cadence>(profile?.allowanceCadence ?? 'weekly');
  const [split, setSplit] = useState<SplitPercentages>(profile?.split ?? { save: 40, spend: 40, share: 10, invest: 10 });
  const [savingsRate, setSavingsRate] = useState(Math.round((profile?.savingsRate ?? 0.5) * 100));
  const [saving, setSaving] = useState(false);
  const [newIncome, setNewIncome] = useState({ label: '', amount: 5, cadence: 'weekly' as Cadence });

  useEffect(() => {
    if (!profile) return;
    setAmount(profile.allowanceAmount);
    setCadence(profile.allowanceCadence);
    setSplit(profile.split);
    setSavingsRate(Math.round(profile.savingsRate * 100));
  }, [profile]);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const n = plan.normalized;
  const sym = currencySymbol(profile.currency);
  const dirty = amount !== profile.allowanceAmount || cadence !== profile.allowanceCadence || savingsRate !== Math.round(profile.savingsRate * 100) || JSON.stringify(split) !== JSON.stringify(profile.split);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await api.profiles.update(profile.id, { allowanceAmount: amount, allowanceCadence: cadence, savingsRate: savingsRate / 100, split: normalizeSplit(split) });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function setJar(key: keyof SplitPercentages, value: number) {
    const others = (Object.keys(split) as (keyof SplitPercentages)[]).filter((k) => k !== key);
    const otherSum = others.reduce((s, k) => s + split[k], 0);
    const next = { ...split, [key]: value };
    // Keep the total at 100 by scaling the other jars.
    const remaining = 100 - value;
    for (const k of others) next[k] = otherSum > 0 ? Math.round((split[k] / otherSum) * remaining) : Math.round(remaining / 3);
    setSplit(normalizeSplit(next));
  }

  const candy = plan.habits.find((h) => h.id === 'candy');
  const extra = plan.sources.slice(1);

  return (
    <div className="stack">
      <div className="page-title">
        <h1>{profile.name}'s money map</h1>
        <p>What your allowance really adds up to.</p>
      </div>

      <Hero
        label="In one year you get"
        value={money(n.perYear)}
        sub={
          <>
            {money(profile.allowanceAmount)} {CADENCE_SHORT[profile.allowanceCadence]}
            {extra.length > 0 ? ` plus ${extra.length} extra way${extra.length === 1 ? '' : 's'} to earn` : ''} turns into {money(n.perYear)} a year.
            {candy ? ` That's ${equivalentUnits(n.perYear, candy.price).toLocaleString()} candy bars.` : ''}
          </>
        }
      />

      <div className="grid grid-4">
        <Stat label="Every day" value={money(n.perDay)} />
        <Stat label="Every week" value={money(n.perWeek)} />
        <Stat label="Every month" value={money(n.perMonth)} />
        <Stat label={`By age ${profile.age !== null ? 18 : '+10 years'}`} value={money(plan.untilAdult.withGrowth.finalBalance, { compact: true })} delta={`saving ${Math.round(profile.savingsRate * 100)}% at ${profile.growthRatePct}% growth`} />
      </div>

      <Insights items={plan.insights} />

      <div className="grid grid-2">
        <Card title="Your allowance" emoji="💵">
          <div className="stack">
            <CadencePicker value={cadence} onChange={setCadence} />
            <NumberField label="Amount" value={amount} onChange={setAmount} step={0.5} big prefix={sym} />
            <Slider label="How much of it do you save?" value={savingsRate} onChange={setSavingsRate} min={0} max={100} step={5} format={(v) => `${v}%`} />
            <p className="small muted">
              Saving {savingsRate}% means {money((n.perWeek * savingsRate) / 100)} a week goes to goals and growing. The rest is yours to spend.
            </p>
            {extra.length > 0 && (
              <ul className="list">
                {extra.map((s, i) => (
                  <li key={i} className="item">
                    <span className="emoji">💪</span>
                    <div className="body">
                      <div className="name">{s.label}</div>
                      <div className="meta">
                        {money(s.amount)} {CADENCE_SHORT[s.cadence]}
                      </div>
                    </div>
                    <RemoveIncome profileId={profile.id} label={s.label ?? ''} onDone={refresh} />
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Add another way you get money</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                <label className="field">
                  What is it?
                  <input type="text" placeholder="Dog walking, birthday money…" value={newIncome.label} onChange={(e) => setNewIncome({ ...newIncome, label: e.target.value })} />
                </label>
                <div className="row">
                  <NumberField label="Amount" value={newIncome.amount} onChange={(v) => setNewIncome({ ...newIncome, amount: v })} step={0.5} prefix={sym} />
                  <CadencePicker value={newIncome.cadence} onChange={(c) => setNewIncome({ ...newIncome, cadence: c })} all />
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!newIncome.label.trim()}
                  onClick={async () => {
                    await api.profiles.addIncome(profile.id, { label: newIncome.label.trim(), amount: newIncome.amount, cadence: newIncome.cadence });
                    setNewIncome({ label: '', amount: 5, cadence: 'weekly' });
                    await refresh();
                  }}
                >
                  Add it
                </button>
                <p className="tiny">
                  Want ideas? See <Link to="/earn">Earn more</Link>.
                </p>
              </div>
            </details>
            <button type="button" className="btn" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Card>

        <Card title="Four jars" emoji="🫙">
          <p className="muted small">Split each allowance the day you get it. Move the sliders to try different plans.</p>
          <div className="jars">
            {JARS.map((j) => (
              <div key={j.key} className="jar">
                <div className="emoji">{j.emoji}</div>
                <div className="amount">{money((n.perMonth * split[j.key]) / 100)}</div>
                <div className="pct">
                  {j.label} · {Math.round(split[j.key])}% a month
                </div>
                <div className="tiny">{j.blurb}</div>
                <input type="range" min={0} max={100} step={5} value={Math.round(split[j.key])} onChange={(e) => setJar(j.key, Number(e.target.value))} aria-label={`${j.label} percent`} />
              </div>
            ))}
          </div>
          <p className="tiny" style={{ marginTop: 10 }}>
            Per week that's {money((n.perWeek * split.save) / 100)} to save, {money((n.perWeek * split.spend) / 100)} to spend, {money((n.perWeek * split.share) / 100)} to share, and{' '}
            {money((n.perWeek * split.invest) / 100)} to grow.
          </p>
        </Card>
      </div>

      <Card title="Your next 12 months" emoji="📈" right={<span className="pill accent">saving {Math.round(profile.savingsRate * 100)}%</span>}>
        <LineChart
          labels={plan.balanceOneYear.map((p) => p.month)}
          xLabel={(l) => (Number(l) === 0 ? 'now' : `month ${l}`)}
          series={[
            { name: 'Money you put in', values: plan.balanceOneYear.map((p) => p.contributed + profile.startingBalance) },
            { name: 'Total with growth', values: plan.balanceOneYear.map((p) => p.balance), area: true },
          ]}
          format={(v) => money(v, { compact: true })}
        />
        <p className="small muted" style={{ marginTop: 8 }}>
          Growth here is {profile.growthRatePct}% a year. Change it on the <Link to="/grow">Grow</Link> page. Ask a grown-up whether they'd pay you "interest" on saved money. Many families do.
        </p>
      </Card>
    </div>
  );
}

function RemoveIncome({ profileId, label, onDone }: { profileId: number; label: string; onDone: () => Promise<void> }) {
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        const list = await api.profiles.get(profileId);
        const match = list.income.find((i) => i.label === label);
        if (match) await api.profiles.removeIncome(profileId, match.id);
        await onDone();
      }}
    >
      Remove
    </button>
  );
}
