// Asset catalogue (CLAUDE.md section 4). Every figure here is a stated assumption
// for the simulation (typical industry rules of thumb), not manufacturer data.
//
// Lifecycle fields per asset type:
//   designLifeYears      how long before it is replaced
//   serviceIntervalDays  how often it is serviced (sensor assets) or inspected
//                        (inspection assets)
//   warningDays          typical warning time (P-F interval): first detectable
//                        sign of trouble to actual failure
//   horizonDays          how far ahead we forecast it: the first slider stop that
//                        covers its warning time (derived below)
//   dataSource           where readings come from (DATA_SOURCES below):
//                        'sensor'     daily readings from the BMS or the equipment's
//                                     own controller (big plant usually has these)
//                        'manual'     a technician reads a gauge or meter on a
//                                     walk-round every readingIntervalDays
//                        'inspection' a reading taken at each scheduled inspection
//   readingIntervalDays  days between readings (derived for sensor and inspection)

// Slider stops, in days: today, 7 days, 30 days, 90 days, 1 year, 5 years.
export const FORECAST_STOPS = [0, 7, 30, 90, 365, 1825];

export const DATA_SOURCES = {
  sensor: { label: 'Daily sensor', long: 'BMS or equipment controller, daily readings' },
  manual: { label: 'Technician', long: 'Technician reading on a walk-round' },
  inspection: { label: 'Inspection', long: 'Reading taken at each scheduled inspection' },
};

export const GROUPS = {
  structure: { label: 'Structure & envelope', note: 'Decays over years; found by periodic inspection.' },
  networks: { label: 'Piping & wiring', note: 'Long-lived; inspected and tested on a schedule.' },
  plant: { label: 'Major plant', note: 'Central equipment; sensors give weeks to months of warning.' },
  services: { label: 'Building services', note: 'Aircond, pumps and power on each floor; days to weeks of warning.' },
  controls: { label: 'Sensors & controls', note: 'Fail quickly with little warning.' },
  public: { label: 'Public realm', note: 'Streetlights, drains, bin centres and parks residents use every day; most reports come from here.' },
};

// Item and model shown on dispatches ("name of the item and model"). Generic
// specs for the demo, not real product records.
export const MODELS = {
  chiller: ['Water-cooled screw chiller, 450 RT', 'Air-cooled scroll chiller, 200 RT'],
  ahu: ['Air handling unit, 12,000 CMH, EC fans', 'Air handling unit, 8,000 CMH, belt drive'],
  fcu: ['Ceiling cassette FCU, 2.5 kW', 'Ducted FCU, 3.5 kW'],
  lift: ['Machine-room-less traction lift, 1,350 kg', 'Traction lift, 1,600 kg'],
  booster_pump: ['Vertical multistage booster set, 7.5 kW'],
  sump_pump: ['Submersible sump pump, 2.2 kW'],
  fire_pump: ['End-suction fire pump with jockey pump, 37 kW'],
  generator: ['Diesel standby generator, 1,000 kVA'],
  ups: ['Modular UPS, 60 kVA, VRLA batteries', 'UPS, 40 kVA, VRLA batteries'],
  db: ['Distribution board, 250 A TPN'],
  bms: ['BMS temperature/humidity sensor, BACnet'],
  lighting: ['Lighting control panel, DALI'],
  lights: ['LED panel lights with maintained emergency fittings', 'LED downlights with self-test emergency fittings'],
  slab: ['Reinforced concrete flat slab, 250 mm'],
  roof: ['Torch-on bitumen membrane on RC roof slab'],
  pipe: ['Galvanised steel cold-water riser, 100 mm'],
  wiring: ['PVC/PVC copper sub-circuit cabling'],
  streetlight: ['LED streetlight, 120 W, 8 m pole', 'LED streetlight, 90 W, 6 m pole'],
  waste_point: ['Bin centre, 6 × 660 L wheeled bins'],
  drain: ['600 mm precast concrete U-drain'],
  playground: ['Modular play frame with rubber safety surfacing'],
};

