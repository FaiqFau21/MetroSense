// Problem record (CLAUDE.md section 4): impact, recommended action and cost.
// Rule-based for the demo. Every number here is a stated assumption.

import { DEMO_TODAY } from '../data/seed.js';

export const ASSUMPTIONS = {
  occupantsPerOfficeFloor: 120,
  occupantsGroundFloor: 60,
  // People who use each public-realm asset on a typical day (assumption).
  publicUsers: { streetlight: 400, waste_point: 250, drain: 1200, playground: 60 },
  note: 'Costs are assumed unit costs in RM for the demo. Emergency cost includes out-of-hours call-out, collateral damage and downtime.',
};

const DEMO_YEAR = Number(DEMO_TODAY.slice(0, 4));
// Recommended timing: act at this share of the predicted time to failure.
export const ACTION_AT = 0.6;

// Assumed costs per asset type, RM: planned repair vs emergency failure.
export const COSTS = {
  chiller: { planned: 18000, emergency: 95000 },
  ahu: { planned: 1800, emergency: 12500 },
  fcu: { planned: 600, emergency: 3200 },
  lift: { planned: 4500, emergency: 28000 },
  booster_pump: { planned: 2500, emergency: 14000 },
  sump_pump: { planned: 1500, emergency: 22000 },
  fire_pump: { planned: 3500, emergency: 40000 },
  generator: { planned: 2200, emergency: 35000 },
  ups: { planned: 6500, emergency: 30000 },
  db: { planned: 900, emergency: 18000 },
  bms: { planned: 350, emergency: 1500 },
  lighting: { planned: 800, emergency: 4000 },
  lights: { planned: 1500, emergency: 9000 },
  slab: { planned: 9000, emergency: 120000 },
  roof: { planned: 15000, emergency: 85000 },
  pipe: { planned: 6000, emergency: 45000 },
  wiring: { planned: 4000, emergency: 30000 },
  streetlight: { planned: 900, emergency: 4000 },
  waste_point: { planned: 300, emergency: 2500 },
  drain: { planned: 2000, emergency: 60000 },
  playground: { planned: 1500, emergency: 25000 },
};

const ACTIONS = {
  'Chiller compressor bearing wear': 'Replace compressor bearings and re-check vibration',
  'Chiller low refrigerant charge': 'Leak-test circuit and top up refrigerant',
  'AHU filter blockage': 'Replace AHU filters',
  'AHU fan belt wear': 'Replace fan belt and re-tension',
  'AHU coil fouling': 'Chemically clean cooling coil',
  'FCU filter blockage': 'Replace FCU filter',
  'FCU coil fouling': 'Clean FCU coil and drain pan',
  'Lift door operator fault trend': 'Service door operator and adjust door sensors',
  'Lift rope wear': 'Inspect ropes and plan rope replacement',
  'Booster pump seal leak': 'Replace mechanical seal',
  'Booster pump bearing wear': 'Replace pump bearings',
  'Sump pump bearing wear': 'Replace pump bearings and test float switch',
  'Sump pump seal leak': 'Replace mechanical seal and test float switch',
  'Fire pump low pressure trend': 'Inspect impeller and jockey pump, re-test pressure',
  'Generator starter battery weak': 'Replace starter batteries and run load test',
  'Generator starter motor fault': 'Service starter motor and run load test',
  'UPS battery capacity fade': 'Replace UPS battery string',
  'Switchboard terminal overheating': 'Isolate, re-torque terminals and re-scan with thermal camera',
  'Distribution board loose terminal': 'Isolate and re-torque terminals',
  'BMS sensor drifting or offline': 'Recalibrate or replace sensor, check network link',
  'Lighting circuit harmonic distortion': 'Inspect drivers on circuit and balance loads',
  'Dimming controller fault': 'Replace dimming controller',
  'Light fittings failing (dark patches)': 'Replace failed LED drivers and fittings',
  'Emergency light batteries failing duration test': 'Replace emergency light batteries and repeat the 3-hour test',
  'Slab cracking widening': 'Structural engineer survey; epoxy-inject cracks and fit crack monitors',
  'Reinforcement corrosion (spalling)': 'Break out, treat reinforcement and patch-repair concrete',
  'Roof membrane deterioration': 'Patch-repair membrane before the monsoon; plan re-roofing',
  'Ponding and leak risk at roof drains': 'Clear outlets, regrade and re-seal around drains',
  'Pipe internal corrosion': 'Ultrasonic survey of the run; replace corroded sections',
  'Joint leak risk': 'Re-make or replace weak joints',
  'Insulation breakdown (earth leakage rising)': 'Insulation-test the circuits; replace degraded cable',
  'Overloaded circuit cabling': 'Rebalance loads across circuits; upsize cable where needed',
  'Streetlight LED driver failing (flickering)': 'Replace the LED driver at night-patrol time; check the photocell',
  'Photocell fault (lamp on in daytime)': 'Replace the photocell',
  'Bins overflowing between collections': 'Add a mid-week collection and one more bin; check lids',
  'Damaged bins and pest activity': 'Replace damaged bins and arrange pest control',
  'Silt build-up reducing drain capacity': 'Desilt the drain before the next heavy rain',
  'Culvert blocked by debris (flash-flood risk)': 'Clear the culvert and install a debris screen',
  'Loose fixings and worn safety surfacing': 'Tighten fixings, replace the swing chain and patch the safety surfacing',
};

