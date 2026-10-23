// One asset at three levels of detail:
// - AssetSummary variant="row": the side-panel drop-down (problem, timing, button)
// - AssetSummary variant="popover": the map pop-up (adds action, impact, case)
// - AssetDetail: the full detail window (evidence chart, lifecycle, cost, why)

import { Suspense, lazy, useMemo, useState } from 'react';
import { maintenanceLog, nextDue, LOG_YEARS } from '../model/maintenanceLog.js';
import { describe } from '../data/descriptions.js';
import { RISK_COLORS, OPEN_PROBLEM_MIN, riskLevel, pct } from '../risk.js';
import { riskTerms, overdueFraction } from '../model/healthIndex.js';
import { CATALOGUE, GROUPS, DATA_SOURCES, checkGap } from '../data/catalogue.js';
import { RiskBadge } from './RiskIcon.jsx';
import { readingsOf } from '../model/project.js';
import { forecast, score, FIT_DAYS, SCENARIOS } from '../model/forecast.js';
import { dayLabel, rangeLabel } from './ForecastBar.jsx';
import { impactOf, actionOf, costOf, rm, durationText, ASSUMPTIONS, ACTION_AT } from '../model/problem.js';
import { plural, intervalText, failureText, fmtNum, daysAgoText, riskText } from './format.js';
import { replacementAdvice, REPLACEMENTS, ENERGY } from '../model/replacement.js';

// The chart library is only needed once the detail window opens.
const ForecastChart = lazy(() => import('./ForecastChart.jsx').then((m) => ({ default: m.ForecastChart })));

export const placeOf = (e, b) => (b.kind === 'site' ? e.zone : `${b.name} · ${b.floors[e.level - 1].label} · ${e.zone}`);

// Today's score plus what follows from it. Scenarios never change today.
function useFacts(e, b) {
  return useMemo(() => {
    const readings = readingsOf(e);
    const today = score(e, readings, 0, 'normal');
    const overdueDays = Math.max(0, e.lastServiceDaysAgo - e.serviceIntervalDays);
    return {
      readings, today, overdueDays,
      action: actionOf(e, today.daysToFailure, overdueDays),
      impact: impactOf(e, b),
    };
  }, [e, b]);
}

function CaseLine({ openCase, onOpenCase }) {
  if (!openCase) return null;
  return (
    <p className="case-link">
      <span>
        Case <strong>{openCase.id}</strong> · {openCase.status}
        {openCase.status !== 'Resolved' && <> · {openCase.party.name}</>}
        {openCase.reports.length > 0 && <> · {plural(openCase.reports.length, 'report')}</>}
      </span>
      <button className="link-btn" onClick={() => onOpenCase(openCase.id)}>Open case</button>
    </p>
  );
}

const LOG_KIND = {
  install: 'Installed', service: 'Service', inspection: 'Inspection', reading: 'Reading',
  repair: 'Repair', report: 'Report', case: 'Case', alert: 'Alert',
};
const LOG_FILTERS = [
  ['all', 'All', null],
  ['upkeep', 'Services and checks', ['install', 'service', 'inspection', 'reading']],
  ['repair', 'Repairs', ['repair']],
  ['reports', 'Reports and cases', ['report', 'case', 'alert']],
];
const LOG_SHOWN = 8;

