// Maintenance log per asset: installation, routine services or inspections,
// technician readings, past repairs, reports, case updates and sensor alerts.
// Pure and deterministic. It is built from the same seed fields the risk model
// uses (install year, last service, readings), so the log and the risk agree:
// the latest service here is the one the "overdue" term counts from.
// Past repairs are simulated per asset from a fixed seed.

import { campus as seedCampus, rngFor, DEMO_TODAY } from '../data/seed.js';
import { readingsFor } from '../data/readings.js';
import { CATALOGUE } from '../data/catalogue.js';
import { COMPLAINTS, CASE_HISTORY, CHANNELS } from '../data/complaints.js';
import { routeCase } from './routing.js';
import { actionOf } from './problem.js';

export const LOG_YEARS = 3; // routine entries are listed for the last 3 years
const LOG_DAYS = LOG_YEARS * 365;
const MAX_SERVICES = 12;

// What a routine visit covers, per type (assumed scope, typical for the type).
export const SERVICE_TASKS = {
  chiller: 'Checked refrigerant pressures, compressor vibration and oil; cleaned condenser tubes',
  ahu: 'Changed filters, checked fan belt tension and cleaned the drain pan',
  fcu: 'Cleaned filter and coil, cleared the condensate drain',
  lift: 'Lubricated guides, adjusted door operator, tested safety gear and alarm',
  booster_pump: 'Checked seals, bearings and pressure switch; test-ran duty and standby pumps',
  sump_pump: 'Cleared the sump pit, tested float switch and pump run',
  fire_pump: 'Test-ran the fire and jockey pumps; checked pressure and start-up time',
  generator: 'Load-tested the set; checked starter batteries, oil and coolant',
  ups: 'Checked battery voltages and capacity, cleaned filters, tested transfer',
  db: 'Thermal scan of terminals, tightened connections, tested RCDs',
  bms: 'Checked sensor reading against a calibrated meter and network link',
  lighting: 'Checked schedules, occupancy sensors and dimming outputs',
  lights: 'Annual 3-hour emergency lighting duration test; replaced failed fittings and batteries',
  slab: 'Structural inspection: crack mapping and cover-meter checks',
  roof: 'Roof inspection: membrane, laps, flashings and roof drains',
  pipe: 'Pipework inspection: wall thickness, joints and supports',
  wiring: 'Electrical inspection: insulation resistance and loading',
  streetlight: 'Night patrol check: lamp, photocell and pole condition',
  waste_point: 'Bin centre check: bins, washing area and pest control',
  drain: 'Drain inspection: silt depth, gratings and outfalls',
  playground: 'Playground safety inspection: fixings, surfacing and moving parts',
};

