import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { equivalentUnits, normalizeSplit, type Cadence, type SplitPercentages } from '@pocketpilot/core';
import LineChart from '../components/LineChart.tsx';
import { CADENCE_SHORT, CadencePicker, Card, Hero, Insights, NumberField, Slider, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { CURRENCIES, currencySymbol } from './Start.tsx';

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
        <Stat label="Every week" value={money(n.perWeek)} delta={`${money(n.perDay)} a day`} />
        <Stat label="Every month" value={money(n.perMonth)} />
        <Stat
          label="Money you have now"
          value={money(plan.ledgerSummary.balanceNow)}
          delta={
            plan.ledgerSummary.entries > 0
              ? `${plan.ledgerSummary.inSaveJar > 0 ? `${money(plan.ledgerSummary.inSaveJar)} in the Save jar · ` : ''}${plan.ledgerSummary.savingStreakWeeks > 0 ? `${plan.ledgerSummary.savingStreakWeeks}-week saving streak 🔥` : 'log a "saving" entry to start a streak'}`
              : 'keep the Log to track it'
          }
        />
        <Stat label={profile.age !== null && profile.age < 18 ? 'By age 18' : 'In 10 years'} value={money(plan.untilAdult.withGrowth.finalBalance, { compact: true })} delta={`saving ${Math.round(profile.savingsRate * 100)}% at ${profile.growthRatePct}% growth`} />
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
                    {s.id !== null && <RemoveIncome profileId={profile.id} incomeId={s.id} onDone={refresh} />}
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

      <Settings />

      <Card title="Your next 12 months" emoji="📈" right={<span className="pill accent">saving {Math.round(profile.savingsRate * 100)}%</span>}>
        <LineChart
          title="What you will have over the next 12 months"
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

function Settings() {
  const { profile, profiles, refresh, selectProfile, money } = useProfile();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: profile?.name ?? '', age: profile?.age ?? 10, currency: profile?.currency ?? 'USD', startingBalance: profile?.startingBalance ?? 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (profile) setForm({ name: profile.name, age: profile.age ?? 10, currency: profile.currency, startingBalance: profile.startingBalance });
  }, [profile]);
  if (!profile) return null;
  const changed = form.name !== profile.name || form.age !== (profile.age ?? 10) || form.currency !== profile.currency || form.startingBalance !== profile.startingBalance;
  return (
    <details className="card soft">
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>⚙️ Settings for {profile.name} (grown-ups)</summary>
      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <label className="field">
          Name
          <input type="text" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <NumberField label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} min={3} max={25} />
        <label className="field">
          Money type
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} {currencySymbol(c)}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Money already saved" value={form.startingBalance} onChange={(v) => setForm({ ...form, startingBalance: v })} step={1} prefix={currencySymbol(form.currency)} />
      </div>
      {form.currency !== profile.currency && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Changing the money type does not convert the allowance amount ({money(profile.allowanceAmount)}) or saved goals. Update those after switching.
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn"
          disabled={!changed || busy || !form.name.trim()}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await api.profiles.update(profile.id, { name: form.name.trim(), age: form.age, currency: form.currency, startingBalance: form.startingBalance });
              await refresh();
              setMsg('Saved.');
            } catch (err) {
              setMsg(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save settings
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete ${profile.name} and everything logged for them? This cannot be undone.`)) return;
            setBusy(true);
            try {
              await api.profiles.remove(profile.id);
              const next = profiles.find((p) => p.id !== profile.id);
              selectProfile(next?.id ?? null);
              await refresh();
              if (!next) navigate('/start');
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete this kid
        </button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <Backup onDone={refresh} />
    </details>
  );
}

function Backup({ onDone }: { onDone: () => Promise<void> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>Backup</h3>
      <p className="small muted">
        Everything lives on this computer. Download a backup now and then, especially before moving to a new device.
      </p>
      <div className="row">
        <a className="btn secondary" href={api.backup.url} download>
          ⬇️ Download a backup
        </a>
        <label className="btn secondary" style={{ cursor: 'pointer' }}>
          ⬆️ Restore from a backup
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              setMsg(null);
              try {
                const data = JSON.parse(await file.text()) as unknown;
                const r = await api.backup.restore(data);
                setMsg(`Restored ${r.restored.profiles} kid(s), ${r.restored.goals} goals and ${r.restored.ledger} log entries. Restoring adds to what is here, it never replaces it.`);
                await onDone();
              } catch (err) {
                setMsg(err instanceof Error ? `Could not restore that file: ${err.message}` : String(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

function RemoveIncome({ profileId, incomeId, onDone }: { profileId: number; incomeId: number; onDone: () => Promise<void> }) {
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        await api.profiles.removeIncome(profileId, incomeId);
        await onDone();
      }}
    >
      Remove
    </button>
  );
}
