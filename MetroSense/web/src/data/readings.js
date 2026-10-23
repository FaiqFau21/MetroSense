// Dummy readings, generated on demand from each asset's id so they are the
// same on every run. The latest reading is exact; earlier ones carry noise.
//  - Sensor assets: one value per day for the 30 days up to DEMO_TODAY.
//  - Technician (manual) assets: one value per walk-round, the last 6 rounds.
//  - Inspection assets: one value per scheduled inspection over the last 3 years.
// For manual and inspection assets the latest reading was `lastReadingDaysAgo`
// days before today.

import { rngFor } from './seed.js';

export const HISTORY_DAYS = 30;
export const MANUAL_HISTORY_READINGS = 6;
export const INSPECTION_HISTORY_DAYS = 1095;
export const NOISE = 0.018; // day-to-day sensor noise, in drift units
export const MANUAL_NOISE = 0.01; // gauge-reading scatter between technician rounds
export const INSPECTION_NOISE = 0.003; // measurement scatter between inspections

const cache = new Map();

export function readingsFor(e) {
  if (cache.has(e.id)) return cache.get(e.id);
  const rng = rngFor(`${e.id}:readings`);
  const span = e.threshold - e.baseline;
  const out = [];
  const point = (day, noiseAmp, isLatest) => {
    const noise = isLatest ? 0 : (rng() - 0.5) * 2 * noiseAmp;
    const drift = Math.max(0, e.drift + e.trendPerDay * day + noise);
    out.push({ day, value: Math.round((e.baseline + drift * span) * 1000) / 1000 });
  };

  if (!e.dataSource || e.dataSource === 'sensor') {
    for (let day = -HISTORY_DAYS; day <= 0; day++) point(day, NOISE, day === 0);
  } else {
    const step = e.readingIntervalDays;
    const inspection = e.dataSource === 'inspection';
    const back = inspection ? INSPECTION_HISTORY_DAYS : e.lastReadingDaysAgo + step * (MANUAL_HISTORY_READINGS - 1);
    const days = [];
    for (let d = -e.lastReadingDaysAgo; d >= -back; d -= step) days.unshift(d);
    days.forEach((d, i) => point(d, inspection ? INSPECTION_NOISE : MANUAL_NOISE, i === days.length - 1));
  }
  cache.set(e.id, out);
  return out;
}
