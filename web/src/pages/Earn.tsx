import { useState } from 'react';
import { Card, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { useAsync } from '../lib/useAsync.ts';
import type { EarnIdea } from '../lib/types.ts';

const KIND_LABEL: Record<EarnIdea['kind'], string> = { chores: 'At home', neighborhood: 'Around the neighborhood', creative: 'Make things', selling: 'Sell things', skills: 'Use your skills' };

export default function Earn() {
  const { profile, plan, refresh, money } = useProfile();
  const ideas = useAsync<EarnIdea[]>(() => api.earn(profile?.age ?? null), [profile?.age]);
  const [added, setAdded] = useState<string | null>(null);

  if (!profile || !plan) return <p className="muted">Loading…</p>;
  const list = ideas.data ?? [];
  const top = list.slice(0, 3);
  const topWeekly = top.reduce((s, i) => s + i.weeklyPotential, 0);

  async function addIdea(i: EarnIdea) {
    if (!profile) return;
    await api.profiles.addIncome(profile.id, { label: i.name, amount: i.payTypical * i.timesPerWeek, cadence: 'weekly' });
    setAdded(i.id);
    await refresh();
  }

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Earn more 💪</h1>
        <p>An allowance is a start. These are ways kids your age actually make money.</p>
      </div>
      <div className="grid grid-3">
        <Stat label="Allowance now" value={money(plan.normalized.perWeek)} delta="a week" />
        <Stat label="Top 3 ideas could add" value={money(topWeekly)} delta="a week, if you did them all" />
        <Stat label="That's a year of" value={money((plan.normalized.perWeek + topWeekly) * 52, { compact: true })} delta="allowance plus earnings" />
      </div>
      {ideas.error && <div className="alert">{ideas.error}</div>}
      <div className="grid grid-2">
        {list.map((i) => (
          <Card key={i.id} emoji={i.emoji} title={i.name} right={<span className="pill">{KIND_LABEL[i.kind]}</span>}>
            <div className="row spread">
              <div>
                <div className="small muted">Typical pay</div>
                <div style={{ fontWeight: 800 }}>
                  {money(i.payLow)} to {money(i.payHigh)} each time
                </div>
              </div>
              <div>
                <div className="small muted">Could be</div>
                <div style={{ fontWeight: 800 }}>{money(i.weeklyPotential)} a week</div>
              </div>
              <div>
                <div className="small muted">In a year</div>
                <div style={{ fontWeight: 800 }}>{money(i.yearlyPotential, { compact: true })}</div>
              </div>
            </div>
            <p className="small" style={{ margin: '10px 0' }}>
              💡 {i.tip}
            </p>
            <div className="row">
              <button type="button" className="btn sm secondary" onClick={() => addIdea(i)} disabled={added === i.id}>
                {added === i.id ? 'Added to my money ✓' : 'I do this! Add it'}
              </button>
              {i.needsAdult && <span className="tiny">Ages {i.minAge}+ · ask a grown-up first</span>}
            </div>
          </Card>
        ))}
      </div>
      <div className="insight tip">
        <span className="emoji">🧠</span>
        <div>
          <h3>The real trick</h3>
          <p>Whatever you earn on top of your allowance, put most of it into the Save and Grow jars. You did not have it before, so you will not miss it, and it grows while you sleep.</p>
        </div>
      </div>
    </div>
  );
}
