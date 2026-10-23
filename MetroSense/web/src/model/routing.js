// Who fixes what. Routing is a table per township, because responsibility depends
// on the state and on what has been handed over to the council. This is the
// Ara Damansara (Selangor) table, built from general knowledge as a demo
// assumption: confirm it with SDP township management before a pilot.

export const PARTIES = {
  sdp_township: { name: 'SDP Township Management', kind: 'SDP', channel: 'Work order in the township maintenance system' },
  sdp_facilities: { name: 'SDP Building Facilities', kind: 'SDP', channel: 'Work order in the facilities maintenance system' },
  lift_contractor: { name: 'Lift maintenance contractor', kind: 'Contractor', channel: "Contractor's service portal" },
  council: { name: 'Local council (MBPJ)', kind: 'Local authority', channel: "Council's complaint system" },
  waste_contractor: { name: "Council's waste collection contractor", kind: 'Local authority contractor', channel: 'Through the council' },
  vendor: { name: 'Appliance vendor service team', kind: 'Vendor', channel: "Vendor's service line" },
};

const BUILDING_SYSTEMS = [
  'chiller', 'ahu', 'fcu', 'booster_pump', 'sump_pump', 'fire_pump', 'generator', 'ups', 'db', 'bms', 'lighting', 'lights',
  'slab', 'roof', 'pipe', 'wiring',
];

export const ROUTING = {
  township: 'Ara Damansara',
  state: 'Selangor',
  rules: [
    { types: BUILDING_SYSTEMS, party: 'sdp_facilities', why: 'Building systems in buildings SDP manages' },
    { types: ['lift'], party: 'lift_contractor', why: 'Lifts are serviced by the lift maker under a maintenance contract' },
    { types: ['streetlight', 'playground'], party: 'sdp_township', why: 'Township common areas stay with SDP until they are handed over to the council' },
    { types: ['drain'], party: 'council', why: 'Public drains are maintained by the local council' },
    { types: ['waste_point'], party: 'waste_contractor', why: 'In Selangor, waste collection is arranged by the local council' },
    { categories: ['Pantry appliance'], party: 'vendor', why: "Rental appliances are serviced by the vendor's own team" },
    { categories: ['Building problem'], party: 'sdp_facilities', why: 'Problems inside SDP-managed buildings go to the facilities team to triage' },
    { categories: ['Other'], party: 'sdp_township', why: 'Anything else goes to township management to triage' },
  ],
};

// How the same routing would differ in other SDP states (shown on the
// assumptions page to make the per-township point; to confirm per township).
export const OTHER_STATES = [
  ['Selangor (e.g. Ara Damansara, Elmina, Bandar Bukit Raja)', "Local council's waste collection contractor"],
  ['Negeri Sembilan, Johor (e.g. Nilai Impian, Bandar Ainsdale, Taman Pasir Putih)', 'SWCorp and its regional concession company'],
  ['Kedah (upcoming Gurun township)', 'SWCorp and its regional concession company (E-Idaman)'],
];

export function routeCase({ type, category }) {
  const rule = ROUTING.rules.find((r) => (type && r.types?.includes(type)) || (category && r.categories?.includes(category)));
  if (!rule) return { party: { name: 'SDP Township Management (triage)', kind: 'SDP', channel: 'Triage queue' }, why: 'No rule matched: SDP triages it by hand' };
  return { party: PARTIES[rule.party], partyKey: rule.party, why: rule.why };
}

// Priority from risk, reports and whether a failure is a safety issue.
const SAFETY = new Set(['lift', 'fire_pump', 'drain', 'playground', 'streetlight', 'db', 'wiring']);
export const SLA_HOURS = { P1: 8, P2: 48, P3: 120 };

export function priorityOf({ type, risk, reports }) {
  if (risk == null) return reports > 0 ? 'P2' : 'P3';
  if (risk >= 0.7 || (SAFETY.has(type) && reports > 0 && risk >= 0.5)) return 'P1';
  if (risk >= 0.5 || reports >= 2 || (SAFETY.has(type) && reports > 0)) return 'P2';
  return 'P3';
}
