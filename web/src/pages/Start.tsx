import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalize, formatMoney, type Cadence } from '@pocketpilot/core';
import { api } from '../lib/api.ts';
import { useProfile } from '../lib/profile.tsx';
import { CadencePicker, Card, NumberField } from '../components/ui.tsx';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'INR', 'JPY', 'MXN', 'BRL', 'ZAR', 'SGD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY'];

export default function Start() {
  const navigate = useNavigate();
  const { selectProfile, refresh } = useProfile();
  const [name, setName] = useState('');
  const [age, setAge] = useState(10);
  const [amount, setAmount] = useState(10);
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [currency, setCurrency] = useState('USD');
  const [starting, setStarting] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = normalize({ amount, cadence });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api.profiles.create({ name: name.trim() || 'Me', age, allowanceAmount: amount, allowanceCadence: cadence, currency, startingBalance: starting });
      selectProfile(p.id);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-title">
        <h1>Hi! Let's see what your money can do 🪙</h1>
        <p>Tell PocketPilot about your allowance. You can change everything later.</p>
      </div>
      <form onSubmit={submit} className="stack">
        <Card>
          <div className="grid grid-2">
            <label className="field">
              What's your name?
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" maxLength={60} autoFocus />
            </label>
            <NumberField label="How old are you?" value={age} onChange={setAge} min={3} max={25} />
          </div>
        </Card>
        <Card title="Your allowance" emoji="💵">
          <div className="stack">
            <CadencePicker value={cadence} onChange={setCadence} />
            <div className="grid grid-2">
              <NumberField label="How much do you get?" value={amount} onChange={setAmount} min={0} step={0.5} big prefix={currencySymbol(currency)} />
              <label className="field">
                Money type
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c} {currencySymbol(c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <NumberField label="Money you already have saved" hint="Piggy bank, birthday money, anything" value={starting} onChange={setStarting} min={0} step={1} prefix={currencySymbol(currency)} />
            <div className="alert info">
              That's <strong>{formatMoney(preview.perWeek, { currency })}</strong> a week, <strong>{formatMoney(preview.perMonth, { currency })}</strong> a month, and{' '}
              <strong>{formatMoney(preview.perYear, { currency })}</strong> a year.
            </div>
          </div>
        </Card>
        {error && <div className="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ alignSelf: 'flex-start', fontSize: '1.1rem' }}>
          {busy ? 'Saving…' : 'Show me my money map →'}
        </button>
      </form>
    </div>
  );
}

export function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(1);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}
