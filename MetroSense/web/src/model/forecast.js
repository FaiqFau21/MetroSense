// The swappable scoring function (CLAUDE.md section 7). Pure: it uses only the
// equipment record and its readings, never shared state.
//
// 1. Trend = least-squares slope of drift over the fit window: the last
//    FIT_DAYS of daily sensor readings, or the last 3 technician readings or
//    inspections.
// 2. Current drift = last reading, carried forward to today along the trend
//    (technician and inspection readings can be weeks or months old).
// 3. Drift on day N = current drift + trend * N, plus the extra drift from each
//    stressed day before N (heavy rain or heat, per the scenario or weather).
// 4. Risk on day N = health index (healthIndex.js) with age + N days and days
//    since service + N ("no action": nobody services it in the meantime).
// 5. Days to failure = days until drift reaches 1.0 (the alarm threshold).

import { healthIndexRisk, driftOf } from './healthIndex.js';
import { weatherStressOn, WEATHER_DAYS, HEAVY_RAIN_MM, HOT_DAY_C } from '../data/weather.js';

export const FIT_DAYS = 14;
// Below this trend (drift units per day) treat the metric as flat. Daily sensor
// data is noisiest per reading, so it needs the biggest slope before it counts;
// technician and inspection readings are further apart, so slower trends matter.
export const MIN_TREND = { sensor: 0.001, manual: 0.0002, inspection: 0.00001 };
const MAX_DRIFT = 1.4;

// How a day of heavy rain or heat stresses each affected asset type: on that day
// its trend becomes fitted trend * factor + extra (drift units per day). Demo
// assumptions, not engineering data.
export const STRESS = {
  rain: {
    sump_pump: { factor: 3, extra: 0.03 },
    booster_pump: { factor: 1.5, extra: 0.006 },
    db: { factor: 1.5, extra: 0.006 },
    bms: { factor: 2, extra: 0.01 },
    lift: { factor: 1.3, extra: 0.004 },
    roof: { factor: 2, extra: 0.004 },
    drain: { factor: 2, extra: 0.03 }, // storm runoff carries silt and debris
  },
  heat: {
    chiller: { factor: 2, extra: 0.012 },
    ahu: { factor: 1.8, extra: 0.008 },
    fcu: { factor: 1.8, extra: 0.008 },
    ups: { factor: 1.5, extra: 0.006 },
    db: { factor: 1.5, extra: 0.008 },
    generator: { factor: 1.3, extra: 0.004 },
    wiring: { factor: 1.5, extra: 0.002 },
  },
};

// Each scenario says which kind of stress (if any) applies on day i from today.
// No scenario stresses anything beyond PROFILE_DAYS; after that the normal trend
// resumes.
export const PROFILE_DAYS = 21;
export const SCENARIOS = {
  normal: { label: 'Normal', note: 'Current trends continue.', when: 'Never', kindOn: () => null },
  weather: {
    label: 'Weather',
    note: `Follows the simulated ${WEATHER_DAYS}-day weather forecast: rain stress on heavy-rain days (${HEAVY_RAIN_MM} mm or more), heat stress on hot days (${HOT_DAY_C}°C or more).`,
    when: `Heavy-rain and hot days in the ${WEATHER_DAYS}-day forecast`,
    kindOn: weatherStressOn,
  },
  rain: {
    label: 'Heavy rain',
    note: 'Two-week monsoon spell: pumps run hard, damp affects switchgear, sensors and the roof.',
    when: 'Every day for 14 days',
    kindOn: (i) => (i < 14 ? 'rain' : null),
  },
  heat: {
    label: 'Heat wave',
    note: 'Three weeks above 36°C: cooling plant and electrical loads run near capacity.',
    when: 'Every day for 21 days',
    kindOn: (i) => (i < 21 ? 'heat' : null),
  },
};

export function fitTrend(readings, baseline, threshold, windowDays = FIT_DAYS) {
  const lastDay = readings[readings.length - 1].day;
  const pts = readings
    .filter((r) => r.day >= lastDay - windowDays)
    .map((r) => [r.day, driftOf(r.value, baseline, threshold)]);
  const n = pts.length;
  if (n < 2) return 0;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den ? num / den : 0;
}

// Daily sensors: the last FIT_DAYS days. Technician and inspection readings: the
// last 3 readings.
export function fitWindowDays(equipment) {
  if (!equipment.dataSource || equipment.dataSource === 'sensor') return FIT_DAYS;
  return 2 * (equipment.readingIntervalDays ?? equipment.serviceIntervalDays) + 1;
}

// Extra drift per day for this asset under the scenario, for days 0..PROFILE_DAYS-1.
function stressProfile(type, base, scenario) {
  const sc = SCENARIOS[scenario];
  return Array.from({ length: PROFILE_DAYS }, (_, i) => {
    const kind = sc.kindOn(i);
    const s = kind && STRESS[kind][type];
    return s ? base * (s.factor - 1) + s.extra : 0;
  });
}

// Day (from today) on which drift reaches 1.0, walking the stressed days first
// and the plain trend after. null if it never gets there.
function failureDay(current, base, extra) {
  if (current >= 1) return 0;
  let drift = current;
  for (let i = 0; i < extra.length; i++) {
    const rate = base + extra[i];
    if (rate > 0 && drift + rate >= 1) return i + (1 - drift) / rate;
    drift += rate;
  }
  return base > 0 ? extra.length + (1 - drift) / base : null;
}

export function score(equipment, readings, day = 0, scenario = 'normal') {
  const { baseline, threshold, ageYears, designLifeYears } = equipment;
  const last = readings[readings.length - 1];
  const fitted = fitTrend(readings, baseline, threshold, fitWindowDays(equipment));
  const base = fitted > MIN_TREND[equipment.dataSource ?? 'sensor'] ? fitted : 0;
  const current = driftOf(last.value, baseline, threshold) + base * (0 - last.day);

  const extra = stressProfile(equipment.type, base, scenario);
  let stressSoFar = 0;
  for (let i = 0; i < Math.min(day, PROFILE_DAYS); i++) stressSoFar += extra[i];

  const drift = Math.min(MAX_DRIFT, current + base * day + stressSoFar);
  const daysSinceService = equipment.lastServiceDaysAgo == null ? null : equipment.lastServiceDaysAgo + day;
  const risk = healthIndexRisk({
    ageYears: ageYears + day / 365,
    designLifeYears,
    drift,
    daysSinceService,
    serviceIntervalDays: equipment.serviceIntervalDays,
    openReports: equipment.openReports,
  });
  const fail = failureDay(current, base, extra);
  return {
    day,
    drift,
    value: baseline + drift * (threshold - baseline),
    risk,
    trendPerDay: base,
    stressDays: extra.filter((x) => x > 0).length, // days this asset is stressed
    daysSinceService,
    daysToFailure: fail == null ? null : Math.max(0, fail - day),
  };
}

// Forecast series for days 0..horizon (always including the horizon), for charts.
export function forecast(equipment, readings, horizon = 30, scenario = 'normal', step = 1) {
  const days = [];
  for (let d = 0; d < horizon; d += step) days.push(d);
  days.push(horizon);
  return days.map((d) => score(equipment, readings, d, scenario));
}
