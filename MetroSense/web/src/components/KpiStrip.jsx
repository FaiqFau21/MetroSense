// Dashboard strip of KPI cards above the 3D view. Every figure follows the forecast
// day, scenario and spikes, and comes from the same projected campus as the rest
// of the app. Change arrows use ink, not risk colours (those are reserved for status).

import { RISK_COLORS, LEVELS, riskLevel, pct } from '../risk.js';
import { RiskBadge, RiskIcon } from './RiskIcon.jsx';
import { WEATHER, WEATHER_LOCATION, CONDITIONS, weatherEvents } from '../data/weather.js';
import { durationText } from '../model/problem.js';
import { dayLabel } from './ForecastBar.jsx';
import { isOverdue } from './CasesPanel.jsx';
import { HIGH_RISK_MIN } from '../model/project.js';

function Delta({ now, then, unit = '' }) {
  const d = now - then;
  if (d === 0) return <span className="kpi-delta">no change vs today</span>;
  return (
    <span className="kpi-delta">
      <span aria-hidden="true">{d > 0 ? '▲' : '▼'}</span> {d > 0 ? '+' : '−'}{Math.abs(d).toLocaleString('en-MY')}{unit} vs today
    </span>
  );
}

// 30-day trend line: de-emphasis ink, the chosen day as an accent dot.
function Sparkline({ series, field, day, label }) {
  const w = 120;
  const h = 32;
  const vals = series.map((p) => p[field]);
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const x = (d) => (d / 30) * (w - 4) + 2;
  const y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p[field]).toFixed(1)}`).join(' ');
  const marked = day <= 30 ? series.reduce((a, p) => (Math.abs(p.day - day) < Math.abs(a.day - day) ? p : a)) : null;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
      aria-label={`${label} over the next 30 days: from ${vals[0]} today to ${vals.at(-1)} at +30 days.`}>
      <path d={path} className="spark-line" />
      {marked && <circle cx={x(marked.day)} cy={y(marked[field])} r="3" className="spark-dot" />}
      <title>{`${label}: ${vals[0]} today → ${vals.at(-1)} at +30 days`}</title>
    </svg>
  );
}

// Full-colour weather icons, as on a phone weather widget.
function WeatherIcon({ kind, size = 18 }) {
  const cloud = (fill) => <path d="M6.5 18h10.5a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8-1.3A4.7 4.7 0 0 0 6.5 18z" fill={fill} />;
  return (
    <svg className="wx-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'sun' && (
        <g>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="1.8" x2="12" y2="4.6" transform={`rotate(${a} 12 12)`} stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" />
          ))}
          <circle cx="12" cy="12" r="5.2" fill="#FFC83D" />
          <circle cx="12" cy="12" r="3.2" fill="#FFAA1F" />
        </g>
      )}
      {kind === 'cloud' && (
        <g>
          <circle cx="15.5" cy="7.5" r="3.6" fill="#FFC83D" />
          {cloud('#F2F5FA')}
        </g>
      )}
      {kind === 'rain' && (
        <g>
          {cloud('#D5DEEC')}
          {[7.5, 11.5, 15.5].map((x) => <line key={x} x1={x} y1="19.5" x2={x - 1.2} y2="22.6" stroke="#5EC4FF" strokeWidth="2" strokeLinecap="round" />)}
        </g>
      )}
      {kind === 'storm' && (
        <g>
          {cloud('#A9B6CE')}
          <path d="M12.8 14.5 9.6 19.4h2.8l-1.3 4 4-5.6h-2.9l1.6-3.3z" fill="#FFD43B" />
        </g>
      )}
    </svg>
  );
}

// Weather widget: the card takes the colour of today's sky; heavy-rain and hot
// days are flagged with a word and an icon, not colour alone.
function WeatherCard({ day, scenario, onUseWeather }) {
  const events = weatherEvents();
  const today = WEATHER[0];
  const using = scenario === 'weather';
  const week = WEATHER.slice(0, 7);
  const maxRain = Math.max(...WEATHER.map((w) => w.rainMm), 1);
  return (
    <section className={`kpi kpi-weather wx-${today.condition}`} aria-label="Weather forecast">
      <div className="wx-top">
        <div className="wx-place">
          <span className="wx-pin" aria-hidden="true">⌖</span>
          {WEATHER_LOCATION}
          <span className="wx-sim">Simulated</span>
        </div>
        <button className="wx-use" onClick={onUseWeather} disabled={using} aria-pressed={using}>
          {using ? '✓ In the forecast' : 'Use in forecast'}
        </button>
      </div>

      <div className="wx-now">
        <WeatherIcon kind={today.condition} size={38} />
        <span className="wx-big">{today.maxC}°</span>
        <span className="wx-now-text">
          <strong>{CONDITIONS[today.condition]}</strong>
          <span>H {today.maxC}° · L {today.minC}° · {today.rainMm} mm rain</span>
        </span>
      </div>

      <ol className="wx-days">
        {week.map((w) => (
          <li
            key={w.day}
            className={`${w.day === day ? 'is-chosen' : ''} ${w.stress ? `is-${w.stress}` : ''}`}
            title={`${w.weekday} ${w.date}: ${CONDITIONS[w.condition]}, ${w.maxC}°/${w.minC}°, ${w.rainMm} mm`}
          >
            <span className="wx-day">{w.day === 0 ? 'Today' : w.weekday}</span>
            <WeatherIcon kind={w.condition} size={20} />
            <span className="wx-temp"><strong>{w.maxC}°</strong><span>{w.minC}°</span></span>
            <span className="wx-rainbar" aria-hidden="true"><i style={{ width: `${Math.max(10, (w.rainMm / maxRain) * 100)}%`, opacity: w.rainMm ? 1 : 0.25 }} /></span>
          </li>
        ))}
      </ol>

      <div className="wx-alerts">
        {events.length === 0 && <span className="wx-chip">No heavy rain or heat ahead</span>}
        {events.map((e) => (
          <span key={`${e.kind}${e.from}`} className={`wx-chip wx-chip-${e.kind}`}>
            <WeatherIcon kind={e.kind === 'rain' ? 'rain' : 'sun'} size={14} /> {e.label} {e.when}
          </span>
        ))}
      </div>
    </section>
  );
}

// A status card: tinted background, coloured top edge and the risk shape, so the
// colour is never the only cue. Text stays in ink for contrast.
function StatusLabel({ level, colors, children }) {
  return (
    <div className="kpi-label">
      {level && <RiskIcon level={level} color={colors[level.key]} size={12} />}
      {children}
    </div>
  );
}

function CasesCard({ cases, team, colors, onOpenCases }) {
  const open = cases.filter((c) => c.status !== 'Resolved');
  const fromReports = open.filter((c) => c.sources.reports > 0).length;
  const unassigned = open.filter((c) => c.status === 'New').length;
  const overdue = open.filter(isOverdue).length;
  const mine = open.filter((c) => c.partyKey === team).length;
  const critical = LEVELS[3];
  return (
    <section className="kpi" data-tone="accent">
      <div className="kpi-label">Open cases</div>
      <div className="kpi-value">{open.length}</div>
      <span className="kpi-delta">{fromReports} from reports · {open.length - fromReports} predicted · {mine} for your team</span>
      <span className="kpi-sub">
        {unassigned} to assign
        {overdue > 0 && (
          <span className="kpi-alert">
            <RiskIcon level={critical} color={colors.critical} size={11} /> {overdue} past due
          </span>
        )}
      </span>
      <button className="link-btn kpi-link" onClick={onOpenCases}>Open the case queue</button>
    </section>
  );
}

export function KpiStrip({ campus, totals, series, day, scenario, theme, cases, team, onOpenCases, onFocus, onUseWeather }) {
  const colors = RISK_COLORS[theme];
  const base = series[0];
  const all = campus.buildings.flatMap((b) => b.equipment);
  const overdue = all.filter((e) => e.lastServiceDaysAgo + day > e.serviceIntervalDays).length;
  const overdueToday = all.filter((e) => e.lastServiceDaysAgo > e.serviceIntervalDays).length;
  const highWork = all.filter((e) => e.work && (e.risk ?? 0) >= HIGH_RISK_MIN).length;

  // Soonest predicted failure among assets still in their forecast range.
  const next = all
    .filter((e) => e.risk != null && e.daysToFailure != null)
    .sort((a, b) => a.daysToFailure - b.daysToFailure || b.risk - a.risk)[0];
  const nextB = next && campus.buildings.find((b) => b.id === next.buildingId);
  const nextLevel = next && riskLevel(next.risk);

  return (
    <div className="kpi-strip" role="region" aria-label="Key figures">
      <CasesCard cases={cases} team={team} colors={colors} onOpenCases={onOpenCases} />

      <section className="kpi" data-tone={totals.highRisk > 0 ? 'critical' : 'healthy'}>
        <StatusLabel level={totals.highRisk > 0 ? LEVELS[3] : LEVELS[0]} colors={colors}>High risk</StatusLabel>
        <div className="kpi-value">{totals.highRisk}</div>
        {day > 0 ? <Delta now={totals.highRisk} then={base.highRisk} /> : <span className="kpi-delta">serious or critical assets</span>}
        {highWork > 0 && <span className="kpi-sub"><span className="tag-work">{highWork} being fixed</span></span>}
        <Sparkline series={series} field="highRisk" day={day} label="High-risk assets" />
      </section>

      <section className="kpi" data-tone={next ? nextLevel.key : undefined}>
        <StatusLabel level={nextLevel} colors={colors}>Next predicted failure</StatusLabel>
        {next ? (
          <>
            <div className="kpi-value kpi-value-text">{next.daysToFailure === 0 ? 'Now' : `~${durationText(next.daysToFailure)}`}</div>
            <span className="kpi-sub">
              <button className="link-btn" onClick={() => onFocus(next)}>{next.name}</button>
              {' '}· {nextB.kind === 'site' ? next.zone : `${nextB.name}, ${nextB.floors[next.level - 1].label}`}
            </span>
            <RiskBadge level={nextLevel} color={colors[nextLevel.key]} value={pct(next.risk)} />
          </>
        ) : (
          <span className="kpi-sub">None predicted within forecast ranges</span>
        )}
      </section>

      <section className="kpi" data-tone={totals.open > 0 ? 'watch' : 'healthy'}>
        <StatusLabel level={totals.open > 0 ? LEVELS[1] : LEVELS[0]} colors={colors}>Open problems</StatusLabel>
        <div className="kpi-value">{totals.open}</div>
        {day > 0 ? <Delta now={totals.open} then={base.open} /> : <span className="kpi-delta">assets at risk 30% or more</span>}
        <Sparkline series={series} field="open" day={day} label="Open problems" />
      </section>

      <section className="kpi" data-tone={overdue > 0 ? 'watch' : undefined}>
        <StatusLabel level={overdue > 0 ? LEVELS[1] : null} colors={colors}>Overdue checks</StatusLabel>
        <div className="kpi-value">{overdue}</div>
        {day > 0 ? <Delta now={overdue} then={overdueToday} /> : <span className="kpi-delta">service or inspection</span>}
        <span className="kpi-sub">of {all.length} assets{day > 0 ? `, if nothing is serviced until ${dayLabel(day)}` : ''}</span>
      </section>

      <WeatherCard day={day} scenario={scenario} onUseWeather={onUseWeather} />
    </div>
  );
}
