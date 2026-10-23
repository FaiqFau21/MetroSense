// "Simulate sensor spike" (CLAUDE.md section 3, step 7). Pure and deterministic:
// the Nth press always faults the same asset with the same reading.

import { SEED, rngFor } from '../data/seed.js';
import { OPEN_PROBLEM_MIN } from '../risk.js';
import { CATALOGUE } from '../data/catalogue.js';

// The first press is a lift door sensor (demo script step 5), on a building that
// is not already critical, so the change of colour is obvious.
const FIRST_SPIKE_PREFERENCE = (e) => e.type === 'lift' && e.buildingId === 'C';

// Choose a healthy live-sensor asset (by today's seeded risk) that has not spiked
// yet. Inspection-only assets (slabs, pipes, wiring) have no live reading to spike.
export function pickSpikeTarget(seedCampus, spikes, pressNo) {
  const healthy = seedCampus.buildings
    .flatMap((b) => b.equipment)
    .filter((e) => e.dataSource === 'sensor' && e.risk < OPEN_PROBLEM_MIN && !spikes.has(e.id));
  if (!healthy.length) return null;
  if (pressNo === 0) {
    const preferred = healthy.find(FIRST_SPIKE_PREFERENCE);
    if (preferred) return preferred;
  }
  const r = rngFor(`spike:${SEED}:${pressNo}`)();
  return healthy[Math.floor(r * healthy.length)];
}

// The jump: today's reading lands 5-20% past the alarm threshold (as a share of
// the normal-to-alarm range).
export const SPIKE_PAST_ALARM = [0.05, 0.2];

export function makeSpike(e, pressNo) {
  const [lo, hi] = SPIKE_PAST_ALARM;
  const drift = 1 + lo + rngFor(`spike-size:${pressNo}`)() * (hi - lo);
  return {
    id: e.id,
    pressNo,
    value: Math.round((e.baseline + drift * (e.threshold - e.baseline)) * 100) / 100,
    fault: CATALOGUE[e.type].faults[0],
  };
}

// Readings with today's value replaced by the spike. Does not mutate the input.
export function applySpike(readings, spike) {
  if (!spike) return readings;
  return [...readings.slice(0, -1), { day: 0, value: spike.value }];
}
