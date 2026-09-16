import { useEffect, useState } from 'react';
import { compoundGrowth } from '@pocketpilot/core';
import LineChart from '../components/LineChart.tsx';
import { Card, Insights, Slider, Stat } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';

export default function Grow() {
  const { profile, plan, refresh, money } = useProfile();
  const [monthly, setMonthly] = useState(0);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile || !plan) return;
    setMonthly(Math.round(plan.normalized.perMonth * profile.savingsRate));
    setRate(profile.growthRatePct);
    setYears(profile.age !== null && profile.age < 18 ? 18 - profile.age : 10);
  }, [profile, plan]);

  if (!profile || !plan) return <p className="muted">Loading…</p>;

  const startAge = profile.age ?? undefined;
  const withGrowth = compoundGrowth({ monthlyContribution: monthly, annualRatePct: rate, years, startingBalance: profile.startingBalance, ...(startAge !== undefined ? { startAge } : {}) });
  const noGrowth = compoundGrowth({ monthlyContribution: monthly, annualRatePct: 0, years, startingBalance: profile.startingBalance });
  const labels = withGrowth.points.map((p) => (p.age !== undefined ? p.age : p.year));
  const compare = [0, 3, 5, 7, 10].map((r) => ({ r, ...compoundGrowth({ monthlyContribution: monthly, annualRatePct: r, years, startingBalance: profile.startingBalance }) }));
  const doubleYears = rate > 0 ? Math.round(72 / rate) : Infinity;

  const tips = [
    { id: 'what', emoji: '🌱', tone: 'tip', title: 'Money can grow by itself', body: 'When you put money in a savings account or investment, it earns a little extra called interest or returns. Next year, the extra earns extra too. That is compounding.' },
    { id: 'parent-bank', emoji: '🏦', tone: 'win', title: 'Ask for a "family bank"', body: 'Many parents pay kids interest on saved money, like 5% or even 10% a month, to teach saving. Ask! It is the best deal you will ever get.' },
    { id: 'rule72', emoji: '✖️', tone: 'wow', title: `The rule of 72`, body: rate > 0 ? `Divide 72 by the growth rate to see how long money takes to double. At ${rate}% your money doubles about every ${doubleYears} years, without you adding anything.` : 'Divide 72 by the growth rate to see how long money takes to double. At 0% it never does, which is why a jar under the bed is the slowest option.' },
    { id: 'time', emoji: '⏳', tone: 'tip', title: 'Time beats amount', body: 'Starting young is your superpower. Money saved at 10 has twice as long to grow as money saved at 18. Even tiny amounts count.' },
  ];

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Make your money grow 🚀</h1>
        <p>Saving is step one. Growing is where it gets exciting.</p>
      </div>

      <div className="grid grid-2">
        <Card title="Try it" emoji="🎛️">
          <div className="stack">
            <Slider label="Money you save each month" value={monthly} onChange={setMonthly} min={0} max={Math.max(50, Math.ceil(plan.normalized.perMonth * 2))} step={1} format={(v) => money(v)} />
            <Slider label="Growth per year" value={rate} onChange={setRate} min={0} max={15} step={0.5} format={(v) => `${v}%`} />
            <Slider label="For how many years" value={years} onChange={setYears} min={1} max={30} step={1} format={(v) => `${v} years${startAge !== undefined ? ` (until age ${startAge + v})` : ''}`} />
            <p className="tiny">
              What is a normal growth rate? A bank savings account might pay 1 to 4%. A broad stock market fund has averaged around 7% a year over long stretches, but it goes up and down, sometimes a lot. A family bank can be anything a grown-up agrees to.
            </p>
            <button
              type="button"
              className="btn secondary"
              disabled={saving || rate === profile.growthRatePct}
              onClick={async () => {
                setSaving(true);
                try {
                  await api.profiles.update(profile.id, { growthRatePct: rate });
                  await refresh();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving…' : `Use ${rate}% everywhere in the app`}
            </button>
          </div>
        </Card>
        <div className="stack">
          <div className="grid grid-3">
            <Stat label="You put in" value={money(withGrowth.totalContributed + profile.startingBalance, { compact: true })} />
            <Stat label="Your money earned" value={money(withGrowth.totalGrowth, { compact: true })} delta="money your money made" />
            <Stat label="You end up with" value={money(withGrowth.finalBalance, { compact: true })} delta={`after ${years} years`} />
          </div>
          <Card title="With growth vs. without" emoji="📈">
            <LineChart
              title={`Saving ${years} years with growth compared with no growth`}
              labels={labels}
              xLabel={(l) => (startAge !== undefined ? `age ${l}` : `year ${l}`)}
              series={[
                { name: 'Jar under the bed (0%)', values: noGrowth.points.map((p) => p.balance) },
                { name: `Growing at ${rate}%`, values: withGrowth.points.map((p) => p.balance), area: true },
              ]}
              format={(v) => money(v, { compact: true })}
            />
          </Card>
        </div>
      </div>

      <Insights items={tips} />

      <Card title={`${money(monthly)} a month for ${years} years at different rates`} emoji="🔢">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Growth rate</th>
                <th className="num">You put in</th>
                <th className="num">Money earned</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((c) => (
                <tr key={c.r} style={{ fontWeight: c.r === rate ? 800 : 400 }}>
                  <td>
                    {c.r}%{c.r === 0 ? ' (piggy bank)' : c.r === 7 ? ' (stock market average)' : ''}
                  </td>
                  <td className="num">{money(c.totalContributed + profile.startingBalance)}</td>
                  <td className="num">{money(c.totalGrowth)}</td>
                  <td className="num">{money(c.finalBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny" style={{ marginTop: 8 }}>
          These are estimates. Real investments go up and down, and past averages don't promise the future. Kids need a grown-up to open a savings or custodial investment account.
        </p>
      </Card>
    </div>
  );
}
