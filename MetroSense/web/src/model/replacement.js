// Repair or replace? A transparent rule per asset, plus the energy case for the
// replacement where there is one. Pure. Every figure is a stated assumption for
// the demo, not a quote or a product recommendation.

import { OPEN_PROBLEM_MIN } from '../risk.js';
import { DEMO_TODAY } from '../data/seed.js';
import { COSTS } from './problem.js';

export const ENERGY = {
  tariffRm: 0.5, // RM per kWh, approximate commercial tariff
  gridKgCo2PerKwh: 0.585, // approximate Peninsular Malaysia grid emission factor
};

// Share of design life used before replacement is considered.
export const REPLACE_AT = { plan: 0.7, now: 0.9 };
// A fault on an ageing unit justifies replacing it only when the repair is a
// sizeable share of a new unit (a filter or belt change never does).
export const REPAIR_SHARE_MIN = 0.15;
// An energy upgrade that pays back within this many years is worth doing early,
// once the unit is past this share of its life.
export const UPGRADE_PAYBACK_YEARS = 5;
export const UPGRADE_AFTER = 0.4;

// Typical like-for-like or better replacement per type: assumed installed cost
// (RM) and energy saved per year (kWh) against the existing unit.
export const REPLACEMENTS = {
  chiller: { to: 'High-efficiency magnetic-bearing chiller', capex: 1200000, kwhSaved: 160000 },
  ahu: { to: 'AHU with EC plug fans and pressure-controlled VSD', capex: 45000, kwhSaved: 15000 },
  fcu: { to: 'FCU with EC fan motor', capex: 3500, kwhSaved: 900 },
  lift: { to: 'Lift modernisation with regenerative drive', capex: 250000, kwhSaved: 12000 },
  booster_pump: { to: 'Booster set with IE4 motors and VSD', capex: 18000, kwhSaved: 9000 },
  sump_pump: { to: 'Submersible pump, like for like', capex: 6000, kwhSaved: 400 },
  fire_pump: { to: 'Fire pump set, like for like (standby: no energy saving)', capex: 60000, kwhSaved: 0 },
  generator: { to: 'Standby generator, like for like', capex: 350000, kwhSaved: 0 },
  ups: { to: 'Modular UPS with lithium-ion batteries', capex: 85000, kwhSaved: 6000 },
  db: { to: 'Distribution board with sub-metering', capex: 12000, kwhSaved: 0 },
  bms: { to: 'Wireless sensor with 5-year battery', capex: 600, kwhSaved: 0 },
  lighting: { to: 'DALI-2 panel with occupancy and daylight sensors', capex: 9000, kwhSaved: 15000 },
  lights: { to: 'High-efficiency LED panels with self-test emergency fittings', capex: 60000, kwhSaved: 12000 },
  roof: { to: 'Re-roofing with a reflective cool-roof membrane', capex: 180000, kwhSaved: 20000 },
  pipe: { to: 'Riser replaced in stainless steel', capex: 40000, kwhSaved: 0 },
  wiring: { to: 'Floor rewired with LSZH cabling', capex: 60000, kwhSaved: 0 },
  streetlight: { to: 'Smart LED streetlight with dimming and remote fault alerts', capex: 3200, kwhSaved: 200 },
  waste_point: { to: 'Bin centre refurbishment', capex: 15000, kwhSaved: 0 },
  drain: { to: 'Drain relining and new grating', capex: 45000, kwhSaved: 0 },
  playground: { to: 'New play frame and safety surfacing', capex: 60000, kwhSaved: 0 },
  // slab: structural repair, never "replaced"
};

const DEMO_YEAR = Number(DEMO_TODAY.slice(0, 4));
const round1 = (v) => Math.round(v * 10) / 10;

// e: an asset with ageYears, designLifeYears, type and (optionally) today's risk.
// Returns null when repairing as usual is the right call.
export function replacementAdvice(e, riskToday = e.risk) {
  const r = REPLACEMENTS[e.type];
  if (!r) return null;
  const lifeUsed = e.ageYears / e.designLifeYears;
  const lifeLeftYears = Math.max(0, round1(e.designLifeYears - e.ageYears));
  const problem = (riskToday ?? 0) >= OPEN_PROBLEM_MIN;
  const repairShare = (COSTS[e.type]?.planned ?? 0) / r.capex;
  const rmPerYear = Math.round(r.kwhSaved * ENERGY.tariffRm);
  const co2Tonnes = round1((r.kwhSaved * ENERGY.gridKgCo2PerKwh) / 1000);
  const paybackYears = rmPerYear > 0 ? round1(r.capex / rmPerYear) : null;
  const used = `${round1(e.ageYears)} of ${e.designLifeYears} years of design life used`;

  let verdict, why;
  if (lifeUsed >= REPLACE_AT.now) {
    verdict = 'replace';
    why = `${used}: near the end of its life, so repairs buy little time`;
  } else if (lifeUsed >= REPLACE_AT.plan && problem && repairShare >= REPAIR_SHARE_MIN) {
    verdict = 'replace';
    why = `${used}, and the repair would cost ${Math.round(repairShare * 100)}% of a new unit: replace rather than repair an ageing unit`;
  } else if (lifeUsed >= REPLACE_AT.plan) {
    verdict = 'plan';
    why = `${used}: repair as needed, and budget its replacement before it fails`;
  } else if (lifeUsed >= UPGRADE_AFTER && paybackYears != null && paybackYears <= UPGRADE_PAYBACK_YEARS) {
    verdict = 'upgrade';
    why = `The energy saving pays for the upgrade in about ${paybackYears} years`;
  } else {
    return null;
  }
  return {
    verdict, why, to: r.to, capex: r.capex,
    kwhSaved: r.kwhSaved, rmPerYear, co2Tonnes, paybackYears, lifeLeftYears,
    planYear: verdict === 'plan' ? DEMO_YEAR + Math.max(1, Math.floor(lifeLeftYears)) : DEMO_YEAR,
  };
}

// Campus roll-up for the overview: candidates now and the yearly saving if done.
export function replacementSummary(assets) {
  const now = assets.map((e) => replacementAdvice(e)).filter((a) => a && a.verdict !== 'plan');
  return {
    count: now.length,
    capex: now.reduce((n, a) => n + a.capex, 0),
    rmPerYear: now.reduce((n, a) => n + a.rmPerYear, 0),
    co2Tonnes: round1(now.reduce((n, a) => n + a.co2Tonnes, 0)),
  };
}
