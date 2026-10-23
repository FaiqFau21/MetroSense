// Data assumptions page (CLAUDE.md section 9, milestone 7). Every figure below is
// read from the code that uses it, so this page cannot drift from the model.

import { campus, PLANTED, SEED, DEMO_TODAY } from '../data/seed.js';
import { CATALOGUE, GROUPS, FORECAST_STOPS, DATA_SOURCES, checkGap } from '../data/catalogue.js';
import {
  HISTORY_DAYS, INSPECTION_HISTORY_DAYS, MANUAL_HISTORY_READINGS, NOISE, MANUAL_NOISE, INSPECTION_NOISE, readingsFor,
} from '../data/readings.js';
import { WEIGHTS, MAX_REPORTS_TERM, riskTerms } from '../model/healthIndex.js';
import { COMPLAINTS, CHANNELS } from '../data/complaints.js';
import { ROUTING, PARTIES, OTHER_STATES, SLA_HOURS } from '../model/routing.js';
import { openReports } from '../model/cases.js';
import { SCENARIOS, STRESS, PROFILE_DAYS, FIT_DAYS, MIN_TREND, score } from '../model/forecast.js';
import {
  WEATHER, WEATHER_DAYS, WEATHER_LOCATION, CONDITIONS, HEAVY_RAIN_MM, HOT_DAY_C,
} from '../data/weather.js';
import { COSTS, ASSUMPTIONS, ACTION_AT, rm, durationText } from '../model/problem.js';
import { HIGH_RISK_MIN } from '../model/project.js';
import { REPLACEMENTS, REPLACE_AT, REPAIR_SHARE_MIN, UPGRADE_AFTER, UPGRADE_PAYBACK_YEARS, ENERGY } from '../model/replacement.js';
import { SPIKE_PAST_ALARM } from '../model/spike.js';
import { LEVELS, OPEN_PROBLEM_MIN, pct } from '../risk.js';
import { rangeLabel, dayLabel } from './ForecastBar.jsx';

const all = campus.buildings.flatMap((b) => b.equipment);
const buildingsOnly = campus.buildings.filter((b) => b.kind !== 'site');
const byId = Object.fromEntries(all.map((e) => [e.id, e]));
const bName = Object.fromEntries(campus.buildings.map((b) => [b.id, b.name]));
const intervalText = (d) => (d >= 360 ? `${Math.round(d / 365)} yr` : d >= 28 ? `${Math.round(d / 30)} mo` : `${Math.round(d / 7)} wk`);
const countBy = (source) => all.filter((e) => e.dataSource === source).length;
const pctOf = (x) => `${Math.round(x * 1000) / 10}%`;

// The risk formula, built from the live weights, with aligned comments.
const FORMULA = (() => {
  const lines = [
    [`risk = ${WEIGHTS.base}`, 'base rate'],
    [`     + ${WEIGHTS.age} × (age ÷ design life)^1.5`, 'age (age fraction capped at 1.5)'],
    [`     + ${WEIGHTS.drift} × drift²`, 'condition'],
    [`     + ${WEIGHTS.service} × overdue fraction`, 'service or inspection overdue'],
    [`     + ${WEIGHTS.report} × open resident reports`, `reports about this asset (max +${MAX_REPORTS_TERM})`],
  ];
  const w = Math.max(...lines.map(([code]) => code.length)) + 3;
  return `${lines.map(([code, note]) => code.padEnd(w) + note).join('\n')}\nclamped to 0 – 0.99`;
})();

