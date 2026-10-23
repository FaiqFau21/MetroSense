// Deterministic seed for the demo campus. Fixed PRNG seed, fixed "today", so the
// demo looks identical on every run. All values are simulated.
//
// This mirrors the Postgres model in CLAUDE.md section 6 (campus > building >
// floor > equipment). From Milestone 4 the backend seed script replaces it.

import { CATALOGUE, MODELS } from './catalogue.js';
import { healthIndexRisk, driftForTargetRisk } from '../model/healthIndex.js';
import { placeInZone } from './layout.js';

export const SEED = 20261018;
export const DEMO_TODAY = '2026-10-18';
const TODAY_YEAR = 2026 + (10 - 1) / 12; // fractional year for age maths

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Illustrative building masses. Names are placeholders, not real building names.
export const BUILDINGS = [
  { id: 'A', name: 'Tower A', floors: 22, w: 34, d: 26, fh: 4, x: -34, z: -14, built: 2012, lifts: 3 },
  { id: 'B', name: 'Tower B', floors: 16, w: 30, d: 24, fh: 4, x: 22, z: -24, built: 2015, lifts: 3 },
  { id: 'C', name: 'Office Block C', floors: 12, w: 26, d: 30, fh: 4, x: 34, z: 26, built: 2009, lifts: 2 },
  { id: 'D', name: 'Annex D', floors: 8, w: 46, d: 20, fh: 4.2, x: -22, z: 34, built: 2017, lifts: 2 },
];

// Assets planted so the 90-second demo script (CLAUDE.md section 10) holds.
// The formula still produces the risk; only the metric drift is chosen.
export const PLANTED = {
  'A-L14-ahu-1': { risk: 0.78, fault: 'AHU filter blockage', daysToFailure: 6 },
  'B-L16-chiller-1': { risk: 0.61, fault: 'Chiller compressor bearing wear', daysToFailure: 21 },
  // "Watch" today, high risk by +7 days if nothing is done (demo step 4). All on
  // sensor-monitored equipment: a 10-13 day failure window is only visible with
  // daily data.
  'A-L22-lift-2': { risk: 0.42, fault: 'Lift door operator fault trend', daysToFailure: 12 },
  'B-L1-fire_pump-1': { risk: 0.4, fault: 'Fire pump low pressure trend', daysToFailure: 11 },
  'C-L7-ahu-1': { risk: 0.44, fault: 'AHU fan belt wear', daysToFailure: 13 },
  'D-L1-ups-1': { risk: 0.38, fault: 'UPS battery capacity fade', daysToFailure: 12 },
  'A-L9-ahu-1': { risk: 0.41, fault: 'AHU coil fouling', daysToFailure: 10 },
  // Long-range demo: healthy or watch now, a problem at +1 or +5 years.
  'A-L6-slab-1': { risk: 0.22, fault: 'Slab cracking widening', daysToFailure: 1500 },
  'B-L16-roof-1': { risk: 0.33, fault: 'Roof membrane deterioration', daysToFailure: 540 },
  'C-L3-pipe-1': { risk: 0.25, fault: 'Pipe internal corrosion', daysToFailure: 1300 },
  'D-L2-wiring-1': { risk: 0.32, fault: 'Insulation breakdown (earth leakage rising)', daysToFailure: 420 },
  // Public realm: the assets residents report (see complaints.js).
  'P-L1-streetlight-4': { risk: 0.42, fault: 'Streetlight LED driver failing (flickering)', daysToFailure: 35 },
  'P-L1-waste_point-2': { risk: 0.45, fault: 'Bins overflowing between collections', daysToFailure: 14 },
  'P-L1-drain-2': { risk: 0.34, fault: 'Silt build-up reducing drain capacity', daysToFailure: 60 },
  'P-L1-playground-1': { risk: 0.4, fault: 'Loose fixings and worn safety surfacing', daysToFailure: 75 },
};

// Public realm around the buildings: [type, name, street or place, x, z, drain
// axis, drain length]. Positions are on the campus pad, clear of every building.
const SITE = { id: 'P', name: 'Public realm', built: 2010 };
export const PUBLIC_REALM = [
  ['streetlight', 'Streetlight SL-01', 'Main boulevard (north)', 4, -48],
  ['streetlight', 'Streetlight SL-02', 'Main boulevard (north)', 4, -30],
  ['streetlight', 'Streetlight SL-03', 'Main boulevard (north)', 4, -12],
  ['streetlight', 'Streetlight SL-04', 'Main boulevard (south)', 4, 18],
  ['streetlight', 'Streetlight SL-05', 'Main boulevard (south)', 4, 36],
  ['streetlight', 'Streetlight SL-06', 'Main boulevard (south)', 4, 54],
  ['streetlight', 'Streetlight SL-07', 'Cross walkway (west)', -60, 2],
  ['streetlight', 'Streetlight SL-08', 'Cross walkway (west)', -40, 2],
  ['streetlight', 'Streetlight SL-09', 'Cross walkway (west)', -14, 2],
  ['streetlight', 'Streetlight SL-10', 'Cross walkway (east)', 16, 2],
  ['streetlight', 'Streetlight SL-11', 'Cross walkway (east)', 42, 2],
  ['streetlight', 'Streetlight SL-12', 'Cross walkway (east)', 62, 2],
  ['waste_point', 'Bin centre BC-1', 'Service lane behind Tower A', -12, -32],
  ['waste_point', 'Bin centre BC-2', 'Service lane beside Tower B', 50, -6],
  ['waste_point', 'Bin centre BC-3', 'Car park entrance by Annex D', 10, 46],
  ['drain', 'Drain DR-1', 'North boundary road', 0, -54, 'x', 60],
  ['drain', 'Drain DR-2', 'South walkway', 0, 62, 'x', 60],
  ['drain', 'Drain DR-3', 'West boundary road', -68, 4, 'z', 50],
  ['drain', 'Drain DR-4', 'East boundary road', 68, 4, 'z', 50],
  ['playground', 'Playground PG-1', 'Pocket park (north-east)', 55, -45],
];

