import { useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Chart ink comes from the same tokens as styles.css (Recharts needs real colours,
// not CSS variables, in SVG attributes).
const INK = {
  light: { text: '#1b2238', muted: '#5b6377', grid: '#e6e9ef', alarm: '#cc2b2b', surface: '#ffffff' },
  dark: { text: '#e8ebf3', muted: '#9aa3b8', grid: '#2a3142', alarm: '#f05252', surface: '#1a2030' },
};

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);
const years = (d) => Math.round((Math.abs(d) / 365) * 10) / 10;

function whenText(d) {
  if (d === 0) return 'Today';
  if (Math.abs(d) >= 365) return d < 0 ? `${years(d)} years ago` : `In ${years(d)} years (forecast)`;
  return d < 0 ? `${-d} days ago` : `In ${d} days (forecast)`;
}

function TooltipBox({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload.find((x) => x.value != null);
  if (!p) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-when">{whenText(label)}</div>
      <div><strong>{fmt(p.value)}</strong> {unit}</div>
    </div>
  );
}

// Daily axis for short ranges, yearly axis for inspection history and long forecasts.
function axis(minDay, horizon) {
  const span = horizon - minDay;
  const yearly = span > 400;
  const step = yearly ? 365 : span > 100 ? 30 : 15;
  const ticks = [];
  for (let d = Math.ceil(minDay / step) * step; d <= horizon; d += step) ticks.push(d);
  if (!ticks.includes(horizon)) ticks.push(horizon);
  const format = (d) => {
    if (d === 0) return 'Today';
    const sign = d > 0 ? '+' : '';
    return yearly && d % 365 === 0 ? `${sign}${d / 365}y` : `${sign}${d}d`;
  };
  return { ticks, format };
}

// `periodic`: readings taken on rounds or inspections (shown as dots) rather than
// a daily sensor line.
export function ForecastChart({
  readings, forecast, baseline, threshold, unit, theme,
  markDay = 0, horizon = 30, periodic = false, pointLabel = 'Measured',
}) {
  const ink = INK[theme];
  const data = useMemo(() => {
    const rows = readings.map((r) => ({ day: r.day, hist: r.value }));
    // The dashed forecast starts at the latest reading so the two lines join.
    rows[rows.length - 1].fc = rows[rows.length - 1].hist;
    for (const f of forecast) {
      const v = Math.round(f.value * 1000) / 1000;
      const existing = rows.find((r) => r.day === f.day);
      if (existing) existing.fc = existing.fc ?? v;
      else rows.push({ day: f.day, fc: v });
    }
    return rows.sort((a, b) => a.day - b.day);
  }, [readings, forecast]);

  const minDay = readings[0].day;
  const { ticks: xTicks, format: xFormat } = axis(minDay, horizon);

  // Round the y-axis to a clean 1/2/5 step so ticks read as plain numbers.
  const values = data.map((d) => d.hist ?? d.fc);
  const rawLo = Math.min(baseline, ...values);
  const rawHi = Math.max(threshold, ...values);
  const mag = 10 ** Math.floor(Math.log10((rawHi - rawLo) / 4 || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => (rawHi - rawLo) / s <= 5);
  const lo = Math.max(0, Math.floor(rawLo / step) * step);
  const hi = Math.ceil(rawHi / step) * step;
  const yTicks = [];
  for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(Math.round(v * 1000) / 1000);

  const last = readings[readings.length - 1];
  return (
    <div className="chart" role="img"
      aria-label={`${periodic ? `${pointLabel} history` : 'Last 30 days'} and forecast to ${xFormat(horizon)}. Latest reading ${fmt(last.value)} ${unit}, alarm at ${threshold} ${unit}.`}>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={ink.grid} vertical={false} />
          <XAxis
            dataKey="day" type="number" domain={[minDay, horizon]} ticks={xTicks} tickFormatter={xFormat}
            tick={{ fill: ink.muted, fontSize: 11 }} stroke={ink.grid} tickLine={false}
          />
          <YAxis
            domain={[lo, hi]} ticks={yTicks} tickFormatter={fmt} width={42}
            tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false}
          />
          <ReferenceLine
            y={threshold} stroke={ink.alarm} strokeDasharray="4 3"
            label={{ value: `Alarm ${threshold}`, position: 'insideTopLeft', fill: ink.muted, fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke={ink.muted} strokeOpacity={0.5} />
          {markDay > 0 && (
            <ReferenceLine
              x={markDay} stroke={ink.text} strokeDasharray="2 2"
              label={{ value: xFormat(markDay), position: 'top', fill: ink.text, fontSize: 11 }}
            />
          )}
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: ink.muted, strokeOpacity: 0.4 }} />
          <Line dataKey="hist" stroke={ink.text} strokeWidth={2} isAnimationActive={false} connectNulls
            dot={periodic ? { r: 4, fill: ink.text, stroke: ink.surface, strokeWidth: 2 } : false}
            activeDot={{ r: 4, stroke: ink.surface, strokeWidth: 2 }} />
          <Line dataKey="fc" stroke={ink.muted} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false}
            activeDot={{ r: 4, stroke: ink.surface, strokeWidth: 2 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-key" aria-hidden="true">
        <span><i className="key-solid" /> {pointLabel}</span>
        <span><i className="key-dashed" /> Forecast if no action</span>
      </div>
    </div>
  );
}
