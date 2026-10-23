// Project the whole campus to a chosen forecast day and scenario. Returns a new
// campus object with the same shape, where each asset's `risk` is the forecast
// risk and `daysToFailure` is counted from that day. Pure; inputs are not mutated.
//
// Each asset is only forecast up to its own horizon (catalogue.js). Past that
// (`outOfRange`), an unfixed problem does not go away: an asset that is already
// a problem at its horizon keeps at least that risk (`held`), and its time to
// failure keeps counting down. An asset still healthy at its horizon gets risk
// null: we do not claim to know how it will be that far ahead.
//
// `ctx` carries the live state of the maintenance loop:
//   reports  Map assetId -> open resident reports (evidence in the risk score)
//   repairs  Set of assetIds whose case was resolved: condition and service
//            date reset as if just repaired

import { score } from './forecast.js';
import { readingsFor } from '../data/readings.js';
import { OPEN_PROBLEM_MIN } from '../risk.js';
import { applySpike } from './spike.js';

export const HIGH_RISK_MIN = 0.5; // serious or critical

const NO_CTX = { reports: new Map(), repairs: new Set() };

// A repair adds today's reading at the normal level.
function applyRepair(readings, e) {
  const fixed = { day: 0, value: e.baseline };
  return readings.at(-1).day === 0 ? [...readings.slice(0, -1), fixed] : [...readings, fixed];
}

// The asset as the model sees it after the maintenance loop: repaired assets
// restart from normal with a fresh service date; open reports count as evidence.
export function liveAsset(e, ctx = NO_CTX) {
  if (ctx.repairs?.has(e.id)) {
    return { ...e, drift: 0, trendPerDay: 0, lastServiceDaysAgo: 0, lastReadingDaysAgo: 0, repaired: true, openReports: 0 };
  }
  const openReports = ctx.reports?.get(e.id) ?? 0;
  return openReports ? { ...e, openReports } : e;
}

// Readings for an asset, including a simulated spike or a repair.
export function liveReadings(e, spikes, ctx = NO_CTX) {
  const base = applySpike(readingsFor(e), spikes?.get(e.id));
  return ctx.repairs?.has(e.id) ? applyRepair(base, e) : base;
}

// Readings for an already-projected asset (it carries its own spike and repair flags).
export function readingsOf(e) {
  const base = applySpike(readingsFor(e), e.spike);
  return e.repaired ? applyRepair(base, e) : base;
}

export function projectCampus(campus, day, scenario, spikes = new Map(), ctx = NO_CTX) {
  const buildings = campus.buildings.map((b) => {
    const floors = b.floors.map((f) => ({
      ...f,
      equipment: f.equipment.map((seed) => {
        const e = liveAsset(seed, ctx);
        const spike = e.repaired ? null : spikes.get(e.id);
        const horizon = e.horizonDays ?? Infinity;
        const inRange = day <= horizon;
        const s = score(e, liveReadings(seed, e.repaired ? null : spikes, ctx), Math.min(day, horizon), scenario);
        const held = !inRange && s.risk >= OPEN_PROBLEM_MIN;
        const known = inRange || held;
        return {
          ...e,
          risk: known ? s.risk : null,
          daysToFailure: !known || s.daysToFailure == null
            ? null
            : held ? Math.max(0, s.daysToFailure - (day - horizon)) : s.daysToFailure,
          outOfRange: !inRange,
          held,
          ...(spike && { fault: spike.fault, spike }),
        };
      }),
    }));
    return { ...b, floors, equipment: floors.flatMap((f) => f.equipment) };
  });
  // `scenario` on the campus is the described setting; the forecast one is separate.
  return { ...campus, buildings, day, forecastScenario: scenario };
}

// Mark assets whose repair is dispatched or under way (`work`: the case status).
// The risk colour stays until the case is resolved: the asset is not fixed yet.
export function withWork(campus, work) {
  if (!work.size) return campus;
  const mark = (e) => (work.has(e.id) ? { ...e, work: work.get(e.id) } : e);
  return {
    ...campus,
    buildings: campus.buildings.map((b) => {
      const floors = b.floors.map((f) => ({ ...f, equipment: f.equipment.map(mark) }));
      return { ...b, floors, equipment: floors.flatMap((f) => f.equipment) };
    }),
  };
}

export function campusTotals(campus) {
  const everything = campus.buildings.flatMap((b) => b.equipment);
  const all = everything.filter((e) => e.risk != null);
  return {
    total: everything.length,
    inRange: all.length,
    open: all.filter((e) => e.risk >= OPEN_PROBLEM_MIN).length,
    highRisk: all.filter((e) => e.risk >= HIGH_RISK_MIN).length,
  };
}