// Per-asset PRNG from its id, so trends and readings never shift the main
// sequence (which would change every asset's current risk).
function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const rngFor = (id) => mulberry32(SEED ^ hashId(id));

// Underlying drift trend in drift units per day (1.0 = baseline-to-alarm).
// Most assets drift slowly; planted demo assets follow their stated failure window.
function trendPerDay(id, drift, planted, spec, lastReading) {
  if (planted) return (1 - drift) / planted.daysToFailure;
  const r = rngFor(`${id}:trend`)();
  if (spec.dataSource === 'sensor') return r ** 4 * 0.02;
  // Technician and inspection readings: no steeper than today's drift allows
  // across the last 3 readings. Inspection assets (structure, pipes, wiring)
  // move at most a quarter of the baseline-to-alarm range per year.
  const fitSpan = 2 * spec.readingIntervalDays + lastReading;
  const raw = spec.dataSource === 'inspection' ? (r ** 4 * 0.25) / 365 : r ** 4 * 0.02;
  return Math.min(raw, drift / (fitSpan + 1));
}

// Days since the latest reading: today for sensors, the last inspection for
// inspection assets, and a recent walk-round for technician readings.
function lastReadingDaysAgo(id, spec, planted, lastService) {
  if (spec.dataSource === 'sensor') return 0;
  if (spec.dataSource === 'inspection') return lastService;
  if (planted) return 1;
  return Math.floor(rngFor(`${id}:reading`)() * spec.readingIntervalDays);
}

// Days since the last service (sensor assets) or inspection (inspection assets).
// 90% are on schedule; 10% are overdue by up to 60% of an interval.
function lastServiceDaysAgo(id, spec, planted) {
  const interval = spec.serviceIntervalDays;
  if (planted) return Math.round(interval * 0.3);
  const r = rngFor(`${id}:service`)();
  return r < 0.9 ? Math.floor((r / 0.9) * interval) : Math.round(interval * (1 + ((r - 0.9) / 0.1) * 0.6));
}

// Slab (or roof on the top floor), pipework and wiring on every floor, plus the
// lights and emergency lights on every office floor (not the roof-plant level).
// Each has its own random sequence, so adding one never shifts other assets.
const lifecycleTypes = (b, level) => (level === b.floors ? ['roof', 'pipe', 'wiring'] : ['slab', 'pipe', 'wiring', 'lights']);

const EXTRAS = ['fcu', 'bms', 'lighting', 'ups', 'fcu', 'bms'];