function Table({ head, rows, caption }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Worked example: where the demo's headline number comes from.
function WorkedExample() {
  // As the app starts: the tenant's "Level 14 is warm" email is an open report.
  const seed = byId['A-L14-ahu-1'];
  const e = { ...seed, openReports: openReports(new Map()).get(seed.id) ?? 0 };
  const s = score(e, readingsFor(e), 0);
  const t = riskTerms({ ...e, drift: s.drift, daysSinceService: e.lastServiceDaysAgo });
  return (
    <Table
      caption={`${e.name}, ${bName[e.buildingId]} Level ${e.level}, today`}
      head={['Term', 'Input', 'Contribution']}
      rows={[
        ['Base rate', '-', pct(t.base)],
        ['Age', `${e.ageYears} of ${e.designLifeYears} years`, `+${pct(t.age)}`],
        ['Condition', `${Math.round(s.drift * 100)}% of the way from ${e.baseline} to ${e.threshold} ${e.unit}`, `+${pct(t.drift)}`],
        ['Service', `last ${e.lastServiceDaysAgo} days ago, every ${e.serviceIntervalDays} days`, `+${pct(t.service)}`],
        ['Resident reports', `${e.openReports} open (tenant email: Level 14 too warm)`, `+${pct(t.reports)}`],
        ['Risk', '', pct(s.risk)],
      ]}
    />
  );
}

export function AssumptionsPage({ onBack }) {
  const typeRows = Object.entries(CATALOGUE).map(([type, s]) => [
    s.label,
    GROUPS[s.group].label,
    DATA_SOURCES[s.dataSource].label,
    s.dataSource === 'sensor' ? 'daily' : intervalText(s.readingIntervalDays),
    `${s.metric} (${s.unit})`,
    s.baseline,
    s.threshold,
    `${s.designLifeYears} yr`,
    intervalText(s.serviceIntervalDays),
    durationText(s.warningDays),
    checkGap(s) ? `No: every ${durationText(Math.floor(s.warningDays / 2))} needed` : 'Yes',
    rangeLabel(s.horizonDays),
    all.filter((e) => e.type === type).length,
  ]);

  const scenarioRows = Object.values(SCENARIOS).map((sc) => [sc.label, sc.when, sc.note]);
  const stressRows = Object.entries(STRESS).map(([kind, types]) => [
    kind === 'rain' ? 'Heavy-rain day' : 'Hot day',
    Object.entries(types)
      .map(([type, x]) => `${CATALOGUE[type].label}: trend × ${x.factor}, plus ${pctOf(x.extra)} of range`)
      .join('; '),
  ]);
  const weatherRows = WEATHER.map((w) => [
    `${w.weekday} ${w.date}`, CONDITIONS[w.condition], `${w.maxC}° / ${w.minC}°`, `${w.rainMm} mm`,
    w.stress === 'rain' ? 'Rain stress' : w.stress === 'heat' ? 'Heat stress' : '-',
  ]);

  const costRows = Object.entries(COSTS).map(([type, c]) => [
    CATALOGUE[type].label, rm(c.planned), rm(c.emergency), rm(c.emergency - c.planned),
  ]);

  const plantedRows = Object.entries(PLANTED).map(([id, p]) => {
    const e = byId[id];
    return [
      e.name,
      e.wx != null ? `${bName[e.buildingId]}, ${e.zone}` : `${bName[e.buildingId]}, ${e.level === 1 ? 'Ground' : `Level ${e.level}`}`,
      pct(p.risk), durationText(p.daysToFailure), p.fault,
    ];
  });

  return (
    <main className="page" id="assumptions">
      <div className="page-inner">
        <button className="btn btn-quiet" onClick={onBack}>← Back to the campus</button>
        <h1 className="page-title">Data assumptions</h1>
        <p className="lead">
          Everything in this demo is simulated. Each number on screen comes from a dummy reading or from one of
          the assumptions below. Nothing here is real Sime Darby data.
        </p>

        <section className="card">
          <h2>About the data</h2>
          <ul className="plain">
            <li>Scenario: {campus.scenario}. The four buildings are illustrative masses, not the real buildings, and floor layouts are generic.</li>
            <li>
              {buildingsOnly.length} buildings ({buildingsOnly.reduce((n, b) => n + b.floorCount, 0)} floors) plus the public realm
              around them, {all.length} assets in all, generated from a fixed random seed ({SEED}), so the demo is the same every run.
            </li>
            <li>"Today" is fixed at {DEMO_TODAY}.</li>
            <li>Daily-sensor assets ({countBy('sensor')}) have {HISTORY_DAYS} daily readings with ±{pctOf(NOISE)} noise (as a share of the normal-to-alarm range). Technician-read assets ({countBy('manual')}) have their last {MANUAL_HISTORY_READINGS} walk-round readings, ±{pctOf(MANUAL_NOISE)}. Inspection assets ({countBy('inspection')}) have one reading per scheduled inspection over the last {Math.round(INSPECTION_HISTORY_DAYS / 365)} years, ±{pctOf(INSPECTION_NOISE)}.</li>
            <li>Only daily-sensor assets can be hit by "Simulate sensor spike".</li>
            <li>This is a transparent formula with straight-line trends. It is not a trained machine-learning model. A model like that needs real sensor history plus work orders that record when assets actually failed.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Risk score</h2>
          <pre className="formula">{FORMULA}</pre>
          <ul className="plain">
            <li><strong>Drift</strong>: how far the metric has moved from its normal level towards its alarm level (0 = normal, 1 = alarm).</li>
            <li><strong>Overdue fraction</strong>: days past the service interval ÷ the interval, from 0 up to a maximum of 1.</li>
            <li>Bands: {LEVELS.map((l, i) => `${l.label} ${pct(l.min)}${LEVELS[i + 1] ? `–${pct(LEVELS[i + 1].min)}` : ' and above'}`).join(' · ')}. An <strong>open problem</strong> is {pct(OPEN_PROBLEM_MIN)} or more; <strong>high risk</strong> is {pct(HIGH_RISK_MIN)} or more.</li>
          </ul>
          <h3>Worked example</h3>
          <WorkedExample />
        </section>

        <section className="card">
          <h2>Forecast</h2>
          <ul className="plain">
            <li>Trend: a straight line fitted to the last {FIT_DAYS} days of sensor readings, or the last 3 technician readings or inspections. Trends below {pctOf(MIN_TREND.sensor)} (sensor), {pctOf(MIN_TREND.manual)} (technician) or {pctOf(MIN_TREND.inspection)} (inspection) of range per day count as flat.</li>
            <li>Technician and inspection readings are carried forward from the last reading to today along the trend.</li>
            <li>"No action": the forecast assumes nobody services the asset, so age grows and servicing falls further overdue as the slider moves.</li>
            <li>Time to failure is when the trend line reaches the alarm level. Recommended timing is at {pct(ACTION_AT)} of that time, outside office hours.</li>
            <li>Slider stops: {FORECAST_STOPS.map(dayLabel).join(', ')}. Each asset is forecast only up to the first stop that covers its warning time.</li>
            <li>Past that range, an asset that is already a problem ({pct(OPEN_PROBLEM_MIN)} or more) at the end of its range keeps at least that risk, shown as "≥": an unfixed problem does not go away. An asset still healthy at the end of its range shows as "Beyond range" and is not counted, because we do not claim to know how it will be that far ahead.</li>
            <li>Suggested range per view: campus +5 years (budget), building +1 year (annual plan), floor +90 days (this quarter), one asset its own range.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Asset types</h2>
          <p className="meta">
            Typical industry rules of thumb, used as assumptions. Replace them with the facilities team's own records.
            "Daily sensor" means the BMS or the equipment's own controller already logs it, which is usual for big
            plant. "Technician" means a person reads a gauge or meter on a walk-round. "Checked often enough?" uses
            the rule of thumb that readings should come at least twice within the warning time.
          </p>
          <Table
            head={['Type', 'Group', 'Data', 'Readings', 'Metric', 'Normal', 'Alarm', 'Design life', 'Service / inspection', 'Warning time', 'Checked often enough?', 'Forecast up to', 'Assets']}
            rows={typeRows}
          />
        </section>

        <section className="card">
          <h2>Scenarios</h2>
          <p className="meta">
            Each scenario marks some days as heavy-rain or hot days. On those days the affected asset types degrade
            faster; after them the normal trend resumes. Nothing is stressed beyond {PROFILE_DAYS} days.
          </p>
          <Table head={['Scenario', 'Stressed days', 'Description']} rows={scenarioRows} />
          <h3>Effect of one stressed day</h3>
          <Table head={['Day type', 'Affected assets (extra drift per day)']} rows={stressRows} />
        </section>

        <section className="card">
          <h2>Weather forecast</h2>
          <p className="meta">
            A hand-written, simulated {WEATHER_DAYS}-day forecast for {WEATHER_LOCATION}, not real data. A day with{' '}
            {HEAVY_RAIN_MM} mm of rain or more counts as heavy rain; a maximum of {HOT_DAY_C}°C or more counts as
            hot. These thresholds are assumptions. A live forecast could replace this table later without changing
            the model.
          </p>
          <Table head={['Day', 'Condition', 'Max / min', 'Rain', 'Stress']} rows={weatherRows} />
        </section>

        <section className="card">
          <h2>Resident reports and who fixes what</h2>
          <ul className="plain">
            <li>
              {COMPLAINTS.length} simulated reports from{' '}
              {[...new Set(COMPLAINTS.map((c) => CHANNELS[c.channel]))].join(', ')}. In a pilot they would come from the SDP
              resident app and other channels; nothing here is connected to a real app. Reports are anonymised, as PDPA
              requires: no names, phone numbers or unit numbers, and faces and number plates in photos would be blurred.
            </li>
            <li>Reports about the same asset become one case. Reports about things not in the asset register (such as a rental water dispenser) are routed by category.</li>
            <li>Each open report adds {pct(WEIGHTS.report)} to the asset's risk (up to {pct(MAX_REPORTS_TERM)}), because a resident often notices a fault before the next scheduled reading.</li>
            <li>The model also opens a case, with no report needed, for any asset at {pct(HIGH_RISK_MIN)} risk or more today or within 7 days using the weather forecast.</li>
            <li>
              Priority: P1 if risk is {pct(0.7)} or more, or a reported safety issue at {pct(HIGH_RISK_MIN)} or more; P2 if risk is{' '}
              {pct(HIGH_RISK_MIN)} or more, there are 2 or more reports, or any reported safety issue; otherwise P3. Assign within{' '}
              {Object.entries(SLA_HOURS).map(([p, h]) => `${p} ${h} h`).join(', ')}.
            </li>
            <li>Resolving a case resets the asset to its normal reading with a new service date, and closes its reports. That is how maintenance records feed back into the forecast.</li>
          </ul>
          <h3>Routing table: {ROUTING.township} ({ROUTING.state})</h3>
          <p className="meta">Built from general knowledge as an assumption. Confirm with SDP township management before a pilot.</p>
          <Table
            head={['Covers', 'Responsible', 'Sent via', 'Why']}
            rows={ROUTING.rules.map((r) => [
              (r.types ?? []).map((t) => CATALOGUE[t].label).concat(r.categories ?? []).join(', '),
              PARTIES[r.party].name, PARTIES[r.party].channel, r.why,
            ])}
          />
          <h3>The same table differs by state</h3>
          <Table head={['Townships', 'Household waste collection (example)']} rows={OTHER_STATES} />
        </section>

        <section className="card">
          <h2>Costs and impact</h2>
          <p className="meta">{ASSUMPTIONS.note}</p>
          <Table head={['Type', 'Planned repair', 'Emergency failure', 'Avoided by fixing early']} rows={costRows} />
          <ul className="plain">
            <li>Occupancy: {ASSUMPTIONS.occupantsPerOfficeFloor} people per office floor, {ASSUMPTIONS.occupantsGroundFloor} on the ground floor, none on the roof-plant level.</li>
            <li>People using public-realm assets on a typical day: {Object.entries(ASSUMPTIONS.publicUsers).map(([t, n]) => `${CATALOGUE[t].label.toLowerCase()} ${n}`).join(', ')}.</li>
            <li>Impact text and recommended actions are fixed rules per asset type and fault, not generated.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Repair or replace</h2>
          <ul className="plain">
            <li>Replace now: {pct(REPLACE_AT.now)} or more of design life used; or {pct(REPLACE_AT.plan)} or more with an open problem whose planned repair costs at least {pct(REPAIR_SHARE_MIN)} of a new unit (a filter or belt change never triggers replacement).</li>
            <li>Plan the replacement: {pct(REPLACE_AT.plan)} or more of design life used; it goes in the capital plan for the year its design life runs out.</li>
            <li>Upgrade early: past {pct(UPGRADE_AFTER)} of design life and the energy saving pays back the installed cost within {UPGRADE_PAYBACK_YEARS} years.</li>
            <li>Energy is valued at RM {ENERGY.tariffRm.toFixed(2)} per kWh (approximate commercial tariff) and carbon at {ENERGY.gridKgCo2PerKwh} kg CO₂e per kWh (approximate Peninsular Malaysia grid factor).</li>
          </ul>
          <Table
            head={['Type', 'Replacement', 'Installed cost', 'Energy saved per year', 'Pays back in']}
            rows={Object.entries(REPLACEMENTS).map(([t, r]) => [
              CATALOGUE[t].label, r.to, rm(r.capex),
              r.kwhSaved ? `${r.kwhSaved.toLocaleString('en-MY')} kWh · ${rm(Math.round(r.kwhSaved * ENERGY.tariffRm))}` : 'None',
              r.kwhSaved ? `${Math.round((r.capex / (r.kwhSaved * ENERGY.tariffRm)) * 10) / 10} years` : '–',
            ])}
          />
        </section>

        <section className="card">
          <h2>Assets set up for the demo</h2>
          <p className="meta">
            These assets have their drift and trend chosen so the demo script holds. The same formulas still
            produce every figure shown for them.
          </p>
          <Table head={['Asset', 'Where', 'Risk today', 'Time to failure', 'Fault']} rows={plantedRows} />
          <ul className="plain">
            <li>Sensor spike: today's reading of a healthy live-sensor asset jumps {pct(SPIKE_PAST_ALARM[0])}–{pct(SPIKE_PAST_ALARM[1])} past its alarm level. The first press is always Lift 1 on Office Block C; later presses follow a fixed sequence.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