// Everything done to or reported about this asset, newest first.
function MaintenanceLog({ e, openCase }) {
  const entries = useMemo(() => maintenanceLog(e, openCase), [e, openCase]);
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const kinds = LOG_FILTERS.find(([k]) => k === filter)[2];
  const list = kinds ? entries.filter((x) => kinds.includes(x.kind)) : entries;
  const shown = showAll ? list : list.slice(0, LOG_SHOWN);
  const count = (ks) => (ks ? entries.filter((x) => ks.includes(x.kind)).length : entries.length);

  return (
    <section className="detail-section detail-log">
      <div className="log-head">
        <h3>Maintenance log</h3>
        <div className="segmented log-filter" role="radiogroup" aria-label="Show log entries">
          {LOG_FILTERS.map(([k, label, ks]) => (
            <button key={k} type="button" role="radio" aria-checked={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => { setFilter(k); setShowAll(false); }}>
              {label} ({count(ks)})
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty">Nothing of this kind in the last {LOG_YEARS} years.</p>
      ) : (
        <ol className="log">
          {shown.map((x, i) => (
            <li key={`${x.daysAgo}-${x.kind}-${i}`} className={`log-${x.kind}`}>
              <span className="log-date">{x.date}</span>
              <span className="log-kind">{LOG_KIND[x.kind]}</span>
              <span className="log-body">
                <strong>{x.title}</strong>
                {x.detail && <span>{x.detail}</span>}
                {x.by && <span className="meta">{x.by}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {list.length > LOG_SHOWN && (
        <button type="button" className="link-btn log-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${list.length} entries`}
        </button>
      )}
      <p className="meta">
        Routine entries cover the last {LOG_YEARS} years. Simulated: services follow each asset's service interval and readings,
        past repairs are generated from a fixed seed, and reports and case updates are the ones in this demo.
      </p>
    </section>
  );
}

const VERDICT = {
  replace: 'Replace rather than repair',
  upgrade: 'Upgrade early: it pays for itself',
  plan: 'Repair now, plan the replacement',
};

// Repair or replace, with the energy case where there is one.
function ReplaceSection({ advice, e }) {
  if (!REPLACEMENTS[e.type]) return null;
  if (!advice) {
    return (
      <section className="detail-section">
        <h3>Repair or replace?</h3>
        <p className="detail-line">Repair as usual: about {Math.max(0, Math.round(e.designLifeYears - e.ageYears))} years of design life left.</p>
      </section>
    );
  }
  return (
    <section className="detail-section">
      <h3>Repair or replace?</h3>
      <div className={`action replace-${advice.verdict}`}>
        <strong>{VERDICT[advice.verdict]}{advice.verdict === 'plan' ? ` (${advice.planYear} capital plan)` : ''}</strong>
        <span>{advice.why}.</span>
      </div>
      <table className="terms terms-wrap">
        <tbody>
          <tr><td>Replacement</td><td>{advice.to}</td></tr>
          <tr><td>Installed cost</td><td>{rm(advice.capex)}</td></tr>
          {advice.kwhSaved > 0 ? (
            <>
              <tr><td>Energy saved</td><td>{advice.kwhSaved.toLocaleString('en-MY')} kWh/yr · {rm(advice.rmPerYear)}/yr</td></tr>
              <tr><td>Carbon avoided</td><td>{advice.co2Tonnes} t CO₂e/yr</td></tr>
              <tr className="terms-total"><td>Pays back in</td><td>~{advice.paybackYears} years</td></tr>
            </>
          ) : (
            <tr><td>Energy saved</td><td>None expected</td></tr>
          )}
        </tbody>
      </table>
      <p className="meta">
        Assumed costs and savings at RM {ENERGY.tariffRm.toFixed(2)}/kWh and {ENERGY.gridKgCo2PerKwh} kg CO₂e/kWh. Rule-based: see Assumptions.
      </p>
    </section>
  );
}

export function AssetSummary({ e, b, theme, day, variant = 'row', openCase, onOpenCase, onDetails }) {
  const colors = RISK_COLORS[theme];
  const { today, action, impact } = useFacts(e, b);
  const advice = replacementAdvice(e, today.risk);
  const l = riskLevel(today.risk);
  const lDay = riskLevel(e.risk);
  // The problem shown is the one at the chosen forecast day (the map's colour).
  const problemNow = today.risk >= OPEN_PROBLEM_MIN;
  const problemAtDay = e.risk != null && e.risk >= OPEN_PROBLEM_MIN;
  const hasProblem = problemNow || problemAtDay;
  const popover = variant === 'popover';

  return (
    <div className={`asset-summary asset-summary-${variant}`}>
      <div className="summary-badges">
        <RiskBadge level={l} color={colors[l.key]} value={`${pct(today.risk)} today`} />
        {day > 0 && (
          e.risk == null
            ? <span className="chip">Not forecast to {dayLabel(day)}</span>
            : <RiskBadge level={lDay} color={colors[lDay.key]} value={`${riskText(e)} at ${dayLabel(day)}`} />
        )}
        {e.work && <span className="tag-work">Repair {e.work.toLowerCase()}</span>}
      </div>
      {e.held && (
        <p className="note note-watch">
          Past its {rangeLabel(e.horizonDays)} forecast range. Without a fix it stays at least this bad.
        </p>
      )}
      {e.spike && <p className="note note-critical">Sensor spike: reading jumped past its alarm.</p>}
      {e.repaired && <p className="note note-healthy">Repaired today; condition reset.</p>}
      {hasProblem ? (
        <p className="summary-problem">
          <span className="summary-label">{problemNow ? 'Problem' : `Predicted by ${dayLabel(day)}`}</span>
          <strong>{e.fault}</strong>
        </p>
      ) : (
        <p className="summary-ok">No open problem {day ? `by ${dayLabel(day)}` : 'today'}.</p>
      )}
      <dl className="summary-facts">
        <div><dt>Time to failure</dt><dd>{failureText(today.daysToFailure, e.horizonDays)}</dd></div>
        {(hasProblem || action.overdueNote) && (
          <div><dt>Action</dt><dd>{popover ? <><strong>{action.what}</strong> · {action.when}</> : action.when}</dd></div>
        )}
        {popover && hasProblem && (
          <div>
            <dt>If it fails</dt>
            <dd>{impact.text}{impact.occupants > 0 && ` · ~${impact.occupants.toLocaleString('en-MY')} people`}</dd>
          </div>
        )}
        {popover && advice && advice.verdict !== 'plan' && (
          <div>
            <dt>{advice.verdict === 'replace' ? 'Replace' : 'Upgrade'}</dt>
            <dd>{advice.to}{advice.rmPerYear > 0 && ` · saves ${rm(advice.rmPerYear)}/yr`}</dd>
          </div>
        )}
      </dl>
      {popover && <CaseLine openCase={openCase} onOpenCase={onOpenCase} />}
      <div className="summary-actions">
        <button className="btn btn-small" onClick={onDetails}>See details</button>
        {!popover && openCase && (
          <button className="btn btn-quiet btn-small" onClick={() => onOpenCase(openCase.id)}>Open case</button>
        )}
      </div>
    </div>
  );
}

export function AssetDetail({ e, b, theme, day, scenario, openCase, onOpenCase }) {
  const colors = RISK_COLORS[theme];
  const { readings, overdueDays, action, impact } = useFacts(e, b);
  const horizon = e.horizonDays;
  const inspection = e.dataSource === 'inspection';
  const periodic = e.dataSource !== 'sensor'; // technician or inspection readings
  const step = horizon > 90 ? Math.ceil(horizon / 60) : 1;
  const fc = useMemo(() => forecast(e, readings, horizon, scenario, step), [e, readings, horizon, scenario, step]);
  const today = fc[0];

  // Second KPI: the chosen forecast day, or this asset's own horizon at "today".
  const inRange = day <= horizon;
  const laterDay = day > 0 ? day : horizon;
  const later = laterDay <= horizon ? score(e, readings, laterDay, scenario) : null;
  // Past the range, an unfixed problem holds at its risk at the horizon.
  const atDay = score(e, readings, Math.min(day, horizon), scenario);
  const l = riskLevel(today.risk);
  const lLater = riskLevel(later?.risk);
  const hasProblem = atDay.risk >= OPEN_PROBLEM_MIN;
  const predictedOnly = hasProblem && today.risk < OPEN_PROBLEM_MIN;

  const t = riskTerms({ ...e, drift: today.drift, daysSinceService: e.lastServiceDaysAgo });
  const cost = costOf(e);
  const advice = replacementAdvice(e, today.risk);
  const due = nextDue(e);
  const last = readings[readings.length - 1];
  const span = e.threshold - e.baseline;
  const verb = inspection ? 'Inspected' : 'Serviced';
  const lastWord = inspection ? 'inspection' : 'technician reading';
  const fitWord = !periodic ? `last ${FIT_DAYS} days` : inspection ? 'last 3 inspections' : 'last 3 readings';
  const dataText = !periodic
    ? DATA_SOURCES.sensor.long
    : `${inspection ? 'Inspection' : 'Technician reading'} every ${intervalText(e.readingIntervalDays)}`;
  const trend = today.trendPerDay > 0
    ? inspection
      ? `+${fmtNum(today.trendPerDay * 365 * span)} ${e.unit} per year`
      : `+${(today.trendPerDay * span).toFixed(2)} ${e.unit} per day`
    : 'flat';

  return (
    <div className="detail">
      <p className="detail-desc">{describe(e, b)}</p>
      <CaseLine openCase={openCase} onOpenCase={onOpenCase} />
      {e.repaired && (
        <p className="note note-healthy" role="status">Repaired today: its case was resolved, so the condition and service date were reset.</p>
      )}
      {e.spike && (
        <p className="note note-critical" role="status">
          Simulated sensor spike: today's reading jumped to {e.spike.value} {e.unit}, past the {e.threshold} {e.unit} alarm.
        </p>
      )}
      {!inRange && (atDay.risk >= OPEN_PROBLEM_MIN ? (
        <p className="note note-watch">
          {dayLabel(day)} is past this asset's forecast range ({rangeLabel(horizon)}, set by its warning time). It is
          already a problem by then, so without a fix it stays at least {pct(atDay.risk)}.
        </p>
      ) : (
        <p className="note note-neutral">
          {dayLabel(day)} is past this asset's forecast range ({rangeLabel(horizon)}, set by its warning time).
          Showing today and the furthest forecast instead.
        </p>
      ))}
      {hasProblem ? (
        <p className="detail-problem" style={{ '--risk': colors[riskLevel(atDay.risk).key] }}>
          <span>{predictedOnly ? `Predicted problem by ${dayLabel(day)}` : 'Problem'}</span>
          <strong>{e.fault}</strong>
        </p>
      ) : (
        <p className="summary-ok">No open problem {inRange && day ? `by ${dayLabel(day)}` : 'today'}.</p>
      )}

      <dl className="kpis">
        <div>
          <dt>Risk today</dt>
          <dd><RiskBadge level={l} color={colors[l.key]} value={pct(today.risk)} /></dd>
        </div>
        <div>
          <dt>At {dayLabel(laterDay)}, no action</dt>
          <dd>
            {later
              ? <RiskBadge level={lLater} color={colors[lLater.key]} value={pct(later.risk)} />
              : <span className="kpi-note">Not forecast</span>}
          </dd>
        </div>
        <div>
          <dt>Time to failure</dt>
          <dd className="kpi-num">{failureText(today.daysToFailure, horizon)}</dd>
        </div>
      </dl>

      <div className="detail-grid">
        <div className="detail-col">
          <section className="detail-section">
            <h3>Evidence: {e.metric} ({e.unit})</h3>
            <Suspense fallback={<div className="chart-loading">Loading chart…</div>}>
              <ForecastChart
                readings={readings} forecast={fc} baseline={e.baseline} threshold={e.threshold}
                unit={e.unit} theme={theme} horizon={horizon} periodic={periodic}
                pointLabel={!periodic ? 'Measured' : inspection ? 'Inspections' : 'Technician readings'}
                markDay={inRange ? day : 0}
              />
            </Suspense>
            <p className="meta">
              {periodic
                ? `Last ${lastWord} ${daysAgoText(-last.day)}: ${fmtNum(last.value)} ${e.unit}; estimated today ${fmtNum(today.value)} ${e.unit}.`
                : `Now ${fmtNum(last.value)} ${e.unit}.`}{' '}
              Normal {e.baseline} · alarm {e.threshold}. Trend from the {fitWord}: {trend}
              {today.stressDays > 0 &&
                `; the ${SCENARIOS[scenario].label.toLowerCase()} scenario adds stress on ${plural(today.stressDays, 'day')}`}.
            </p>
          </section>

          <section className="detail-section">
            <h3>Why {pct(today.risk)} today</h3>
            <table className="terms">
              <tbody>
                <tr><td>Base rate</td><td>{pct(t.base)}</td></tr>
                <tr><td>Age: {e.ageYears} of {e.designLifeYears} years design life</td><td>+{pct(t.age)}</td></tr>
                <tr><td>Condition: {Math.round(today.drift * 100)}% of the way from normal to alarm</td><td>+{pct(t.drift)}</td></tr>
                <tr>
                  <td>
                    {inspection ? 'Inspection' : 'Service'}:{' '}
                    {overdueDays > 0
                      ? `overdue by ${durationText(overdueDays)} (${pct(overdueFraction(e.lastServiceDaysAgo, e.serviceIntervalDays))} of an interval)`
                      : 'on schedule'}
                  </td>
                  <td>+{pct(t.service)}</td>
                </tr>
                {t.reports > 0 && (
                  <tr>
                    <td>Reports: {plural(e.openReports, 'open report')} about this asset</td>
                    <td>+{pct(t.reports)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        <div className="detail-col">
          {(hasProblem || action.overdueNote) && (
            <section className="detail-section">
              <h3>Recommended action</h3>
              <div className={`action action-${action.urgency}`}>
                <strong>{action.what}</strong>
                <span>{action.when}</span>
                {action.overdueNote && <span className="overdue">{action.overdueNote}</span>}
              </div>
              <p className="meta">Rule-based for the demo: chosen from the fault type, timed at {pct(ACTION_AT)} of the predicted time to failure.</p>
            </section>
          )}

          <ReplaceSection advice={advice} e={e} />

          {hasProblem && (
            <section className="detail-section">
              <h3>Impact if it fails</h3>
              <p className="detail-line">
                {impact.text}
                {impact.occupants > 0 && <span className="meta"> · about {impact.occupants.toLocaleString('en-MY')} people affected</span>}
              </p>
            </section>
          )}

          {hasProblem && (
            <section className="detail-section">
              <h3>Cost</h3>
              <table className="terms">
                <tbody>
                  <tr><td>Planned repair</td><td>{rm(cost.planned)}</td></tr>
                  <tr><td>Emergency failure</td><td>{rm(cost.emergency)}</td></tr>
                  <tr className="terms-total"><td>Avoided by fixing early</td><td>{rm(cost.avoided)}</td></tr>
                </tbody>
              </table>
              <p className="meta">{ASSUMPTIONS.note}</p>
            </section>
          )}

          <section className="detail-section">
            <h3>Lifecycle and servicing</h3>
            <dl className="lifecycle">
              <div><dt>Model</dt><dd>{e.model}</dd></div>
              <div>
                <dt>Next {inspection ? 'inspection' : 'service'}</dt>
                <dd>
                  {due.overdue
                    ? <strong className="overdue">was due {due.date}</strong>
                    : <>{due.date} · in {durationText(due.inDays)}</>}
                </dd>
              </div>
              <div><dt>Design life</dt><dd>{e.designLifeYears} years · now {e.ageYears} years old (installed {e.installedYear})</dd></div>
              <div>
                <dt>{verb} every</dt>
                <dd>
                  {intervalText(e.serviceIntervalDays)} · last {daysAgoText(e.lastServiceDaysAgo)} ·{' '}
                  {overdueDays > 0 ? <strong className="overdue">overdue by {durationText(overdueDays)}</strong> : 'on schedule'}
                </dd>
              </div>
              <div><dt>Warning time</dt><dd>typically {durationText(e.warningDays)} from first sign to failure</dd></div>
              <div><dt>Forecast range</dt><dd>up to {rangeLabel(horizon)}</dd></div>
              <div><dt>Data</dt><dd>{dataText}{e.openReports ? ` · ${plural(e.openReports, 'open report')}` : ''}</dd></div>
            </dl>
            {checkGap(e) && (
              <p className="note note-watch">
                Checked every {intervalText(e.readingIntervalDays)}, but this kind of fault gives about{' '}
                {durationText(e.warningDays)} of warning, so it can develop between checks. Check at least every{' '}
                {durationText(Math.floor(e.warningDays / 2))}, or add a sensor.
                {e.group === 'public' && ' Reports help cover the gap.'}
              </p>
            )}
          </section>
        </div>
      </div>
      <MaintenanceLog e={e} openCase={openCase} />
      <p className="meta detail-foot">Simulated data. Normal and alarm levels, design life, service intervals, warning times, occupancy and costs are stated assumptions.</p>
    </div>
  );
}

export const assetEyebrow = (e) => `${GROUPS[e.group].label} · ${CATALOGUE[e.type].label}`;