function floorComposition(b, level, rng) {
  if (level === 1) return ['db', 'booster_pump', 'sump_pump', 'fire_pump', 'generator', 'ups'];
  if (level === b.floors) {
    const roof = ['chiller', 'chiller'];
    for (let i = 0; i < b.lifts; i++) roof.push('lift');
    return roof.concat(['db']).slice(0, 6);
  }
  const types = ['ahu', 'db'];
  const extra = Math.floor(rng() * 5); // 0..4
  const pool = [...EXTRAS];
  for (let i = 0; i < extra && pool.length; i++) {
    types.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return types;
}

const round = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

// One asset. `rng` is the main sequence for the original M&E assets (so they
// never change) and a per-asset sequence for the lifecycle assets.
function makeAsset(b, level, type, n, name, rng) {
  const spec = CATALOGUE[type];
  const id = `${b.id}-L${level}-${type}-${n}`;

  // Assets are original or replaced once; age is relative to DEMO_TODAY.
  // Anything past its design life is assumed to have been renewed on schedule.
  const replaced = rng() < 0.35;
  let installedYear = replaced
    ? b.built + Math.floor(rng() * (TODAY_YEAR - b.built - 1))
    : b.built;
  if (TODAY_YEAR - installedYear > spec.designLifeYears) {
    installedYear = Math.floor(TODAY_YEAR - spec.designLifeYears * (0.2 + rng() * 0.7));
  }
  const ageYears = round(TODAY_YEAR - installedYear, 1);

  // Always draw both numbers so planting an asset never shifts the others.
  const randomDrift = rng() ** 2 * 0.45;
  const randomFault = spec.faults[Math.floor(rng() * spec.faults.length)];
  const planted = PLANTED[id];
  const drift = planted ? driftForTargetRisk(planted.risk, ageYears, spec.designLifeYears) : randomDrift;
  const value = spec.baseline + drift * (spec.threshold - spec.baseline);
  const fault = planted ? planted.fault : randomFault;
  const lastService = lastServiceDaysAgo(id, spec, planted);
  const lastReading = lastReadingDaysAgo(id, spec, planted, lastService);

  const models = MODELS[type];
  const model = models[Math.floor(rngFor(`${id}:model`)() * models.length)];

  return {
    id, type, name, model, buildingId: b.id, level,
    group: spec.group, category: spec.category, zone: spec.zone, fault,
    dataSource: spec.dataSource,
    readingIntervalDays: spec.readingIntervalDays, lastReadingDaysAgo: lastReading,
    installedYear, ageYears, designLifeYears: spec.designLifeYears,
    serviceIntervalDays: spec.serviceIntervalDays, lastServiceDaysAgo: lastService,
    warningDays: spec.warningDays, horizonDays: spec.horizonDays,
    metric: spec.metric, unit: spec.unit, baseline: spec.baseline, threshold: spec.threshold,
    value: round(value, 3),
    drift: round(drift, 3),
    trendPerDay: trendPerDay(id, drift, planted, spec, lastReading),
    risk: healthIndexRisk({
      ageYears, designLifeYears: spec.designLifeYears, drift,
      daysSinceService: lastService, serviceIntervalDays: spec.serviceIntervalDays,
    }),
  };
}

function buildCampus() {
  const rng = mulberry32(SEED);
  const buildings = BUILDINGS.map((b) => {
    const floors = [];
    let liftNo = 0;
    for (let level = 1; level <= b.floors; level++) {
      const typeCounts = {};
      const equipment = floorComposition(b, level, rng).map((type) => {
        const spec = CATALOGUE[type];
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        const n = typeCounts[type];
        let name;
        if (type === 'lift') name = `Lift ${++liftNo}`;
        else if (type === 'chiller') name = `Chiller ${n}`;
        else if (level === 1 || level === b.floors) name = `${spec.label} ${b.id}-${n}`;
        else name = `${spec.label}-${level}${n > 1 ? `-${n}` : ''}`;
        return makeAsset(b, level, type, n, name, rng);
      });
      const tag = level === 1 ? 'G' : `L${level}`;
      for (const type of lifecycleTypes(b, level)) {
        const name = type === 'roof' ? `Roof waterproofing ${b.id}` : type === 'lights' ? `Lights ${tag}` : `${CATALOGUE[type].label} ${tag}`;
        equipment.push(makeAsset(b, level, type, 1, name, rngFor(`${b.id}-L${level}-${type}:asset`)));
      }
      // Floor-plan position (0..1 fractions of the footprint), grouped by zone.
      const byZone = {};
      for (const e of equipment) (byZone[e.zone] ||= []).push(e);
      for (const [zone, list] of Object.entries(byZone)) {
        list.forEach((e, i) => {
          const p = placeInZone(zone, i, list.length);
          e.x = round(p.x, 3);
          e.y = round(p.y, 3);
        });
      }
      floors.push({
        id: `${b.id}-L${level}`, level,
        label: level === 1 ? 'Ground' : level === b.floors ? `Level ${level} (roof plant)` : `Level ${level}`,
        equipment,
      });
    }
    return {
      id: b.id, name: b.name, floorCount: b.floors,
      footprintW: b.w, footprintD: b.d, floorHeight: b.fh,
      x: b.x, z: b.z, builtYear: b.built, floors,
      equipment: floors.flatMap((f) => f.equipment),
    };
  });
  return {
    id: 'demo-campus',
    name: 'Ara Damansara (demo)',
    scenario: "Sime Darby Property's Ara Damansara development, Petaling Jaya: office buildings and the streets, drains and park around them",
    asOf: DEMO_TODAY,
    buildings: [...buildings, buildSite()],
  };
}

// The public realm as a one-level "site" so it flows through the same projection,
// summaries and panels as the buildings. kind: 'site' tells the 3D view to draw
// street furniture at ground level instead of a building.
function buildSite() {
  const counts = {};
  const equipment = PUBLIC_REALM.map(([type, name, zone, wx, wz, axis, length]) => {
    counts[type] = (counts[type] || 0) + 1;
    const id = `P-L1-${type}-${counts[type]}`;
    const e = makeAsset(SITE, 1, type, counts[type], name, rngFor(`${id}:asset`));
    return { ...e, zone, wx, wz, ...(axis && { axis, length }) };
  });
  return {
    id: SITE.id, kind: 'site', name: SITE.name, floorCount: 1,
    footprintW: 140, footprintD: 120, floorHeight: 0, x: 0, z: 4, builtYear: SITE.built,
    floors: [{ id: 'P-L1', level: 1, label: 'Streets, drains & parks', equipment }],
    equipment,
  };
}

export const campus = buildCampus();
