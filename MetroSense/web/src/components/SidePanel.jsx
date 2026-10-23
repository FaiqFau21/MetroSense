import { useEffect, useMemo } from 'react';
import { LEVELS, BEYOND_RANGE, RISK_COLORS, OPEN_PROBLEM_MIN, summarize, riskLevel, pct } from '../risk.js';
import { CATALOGUE, GROUPS, DATA_SOURCES } from '../data/catalogue.js';
import { RiskBadge, RiskIcon } from './RiskIcon.jsx';
import { SCENARIOS } from '../model/forecast.js';
import { dayLabel, rangeLabel } from './ForecastBar.jsx';
import { durationText, rm } from '../model/problem.js';
import { replacementSummary } from '../model/replacement.js';
import { AssetSummary } from './AssetDetail.jsx';
import { plural, intervalText, range, riskText } from './format.js';

function CountsRow({ counts, colors }) {
  return (
    <ul className="counts">
      {LEVELS.map((l) => (
        <li key={l.key}>
          <RiskIcon level={l} color={colors[l.key]} size={12} />
          <span className="counts-n">{counts[l.key]}</span>
          <span className="counts-label">{l.label}</span>
        </li>
      ))}
      {counts.none > 0 && (
        <li>
          <RiskIcon level={BEYOND_RANGE} color={colors.none} size={12} />
          <span className="counts-n">{counts.none}</span>
          <span className="counts-label">beyond forecast range</span>
        </li>
      )}
    </ul>
  );
}