export const CATALOGUE = {
  chiller: {
    label: 'Chiller', group: 'plant', category: 'HVAC', zone: 'Plant room', dataSource: 'sensor',
    metric: 'Compressor vibration', unit: 'mm/s', baseline: 2.0, threshold: 7.1,
    designLifeYears: 20, serviceIntervalDays: 90, warningDays: 60,
    faults: ['Chiller compressor bearing wear', 'Chiller low refrigerant charge'],
  },
  ahu: {
    label: 'AHU', group: 'services', category: 'HVAC', zone: 'AHU room', dataSource: 'sensor',
    metric: 'Filter differential pressure', unit: 'Pa', baseline: 120, threshold: 250,
    designLifeYears: 20, serviceIntervalDays: 90, warningDays: 21,
    faults: ['AHU filter blockage', 'AHU fan belt wear', 'AHU coil fouling'],
  },
  fcu: {
    label: 'FCU', group: 'services', category: 'HVAC', zone: 'AHU room', dataSource: 'manual', readingIntervalDays: 30,
    metric: 'Filter differential pressure', unit: 'Pa', baseline: 60, threshold: 150,
    designLifeYears: 15, serviceIntervalDays: 90, warningDays: 21,
    faults: ['FCU filter blockage', 'FCU coil fouling'],
  },
  lift: {
    label: 'Lift', group: 'plant', category: 'Vertical transport', zone: 'Lift machine room', dataSource: 'sensor',
    metric: 'Door faults per 1,000 trips', unit: '/1k trips', baseline: 0.5, threshold: 4,
    designLifeYears: 25, serviceIntervalDays: 30, warningDays: 30,
    faults: ['Lift door operator fault trend', 'Lift rope wear'],
  },
  booster_pump: {
    label: 'Booster pump', group: 'services', category: 'Plumbing and water', zone: 'Pump room', dataSource: 'manual', readingIntervalDays: 7,
    metric: 'Pump vibration', unit: 'mm/s', baseline: 1.8, threshold: 7.1,
    designLifeYears: 15, serviceIntervalDays: 90, warningDays: 21,
    faults: ['Booster pump seal leak', 'Booster pump bearing wear'],
  },
  sump_pump: {
    label: 'Sump pump', group: 'services', category: 'Plumbing and water', zone: 'Pump room', dataSource: 'manual', readingIntervalDays: 7,
    metric: 'Pump vibration', unit: 'mm/s', baseline: 1.8, threshold: 7.1,
    designLifeYears: 12, serviceIntervalDays: 90, warningDays: 14,
    faults: ['Sump pump bearing wear', 'Sump pump seal leak'],
  },
  fire_pump: {
    label: 'Fire pump', group: 'plant', category: 'Fire and life safety', zone: 'Pump room', dataSource: 'sensor',
    metric: 'Pressure below set point', unit: 'bar', baseline: 0.1, threshold: 1.5,
    designLifeYears: 25, serviceIntervalDays: 30, warningDays: 60,
    faults: ['Fire pump low pressure trend'],
  },
  generator: {
    label: 'Generator', group: 'plant', category: 'Electrical', zone: 'Plant room', dataSource: 'sensor',
    metric: 'Start-up voltage drop', unit: '%', baseline: 5, threshold: 20,
    designLifeYears: 25, serviceIntervalDays: 30, warningDays: 60,
    faults: ['Generator starter battery weak', 'Generator starter motor fault'],
  },
  ups: {
    label: 'UPS', group: 'services', category: 'Electrical', zone: 'DB room', dataSource: 'sensor',
    metric: 'Battery capacity loss', unit: '%', baseline: 2, threshold: 30,
    designLifeYears: 10, serviceIntervalDays: 180, warningDays: 90,
    faults: ['UPS battery capacity fade'],
  },
  db: {
    label: 'DB', group: 'services', category: 'Electrical', zone: 'DB room', dataSource: 'manual', readingIntervalDays: 90,
    metric: 'Hotspot above ambient (thermal camera)', unit: '°C', baseline: 5, threshold: 30,
    designLifeYears: 25, serviceIntervalDays: 365, warningDays: 45,
    faults: ['Switchboard terminal overheating', 'Distribution board loose terminal'],
  },
  bms: {
    label: 'BMS sensor', group: 'controls', category: 'Controls and network', zone: 'Electrical riser', dataSource: 'sensor',
    metric: 'Packet loss', unit: '%', baseline: 0.5, threshold: 10,
    designLifeYears: 10, serviceIntervalDays: 180, warningDays: 5,
    faults: ['BMS sensor drifting or offline'],
  },
  lighting: {
    label: 'Lighting panel', group: 'services', category: 'Lighting and power quality', zone: 'Electrical riser', dataSource: 'manual', readingIntervalDays: 90,
    metric: 'Total harmonic distortion (power-quality meter)', unit: '%', baseline: 3, threshold: 8,
    designLifeYears: 15, serviceIntervalDays: 180, warningDays: 30,
    faults: ['Lighting circuit harmonic distortion', 'Dimming controller fault'],
  },
  // The light fittings and emergency lights on an office floor, as one asset.
  // Checked monthly (walk-round count plus the emergency-light test switch) and
  // given a full 3-hour emergency duration test every year.
  lights: {
    label: 'Lights & emergency lights', group: 'services', category: 'Fire and life safety', zone: 'Open office', dataSource: 'manual', readingIntervalDays: 30,
    metric: 'Failed light fittings and emergency lights (monthly check)', unit: '%', baseline: 1, threshold: 10,
    designLifeYears: 15, serviceIntervalDays: 365, warningDays: 60,
    faults: ['Light fittings failing (dark patches)', 'Emergency light batteries failing duration test'],
  },

  // Long-lived assets, tracked by inspection rather than live sensors.
  slab: {
    label: 'Floor slab', group: 'structure', category: 'Structure and envelope', zone: 'Floor plate', dataSource: 'inspection',
    metric: 'Max crack width', unit: 'mm', baseline: 0.1, threshold: 0.3,
    designLifeYears: 50, serviceIntervalDays: 365, warningDays: 1095,
    faults: ['Slab cracking widening', 'Reinforcement corrosion (spalling)'],
  },
  roof: {
    label: 'Roof waterproofing', group: 'structure', category: 'Structure and envelope', zone: 'Roof deck', dataSource: 'inspection',
    metric: 'Wet area on moisture survey', unit: '% of roof', baseline: 2, threshold: 15,
    designLifeYears: 15, serviceIntervalDays: 182, warningDays: 270,
    faults: ['Roof membrane deterioration', 'Ponding and leak risk at roof drains'],
  },
  pipe: {
    label: 'Water pipework', group: 'networks', category: 'Plumbing and water', zone: 'Wet riser', dataSource: 'inspection',
    metric: 'Pipe wall loss (ultrasonic test)', unit: '%', baseline: 5, threshold: 40,
    designLifeYears: 30, serviceIntervalDays: 365, warningDays: 730,
    faults: ['Pipe internal corrosion', 'Joint leak risk'],
  },
  wiring: {
    label: 'Floor wiring', group: 'networks', category: 'Electrical', zone: 'DB room', dataSource: 'inspection',
    metric: 'Earth leakage current', unit: 'mA', baseline: 2, threshold: 30,
    designLifeYears: 30, serviceIntervalDays: 182, warningDays: 180,
    faults: ['Insulation breakdown (earth leakage rising)', 'Overloaded circuit cabling'],
  },
};

