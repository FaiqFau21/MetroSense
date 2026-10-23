// Transparent health-index risk (CLAUDE.md section 7, first model).
// Pure functions: same inputs always give the same output.
//
//   risk = 0.03                           base rate
//        + 0.20 * ageFraction^1.5         age against design life
//        + 0.75 * drift^2                 condition (sensor or inspection)
//        + 0.15 * overdueFraction         service or inspection overdue
//        + 0.10 * open resident reports   reactive evidence (max +0.20)
//   clamped to 0..0.99
//
// ageFraction     = age / design life (capped at 1.5)
// drift           = how far the metric has moved from baseline towards its alarm
//                   threshold (0 = at baseline, 1 = at threshold)
// overdueFraction = days past the service interval / the interval (0..1), so the
//                   full 15% applies once a whole interval has been missed

const BASE = 0.03;
const AGE_WEIGHT = 0.2;
const DRIFT_WEIGHT = 0.75;
export const SERVICE_WEIGHT = 0.15;
// A resident report about an asset is evidence of a fault the readings may not
// show yet (readings can be weeks apart). Capped so reports alone can't make an
// asset critical.
export const REPORT_WEIGHT = 0.1;
export const MAX_REPORTS_TERM = 0.2;
export const WEIGHTS = { base: BASE, age: AGE_WEIGHT, drift: DRIFT_WEIGHT, service: SERVICE_WEIGHT, report: REPORT_WEIGHT };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function ageFraction(ageYears, designLifeYears) {
  return clamp(ageYears / designLifeYears, 0, 1.5);
}

export function driftOf(value, baseline, threshold) {
  return Math.max(0, (value - baseline) / (threshold - baseline));
}

export function overdueFraction(daysSinceService, serviceIntervalDays) {
  if (daysSinceService == null || !serviceIntervalDays) return 0;
  return clamp((daysSinceService - serviceIntervalDays) / serviceIntervalDays, 0, 1);
}

// The terms of the formula, so the UI can show where a risk figure comes from.
export function riskTerms({ ageYears, designLifeYears, drift, daysSinceService, serviceIntervalDays, openReports = 0 }) {
  const af = ageFraction(ageYears, designLifeYears);
  return {
    base: BASE,
    age: AGE_WEIGHT * af ** 1.5,
    drift: DRIFT_WEIGHT * Math.max(0, drift) ** 2,
    service: SERVICE_WEIGHT * overdueFraction(daysSinceService, serviceIntervalDays),
    reports: Math.min(MAX_REPORTS_TERM, REPORT_WEIGHT * openReports),
  };
}

export function healthIndexRisk(input) {
  const t = riskTerms(input);
  return clamp(t.base + t.age + t.drift + t.service + t.reports, 0, 0.99);
}

// Inverse used only by the seed script to plant demo-scenario assets: the drift
// a metric needs for the formula above to land on a target risk (asset serviced
// on time, so no overdue term).
export function driftForTargetRisk(targetRisk, ageYears, designLifeYears) {
  const af = ageFraction(ageYears, designLifeYears);
  const rest = targetRisk - BASE - AGE_WEIGHT * af ** 1.5;
  return Math.sqrt(Math.max(0, rest) / DRIFT_WEIGHT);
}
