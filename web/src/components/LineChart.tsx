import { useId, useMemo, useRef, useState } from 'react';

export interface Series {
  name: string;
  values: number[];
  /** CSS color, defaults to the categorical slots in order. */
  color?: string;
  area?: boolean;
}

interface Props {
  labels: (string | number)[];
  series: Series[];
  format: (v: number) => string;
  xLabel?: (label: string | number, index: number) => string;
  height?: number;
  /** Also show the last value of each series next to its line end. */
  endLabels?: boolean;
  /** Accessible name for the chart. Falls back to the series names. */
  title?: string;
}

const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
const PAD = { top: 16, right: 88, bottom: 28, left: 52 };

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(t);
  return ticks;
}

/**
 * Small responsive SVG line chart with a hover crosshair and tooltip.
 * One y axis, 2px lines, 8px markers with a surface ring, direct end labels.
 */
export default function LineChart({ labels, series, format, xLabel, height = 240, endLabels = true, title }: Props) {
  const width = 640;
  const ref = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const name = title ?? series.map((s) => s.name).join(' versus ');

  const maxY = useMemo(() => Math.max(1, ...series.flatMap((s) => s.values)), [series]);
  const ticks = useMemo(() => niceTicks(maxY), [maxY]);
  const yMax = ticks[ticks.length - 1] ?? maxY;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (width - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / yMax) * (height - PAD.top - PAD.bottom);

  const paths = series.map((s) => s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '));

  // End labels: push apart vertically when two series finish close together so neither is hidden.
  const endLabelY = useMemo(() => {
    const MIN_GAP = 14;
    const order = series.map((s, i) => ({ i, y: y(s.values[s.values.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < order.length; k++) {
      const prev = order[k - 1] as { i: number; y: number };
      const cur = order[k] as { i: number; y: number };
      if (cur.y - prev.y < MIN_GAP) cur.y = prev.y + MIN_GAP;
    }
    // Keep the whole label stack inside the plot area.
    const top = PAD.top + 4;
    const bottom = height - PAD.bottom - 4;
    const first = order[0];
    const last = order[order.length - 1];
    if (first && last) {
      let shift = 0;
      if (last.y > bottom) shift = bottom - last.y;
      if (first.y + shift < top) shift = top - first.y;
      for (const o of order) o.y += shift;
    }
    const out: number[] = [];
    for (const o of order) out[o.i] = o.y;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yMax, height, n]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const t = (px - PAD.left) / (width - PAD.left - PAD.right);
    const idx = Math.round(Math.max(0, Math.min(1, t)) * (n - 1));
    setHover(Number.isFinite(idx) ? idx : null);
  }

  const xTickIdx = useMemo(() => {
    const every = Math.max(1, Math.ceil(n / 6));
    return labels.map((_, i) => i).filter((i) => i % every === 0 || i === n - 1);
  }, [labels, n]);

  const tooltipLeft = hover === null ? 0 : (x(hover) / width) * 100;

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`Chart: ${name}. The same numbers are in the table below.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text key={i} className="axis-text" x={x(i)} y={height - 8} textAnchor="middle">
            {xLabel ? xLabel(labels[i] as string | number, i) : String(labels[i])}
          </text>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? SLOTS[si % SLOTS.length];
          const last = s.values.length - 1;
          return (
            <g key={s.name}>
              {s.area && <path className="series-area" d={`${paths[si]} L${x(last).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`} fill={color} />}
              <path className="series-line" d={paths[si]} stroke={color} />
              <circle className="marker" cx={x(last)} cy={y(s.values[last] ?? 0)} r={4} fill={color} />
              {endLabels && (
                <text className="end-label" x={x(last) + 8} y={(endLabelY[si] ?? y(s.values[last] ?? 0)) + 4}>
                  {format(s.values[last] ?? 0)}
                </text>
              )}
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} />
            {series.map((s, si) => (
              <circle key={s.name} className="marker" cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={5} fill={s.color ?? SLOTS[si % SLOTS.length]} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${tooltipLeft}%`, top: 0, transform: tooltipLeft > 60 ? 'translateX(-110%)' : 'translateX(12px)' }}>
          <div className="t">{xLabel ? xLabel(labels[hover] as string | number, hover) : String(labels[hover])}</div>
          {series.map((s, si) => (
            <div key={s.name} className="r">
              <span>
                <span className="key" style={{ background: s.color ?? SLOTS[si % SLOTS.length], display: 'inline-block', width: 10, height: 3, marginRight: 6, verticalAlign: 'middle' }} />
                {s.name}
              </span>
              <strong>{format(s.values[hover] ?? 0)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="row spread" style={{ alignItems: 'flex-end' }}>
        {series.length > 1 ? (
          <div className="legend">
            {series.map((s, si) => (
              <span key={s.name}>
                <span className="key" style={{ background: s.color ?? SLOTS[si % SLOTS.length] }} />
                {s.name}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className="btn ghost sm" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide the numbers' : 'Show the numbers'}
        </button>
      </div>
      <div id={tableId} hidden={!showTable} className="scroll-x">
        <table>
          <caption className="visually-hidden">{name}</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              {series.map((s) => (
                <th scope="col" className="num" key={s.name}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={i}>
                <th scope="row" style={{ fontWeight: 400 }}>
                  {xLabel ? xLabel(l, i) : String(l)}
                </th>
                {series.map((s) => (
                  <td className="num" key={s.name}>
                    {format(s.values[i] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BarRows({ rows, format, color }: { rows: { label: string; value: number }[]; format: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bars" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((r) => (
        <li key={r.label} className="bar-row">
          <span>{r.label}</span>
          <div className="track" aria-hidden>
            <div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span className="val">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