// Township public realm around the buildings (Ara Damansara demo).
Object.assign(CATALOGUE, {
  streetlight: {
    label: 'Streetlight', group: 'public', category: 'Lighting and power quality', zone: 'Street', dataSource: 'manual', readingIntervalDays: 30,
    metric: 'Light output loss (night patrol check)', unit: '%', baseline: 5, threshold: 40,
    designLifeYears: 15, serviceIntervalDays: 365, warningDays: 45,
    faults: ['Streetlight LED driver failing (flickering)', 'Photocell fault (lamp on in daytime)'],
  },
  waste_point: {
    label: 'Bin centre', group: 'public', category: 'Environment and cleanliness', zone: 'Street', dataSource: 'manual', readingIntervalDays: 7,
    metric: 'Bin fill at collection time', unit: '%', baseline: 60, threshold: 100,
    designLifeYears: 10, serviceIntervalDays: 30, warningDays: 7,
    faults: ['Bins overflowing between collections', 'Damaged bins and pest activity'],
  },
  drain: {
    label: 'Drain', group: 'public', category: 'Plumbing and water', zone: 'Street', dataSource: 'inspection',
    metric: 'Silt blockage (share of drain depth)', unit: '%', baseline: 5, threshold: 50,
    designLifeYears: 40, serviceIntervalDays: 30, warningDays: 30,
    faults: ['Silt build-up reducing drain capacity', 'Culvert blocked by debris (flash-flood risk)'],
  },
  playground: {
    label: 'Playground', group: 'public', category: 'Public safety', zone: 'Park', dataSource: 'inspection',
    metric: 'Safety defect score at inspection', unit: 'points', baseline: 0, threshold: 5,
    designLifeYears: 15, serviceIntervalDays: 30, warningDays: 60,
    faults: ['Loose fixings and worn safety surfacing'],
  },
});

// Forecast range follows the warning time: forecasting further than the warning
// time adds noise, forecasting less hides the problem.
for (const spec of Object.values(CATALOGUE)) {
  spec.horizonDays = FORECAST_STOPS.find((s) => s >= spec.warningDays) ?? FORECAST_STOPS.at(-1);
  if (spec.dataSource === 'sensor') spec.readingIntervalDays = 1;
  if (spec.dataSource === 'inspection') spec.readingIntervalDays = spec.serviceIntervalDays;
}

// Rule of thumb from reliability-centred maintenance: check at least twice within
// the warning time, or a fault can start and finish between two checks.
export const checkGap = (spec) => spec.readingIntervalDays > spec.warningDays / 2;