const seedIndex = new Map(seedCampus.buildings.flatMap((b) => b.equipment.map((e) => [e.id, e])));
const TODAY = Date.UTC(...DEMO_TODAY.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateOf(daysAgo) {
  const d = new Date(TODAY - daysAgo * 86400000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const hourOf = (time) => (time ? Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60 : 12);
const round = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

// e: the asset as shown (may carry a spike, a repair or open reports).
// openCase: its current case, if any (session updates are added from it).
export function maintenanceLog(e, openCase = null) {
  const seed = seedIndex.get(e.id) ?? e;
  const spec = CATALOGUE[e.type];
  const party = routeCase({ type: e.type }).party.name;
  const inspection = e.dataSource === 'inspection';
  const entries = [];
  const installedDaysAgo = Math.round(seed.ageYears * 365);

  // Installed (or renewed) on its install date.
  entries.push({
    daysAgo: installedDaysAgo, kind: 'install',
    title: seed.installedYear > (seedCampus.buildings.find((b) => b.id === e.buildingId)?.builtYear ?? 0)
      ? 'Replaced with a new unit' : 'Installed and commissioned',
    detail: seed.model, by: 'Installer',
  });

  // Inspections are the readings themselves; other assets get routine services.
  const readings = readingsFor(seed);
  if (inspection) {
    for (const r of readings) {
      if (-r.day > Math.min(LOG_DAYS, installedDaysAgo)) continue;
      entries.push({
        daysAgo: -r.day, kind: 'inspection', title: SERVICE_TASKS[e.type],
        detail: `${spec.metric}: ${round(r.value)} ${spec.unit} (normal ${spec.baseline}, alarm ${spec.threshold})`, by: party,
      });
    }
  } else {
    let n = 0;
    for (let d = seed.lastServiceDaysAgo; d <= Math.min(LOG_DAYS, installedDaysAgo) && n < MAX_SERVICES; d += seed.serviceIntervalDays, n++) {
      entries.push({ daysAgo: d, kind: 'service', title: 'Routine service', detail: SERVICE_TASKS[e.type], by: party });
    }
    if (e.dataSource === 'manual') {
      for (const r of readings) {
        entries.push({
          daysAgo: -r.day, kind: 'reading', title: 'Technician reading',
          detail: `${spec.metric}: ${round(r.value)} ${spec.unit} (normal ${spec.baseline}, alarm ${spec.threshold})`, by: party,
        });
      }
    }
  }

  // Past repairs (simulated): older assets have had more.
  const rng = rngFor(`${e.id}:repairs`);
  const lifeUsed = seed.ageYears / seed.designLifeYears;
  const count = rng() < 0.2 + 0.5 * lifeUsed ? (rng() < 0.35 ? 2 : 1) : 0;
  const window = Math.min(LOG_DAYS, installedDaysAgo) - 60;
  for (let i = 0; i < count && window > 0; i++) {
    const fault = spec.faults[Math.floor(rng() * spec.faults.length)];
    entries.push({
      daysAgo: 60 + Math.floor(rng() * window), kind: 'repair',
      title: actionOf({ ...seed, fault }, null).what, detail: `Fault found: ${fault}`, by: party,
    });
  }

  // Reports, case history before today, and this session's case updates.
  // Seeded reports plus any sent this session (guest form), once each.
  const reports = new Map([...COMPLAINTS.filter((c) => c.assetId === e.id), ...(openCase?.reports ?? [])].map((r) => [r.id, r]));
  for (const r of reports.values()) {
    entries.push({
      daysAgo: r.daysAgo, time: r.time, kind: 'report',
      title: `Report ${r.id} via ${CHANNELS[r.channel]}`, detail: `“${r.translation ?? r.text}”`, by: r.reporter,
    });
  }
  for (const h of CASE_HISTORY[e.id] ?? []) {
    entries.push({ daysAgo: h.daysAgo, time: h.time, kind: 'case', title: `Case ${h.status.toLowerCase()}`, detail: h.note ?? '', by: party });
  }
  if (openCase) {
    for (const ev of openCase.events.filter((x) => x.hoursAgo === 0 && !/^R-\d/.test(x.text))) {
      entries.push({ daysAgo: 0, time: '23:59', kind: 'case', title: ev.text, detail: `Case ${openCase.id}`, by: '' });
    }
  }
  if (e.spike) {
    entries.push({
      daysAgo: 0, time: '10:00', kind: 'alert', title: 'Sensor alert',
      detail: `${spec.metric} jumped to ${e.spike.value} ${spec.unit}, past the ${spec.threshold} ${spec.unit} alarm (simulated)`, by: 'Sensor',
    });
  }

  entries.sort((a, b) => (a.daysAgo * 24 - hourOf(a.time)) - (b.daysAgo * 24 - hourOf(b.time)));
  return entries.map((x) => ({ ...x, date: dateOf(x.daysAgo) }));
}

// Next routine service or inspection, from the asset as shown (a repair resets it).
export function nextDue(e) {
  const inDays = e.serviceIntervalDays - e.lastServiceDaysAgo;
  return { inDays, date: dateOf(-inDays), overdue: inDays < 0 };
}
