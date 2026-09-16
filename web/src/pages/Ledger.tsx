import { useState } from 'react';
import { skipHabit } from '@pocketpilot/core';
import { BarRows } from '../components/LineChart.tsx';
import { Card, NumberField, Segmented, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { LedgerEntry } from '../lib/types.ts';
import { currencySymbol } from './Start.tsx';

const IN_CATS = ['allowance', 'chores', 'gift', 'other'];
const OUT_CATS = ['snacks', 'games', 'toys', 'clothes', 'fun', 'saving', 'sharing', 'other'];
const CAT_EMOJI: Record<string, string> = { allowance: '💵', chores: '🧹', gift: '🎁', snacks: '🍫', games: '🎮', toys: '🧸', clothes: '👕', fun: '🎢', saving: '🫙', sharing: '💝', other: '📦' };

export default function Ledger() {
  const { profile, plan, refresh, money } = useProfile();
  const entries = useAsync<LedgerEntry[]>(() => (profile ? api.ledger.list(profile.id) : Promise.resolve([])), [profile?.id, plan?.ledgerSummary.entries]);
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('snacks');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const sym = currencySymbol(profile.currency);
  const s = plan.ledgerSummary;
  const cats = Object.entries(s.byCategory).map(([label, value]) => ({ label: `${CAT_EMOJI[label] ?? ''} ${label}`, value })).sort((a, b) => b.value - a.value);
  const snacks = s.byCategory.snacks ?? 0;
  const snackYear = skipHabit({ costPerItem: snacks, timesPerWeek: 1, years: 1, annualRatePct: profile.growthRatePct });

  async function add() {
    if (!profile || amount <= 0) return;
    setBusy(true);
    try {
      await api.ledger.add(profile.id, { kind, amount, category, note: note.trim() || null });
      setAmount(0);
      setNote('');
      await refresh();
      await entries.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Money log 📒</h1>
        <p>Write down what comes in and what goes out. Seeing it is half the battle.</p>
      </div>
      <div className="grid grid-3">
        <Stat label="Came in (30 days)" value={money(s.receivedThisMonth)} />
        <Stat label="Went out (30 days)" value={money(s.spentThisMonth)} />
        <Stat label="Kept" value={money(s.receivedThisMonth - s.spentThisMonth)} delta={s.receivedThisMonth > 0 ? `${Math.round(((s.receivedThisMonth - s.spentThisMonth) / s.receivedThisMonth) * 100)}% of what came in` : undefined} />
      </div>
      <div className="grid grid-2">
        <Card title="Add something" emoji="✏️">
          <div className="stack">
            <Segmented
              value={kind}
              onChange={(k) => {
                setKind(k);
                setCategory(k === 'in' ? 'allowance' : 'snacks');
              }}
              options={[
                { value: 'in', label: '💵 Money in' },
                { value: 'out', label: '🛍️ Money out' },
              ]}
            />
            <NumberField label="How much?" value={amount} onChange={setAmount} step={0.25} big prefix={sym} />
            <label className="field">
              What for?
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {(kind === 'in' ? IN_CATS : OUT_CATS).map((c) => (
                  <option key={c} value={c}>
                    {CAT_EMOJI[c]} {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Note (optional)
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Chips after school" />
            </label>
            <button type="button" className="btn" disabled={busy || amount <= 0} onClick={add}>
              {busy ? 'Saving…' : 'Add to log'}
            </button>
          </div>
        </Card>
        <div className="stack">
          <Card title="Where it goes" emoji="📊">
            {cats.length === 0 ? <p className="muted">Nothing logged yet. Add a few things and a picture appears here.</p> : <BarRows rows={cats} format={(v) => money(v)} color="var(--series-2)" />}
          </Card>
          {snacks > 0 && (
            <div className="insight wow">
              <span className="emoji">🍫</span>
              <div>
                <h3>Snack check</h3>
                <p>
                  You've logged {money(snacks)} on snacks. If that happened every week for a year and you saved it instead, you'd have {money(snackYear.investedValue)}.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Card title="Everything so far" emoji="🧾">
        {entries.error && <div className="alert">{entries.error}</div>}
        {(entries.data ?? []).length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(entries.data ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="small muted">{formatWhen(e.at)}</td>
                  <td>
                    {CAT_EMOJI[e.category] ?? ''} {e.category}
                    {e.note ? <span className="muted"> · {e.note}</span> : null}
                  </td>
                  <td className="num" style={{ color: e.kind === 'in' ? 'var(--win-ink)' : undefined, fontWeight: 700 }}>
                    {e.kind === 'in' ? '+' : '−'}
                    {money(e.amount)}
                  </td>
                  <td className="num">
                    <button type="button" className="btn ghost sm" onClick={async () => { await api.ledger.remove(e.id); await refresh(); await entries.reload(); }} aria-label="Delete entry">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function formatWhen(at: string): string {
  const d = new Date(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