function Breadcrumb({ items }) {
  return (
    <nav className="crumbs" aria-label="Location">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
          {it.onClick ? (
            <button className="crumb" onClick={it.onClick}>{it.label}</button>
          ) : (
            <span className="crumb is-current" aria-current="page">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ---------- Campus ---------- */

// Shown in place of a list or count that has nothing in it.
function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

function CampusPanel({ campus, colors, when, onSelectBuilding }) {
  const all = useMemo(() => campus.buildings.flatMap((b) => b.equipment), [campus]);
  const total = summarize(all);
  const rep = useMemo(() => replacementSummary(all), [all]);
  const realBuildings = campus.buildings.filter((b) => b.kind !== 'site');
  const floors = realBuildings.reduce((n, b) => n + b.floorCount, 0);
  return (
    <>
      <section className="card card-overview">
        <p className="eyebrow">Ara Damansara · demo</p>
        <h2>Campus overview</h2>
        <dl className="stats">
          <div><dt>Buildings</dt><dd>{realBuildings.length}</dd></div>
          <div><dt>Floors</dt><dd>{floors}</dd></div>
          <div><dt>Assets</dt><dd>{total.total}</dd></div>
          <div><dt>Open problems</dt><dd>{total.openProblems}</dd></div>
        </dl>
        <CountsRow counts={total.counts} colors={colors} />
        {total.openProblems === 0 && <Empty>No open problems anywhere on campus {when}.</Empty>}
        {rep.count > 0 && (
          <p className="replace-line">
            <strong>Replace or upgrade now: {plural(rep.count, 'asset')}</strong>
            <span>{rm(rep.capex)} installed · saves {rm(rep.rmPerYear)} and {rep.co2Tonnes} t CO₂e a year (assumed)</span>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Buildings and streets</h2>
        {campus.buildings.length === 0 && <Empty>No buildings in this campus yet.</Empty>}
        <ul className="row-list">
          {campus.buildings.map((b) => {
            const s = summarize(b.equipment);
            return (
              <li key={b.id}>
                <button className="row row-risk" style={{ '--risk': colors[s.level.key] }} onClick={() => onSelectBuilding(b.id)}>
                  <span className="row-main">
                    <strong>{b.name}</strong>
                    <span className="meta">
                      {b.kind === 'site' ? `Streets, drains & park · ${b.equipment.length} assets` : `${b.floorCount} floors`}
                      {' · '}{plural(s.openProblems, 'open problem')}
                    </span>
                  </span>
                  <RiskBadge level={s.level} color={colors[s.level.key]} value={pct(s.worst?.risk)} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="card card-fold">
        <summary><h2>Risk bands and how risk is scored</h2></summary>
        <Legend colors={colors} asOf={campus.asOf} scenario={campus.scenario} />
      </details>
      <details className="card card-fold">
        <summary><h2>Asset groups and forecast ranges</h2></summary>
        <AssetGroups all={all} />
      </details>
    </>
  );
}

// Lifecycle assumptions per asset group, so the forecast ranges are traceable.
function AssetGroups({ all }) {
  const rows = Object.entries(GROUPS).map(([key, g]) => {
    const specs = Object.values(CATALOGUE).filter((s) => s.group === key);
    const min = (k) => Math.min(...specs.map((s) => s[k]));
    const max = (k) => Math.max(...specs.map((s) => s[k]));
    const inspected = specs.every((s) => s.dataSource === 'inspection');
    const sources = [...new Set(specs.map((s) => DATA_SOURCES[s.dataSource].label))].join(', ');
    return {
      key, g, inspected, sources,
      count: all.filter((e) => e.group === key).length,
      life: range(min('designLifeYears'), max('designLifeYears'), (v) => `${v}`) + ' years',
      service: range(min('serviceIntervalDays'), max('serviceIntervalDays'), intervalText),
      warning: range(min('warningDays'), max('warningDays'), durationText),
      horizon: range(min('horizonDays'), max('horizonDays'), rangeLabel),
    };
  });
  return (
    <div className="fold-body">
      <p className="meta">
        Each group is forecast only as far ahead as its typical warning time. Typical industry values, used as
        assumptions.
      </p>
      <ul className="groups">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="group-head"><strong>{r.g.label}</strong><span className="meta">{plural(r.count, 'asset')}</span></div>
            <p className="meta">{r.g.note}</p>
            <dl className="group-facts">
              <div><dt>Design life</dt><dd>{r.life}</dd></div>
              <div><dt>{r.inspected ? 'Inspected every' : 'Serviced every'}</dt><dd>{r.service}</dd></div>
              <div><dt>Warning time</dt><dd>{r.warning}</dd></div>
              <div><dt>Forecast up to</dt><dd>{r.horizon}</dd></div>
              <div><dt>Data</dt><dd>{r.sources}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ colors, asOf, scenario }) {
  return (
    <div className="fold-body legend">
      <ul>
        {LEVELS.map((l, i) => (
          <li key={l.key}>
            <RiskIcon level={l} color={colors[l.key]} size={12} />
            <strong>{l.label}</strong>
            <span className="meta">
              {pct(l.min)}{LEVELS[i + 1] ? ` to under ${pct(LEVELS[i + 1].min)}` : ' and above'}
            </span>
          </li>
        ))}
        <li>
          <RiskIcon level={BEYOND_RANGE} color={colors.none} size={12} />
          <strong>{BEYOND_RANGE.label}</strong>
          <span className="meta">past this asset's forecast range; not counted</span>
        </li>
      </ul>
      <p className="meta">
        Risk is a health index from four things: a base rate, age against design life, how far the metric has
        drifted towards its alarm level, and whether servicing or inspection is overdue. An open problem is any
        asset at {pct(OPEN_PROBLEM_MIN)} or higher. All data is simulated, as of {asOf}.
      </p>
      <p className="meta">Scenario: {scenario}. Building masses are illustrative and do not match the real buildings.</p>
    </div>
  );
}

/* ---------- Building (floor stack) ---------- */

function BuildingPanel({ b, colors, when, onSelectFloor }) {
  const s = summarize(b.equipment);
  const floorsTopDown = [...b.floors].reverse();
  return (
    <>
      <section className="card card-overview">
        <p className="eyebrow">Building</p>
        <h2>{b.name}</h2>
        <p className="meta">{b.floorCount} floors · {s.total} monitored assets · commissioned {b.builtYear}</p>
        {s.worst && (
          <div className="worst">
            <RiskBadge level={s.level} color={colors[s.level.key]} value={pct(s.worst.risk)} />
            <span>Worst: <strong>{s.worst.name}</strong>, {b.floors[s.worst.level - 1].label}</span>
          </div>
        )}
        <CountsRow counts={s.counts} colors={colors} />
        {s.total > 0 && s.openProblems === 0 && <Empty>No open problems in {b.name} {when}.</Empty>}
      </section>

      <section className="card">
        <h2>Floors</h2>
        {b.floors.length === 0 && <Empty>No floors recorded for this building.</Empty>}
        <ul className="row-list floor-list">
          {floorsTopDown.map((f) => {
            const fs = summarize(f.equipment);
            return (
              <li key={f.id}>
                <button className="row row-compact row-risk" style={{ '--risk': colors[fs.level.key] }} onClick={() => onSelectFloor(f.level)}>
                  <span className="row-main">
                    <strong>{f.label}</strong>
                    <span className="meta">
                      {plural(fs.total, 'asset')}
                      {fs.openProblems > 0 && <> · <span className="problem-count">{plural(fs.openProblems, 'open problem')}</span></>}
                    </span>
                  </span>
                  <RiskBadge level={fs.level} color={colors[fs.level.key]} value={pct(fs.worst?.risk)} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/* ---------- Floor ---------- */

// Equipment rows open as a short drop-down; the full detail is in the window.
function FloorPanel({ b, floor, theme, colors, day, when, equipmentId, caseByAsset, onOpenCase, onSelectEquipment, onDetails }) {
  const s = summarize(floor.equipment);
  const sorted = [...floor.equipment].sort((x, y) => (y.risk ?? -1) - (x.risk ?? -1));
  const site = b.kind === 'site';
  return (
    <>
      <section className="card card-overview">
        <p className="eyebrow">{site ? 'Ara Damansara' : b.name}</p>
        <h2>{site ? b.name : floor.label}</h2>
        <p className="meta">{plural(s.total, 'asset')} · {plural(s.openProblems, 'open problem')}</p>
        <CountsRow counts={s.counts} colors={colors} />
        {s.total > 0 && s.counts.none === s.total && (
          <Empty>Nothing here is forecast as far as {dayLabel(day)}. Move the forecast back to see them.</Empty>
        )}
        {s.total > 0 && s.counts.none < s.total && s.openProblems === 0 && <Empty>No open problems {when}.</Empty>}
      </section>

      <section className="card">
        <h2>{site ? 'Street assets' : 'Equipment'}</h2>
        <p className="meta">Highest risk first. Open one for a summary.</p>
        {s.total === 0 && <Empty>No monitored assets here yet.</Empty>}
        <ul className="row-list">
          {sorted.map((e) => {
            const l = riskLevel(e.risk);
            const open = e.id === equipmentId;
            return (
              <li key={e.id} className={open ? 'is-open selected-card' : ''}>
                <button
                  className={`row row-compact row-risk ${open ? 'is-selected' : ''}`}
                  style={{ '--risk': colors[l.key] }}
                  aria-expanded={open}
                  onClick={() => onSelectEquipment(open ? null : e.id)}
                >
                  <span className="row-main">
                    <strong>{e.name}{e.work && <span className="tag-work">{e.work}</span>}</strong>
                    <span className="meta">{e.risk >= OPEN_PROBLEM_MIN ? e.fault : GROUPS[e.group].label}</span>
                  </span>
                  <RiskBadge
                    level={l} color={colors[l.key]}
                    value={riskText(e)}
                  />
                  <span className="row-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className="row-detail">
                    <AssetSummary
                      e={e} b={b} theme={theme} day={day} variant="row"
                      openCase={caseByAsset?.get(e.id)} onOpenCase={onOpenCase} onDetails={onDetails}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/* ---------- Root ---------- */

export function SidePanel({
  campus, theme, reducedMotion, buildingId, floorLevel, equipmentId, scrollToCard,
  caseByAsset, onOpenCase, onSelectBuilding, onSelectFloor, onSelectEquipment, onDetails,
}) {
  const colors = RISK_COLORS[theme];
  const b = campus.buildings.find((x) => x.id === buildingId);
  const floor = b && floorLevel ? b.floors[floorLevel - 1] : null;
  const site = b?.kind === 'site';

  const crumbs = [{ label: 'Campus', onClick: b ? () => onSelectBuilding(null) : null }];
  if (b) crumbs.push({ label: b.name, onClick: floor && !site ? () => onSelectFloor(null) : null });
  if (floor && !site) crumbs.push({ label: floor.label });

  const forecasting = campus.day > 0 || campus.forecastScenario !== 'normal';
  const when = campus.day ? `by ${dayLabel(campus.day)}` : 'today';

  // Phones: bring the equipment card into view when someone picks equipment.
  useEffect(() => {
    if (!scrollToCard) return;
    document.querySelector('.selected-card')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [scrollToCard, reducedMotion]);

  return (
    <aside className="panel">
      <div className="panel-top">
        <Breadcrumb items={crumbs} />
        {forecasting && (
          <span className="forecast-chip">
            Forecast: {dayLabel(campus.day)} · {SCENARIOS[campus.forecastScenario].label}
          </span>
        )}
      </div>
      {!b && <CampusPanel campus={campus} colors={colors} when={when} onSelectBuilding={onSelectBuilding} />}
      {b && !floor && <BuildingPanel b={b} colors={colors} when={when} onSelectFloor={onSelectFloor} />}
      {floor && (
        <FloorPanel
          b={b} floor={floor} theme={theme} colors={colors} day={campus.day} when={when}
          equipmentId={equipmentId} onSelectEquipment={onSelectEquipment}
          caseByAsset={caseByAsset} onOpenCase={onOpenCase} onDetails={onDetails}
        />
      )}
    </aside>
  );
}
