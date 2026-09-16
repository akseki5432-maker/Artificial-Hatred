import type { ReactNode } from 'react';
import { CADENCES, type Cadence } from '@pocketpilot/core';

export function Card({ title, emoji, children, className = '', right }: { title?: string; emoji?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-title spread row">
          <div className="row" style={{ gap: 8 }}>
            {emoji && <span className="emoji">{emoji}</span>}
            {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

export function Hero({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <section className="card hero">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const CADENCE_LABELS: Record<Cadence, string> = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };
export const CADENCE_SHORT: Record<Cadence, string> = { daily: 'a day', weekly: 'a week', monthly: 'a month', yearly: 'a year' };

export function CadencePicker({ value, onChange, all = false }: { value: Cadence; onChange: (c: Cadence) => void; all?: boolean }) {
  const opts = (all ? CADENCES : CADENCES.filter((c) => c !== 'yearly')).map((c) => ({ value: c, label: CADENCE_LABELS[c] }));
  return <Segmented value={value} options={opts} onChange={onChange} />;
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
  big = false,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  big?: boolean;
  prefix?: string;
}) {
  return (
    <label className="field">
      {label}
      {hint && <span className="hint">{hint}</span>}
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        {prefix && <span style={{ fontWeight: 800, fontSize: big ? '1.4rem' : '1rem' }}>{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          className={big ? 'big' : ''}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </div>
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; format?: (n: number) => string }) {
  return (
    <label className="field">
      <span className="row spread">
        <span>{label}</span>
        <strong style={{ color: 'var(--text)' }}>{format ? format(value) : value}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card soft" style={{ textAlign: 'center', padding: 28 }}>
      {children}
    </div>
  );
}

export function Insights({ items }: { items: { id: string; emoji: string; title: string; body: string; tone: string }[] }) {
  return (
    <div className="grid grid-2">
      {items.map((i) => (
        <div key={i.id} className={`insight ${i.tone}`}>
          <span className="emoji" aria-hidden>
            {i.emoji}
          </span>
          <div>
            <h3>{i.title}</h3>
            <p>{i.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