function floorOccupants(b, level) {
  if (level === b.floorCount) return 0; // roof plant
  return level === 1 ? ASSUMPTIONS.occupantsGroundFloor : ASSUMPTIONS.occupantsPerOfficeFloor;
}

function buildingOccupants(b) {
  let n = 0;
  for (let l = 1; l <= b.floorCount; l++) n += floorOccupants(b, l);
  return n;
}

export function impactOf(e, b) {
  const where = (e.zone ?? '').toLowerCase();
  const users = ASSUMPTIONS.publicUsers;
  switch (e.type) {
    case 'streetlight':
      return { text: `Dark stretch on the ${where} at night: a safety risk for people walking home`, occupants: users.streetlight };
    case 'waste_point':
      return { text: `Overflowing bins, smell and pests along the ${where}`, occupants: users.waste_point };
    case 'drain':
      return { text: `Flash flooding along the ${where} and nearby car parks in heavy rain`, occupants: users.drain };
    case 'playground':
      return { text: 'Injury risk to children; the playground must close until it is fixed', occupants: users.playground };
    default:
  }
  const lvl = e.level === 1 ? 'the ground floor' : `Level ${e.level}`;
  const all = buildingOccupants(b);
  const here = floorOccupants(b, e.level);
  switch (e.type) {
    case 'chiller':
      return { text: `Cooling capacity for all of ${b.name} halved`, occupants: all };
    case 'ahu':
      return { text: `No conditioned air on ${lvl}`, occupants: here };
    case 'fcu':
      return { text: `Warm zone in part of ${lvl}`, occupants: Math.round(here / 3) };
    case 'lift':
      return { text: `${e.name} out of service`, occupants: Math.round(all / b.floors[b.floorCount - 1].equipment.filter((x) => x.type === 'lift').length) };
    case 'booster_pump':
      return { text: `Low water pressure on upper floors of ${b.name}`, occupants: all };
    case 'sump_pump':
      return { text: 'Basement and pump room flooding risk in heavy rain', occupants: 0 };
    case 'fire_pump':
      return { text: `Sprinkler system pressure compromised in ${b.name} (life safety)`, occupants: all };
    case 'generator':
      return { text: `No backup power for ${b.name} during a grid outage`, occupants: all };
    case 'ups':
      return { text: `Data and comms loads on ${lvl} lose ride-through power`, occupants: here };
    case 'db':
      return { text: `Power loss on ${lvl}`, occupants: here };
    case 'bms':
      return { text: `Monitoring blind spot on ${lvl}`, occupants: 0 };
    case 'lighting':
      return { text: `Lighting flicker or outage on ${lvl}`, occupants: here };
    case 'lights':
      return { text: `Dark patches on ${lvl}, and escape routes may go unlit in a power cut (life safety)`, occupants: here };
    case 'slab':
      return { text: `Part of ${lvl} closed for structural repair`, occupants: Math.round(here / 2) };
    case 'roof':
      return { text: `Water ingress into the roof plant and the floor below`, occupants: ASSUMPTIONS.occupantsPerOfficeFloor };
    case 'pipe':
      return { text: `Leak and water damage on ${lvl} and the floors below`, occupants: here };
    case 'wiring':
      return { text: `Circuit trips and fire risk on ${lvl}`, occupants: here };
    default:
      return { text: 'Service disruption', occupants: 0 };
  }
}

// "3 days", "4 months", "2.5 years"
export function durationText(days) {
  if (days < 60) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${Math.round((days / 365) * 10) / 10} years`;
}

// Timing: act at 60% of the predicted days to failure, off-hours. Long windows
// become a planning or budget item rather than a work order.
export function actionOf(e, daysToFailure, overdueDays = 0) {
  const what = ACTIONS[e.fault] || 'Inspect and service';
  const verb = e.dataSource === 'inspection' ? 'Inspection' : 'Service';
  const overdueNote = overdueDays > 0 ? `${verb} overdue by ${durationText(overdueDays)}: book it now.` : null;
  if (daysToFailure === 0) return { what, when: 'Now, reading is past its alarm threshold', urgency: 'now', overdueNote };
  if (daysToFailure == null) {
    return { what, when: 'At the next routine service; no worsening trend', urgency: overdueNote ? 'soon' : 'routine', overdueNote };
  }
  const within = Math.max(1, Math.floor(daysToFailure * ACTION_AT));
  let when;
  let urgency;
  if (within <= 14) [when, urgency] = [`Within ${within} day${within === 1 ? '' : 's'}, off-hours`, 'soon'];
  else if (within <= 90) [when, urgency] = [`Plan within ${within} days, off-hours`, 'planned'];
  else if (within <= 730) [when, urgency] = [`Plan within ${durationText(within)}`, 'planned'];
  else [when, urgency] = [`Include in the ${DEMO_YEAR + Math.floor(within / 365)} capital plan`, 'budget'];
  return { what, when, urgency, overdueNote };
}

export function costOf(e) {
  const c = COSTS[e.type];
  return { planned: c.planned, emergency: c.emergency, avoided: c.emergency - c.planned };
}

export const rm = (n) => `RM ${n.toLocaleString('en-MY')}`;
