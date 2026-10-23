// Plain-language description of each asset: what it is, what it serves and
// where. Generic text per type for the demo, not real equipment records.

const where = (e, b) => (b.kind === 'site' ? e.zone.toLowerCase() : `${b.name}, ${b.floors[e.level - 1].label}`);

const DESCRIBE = {
  chiller: (e, b) => `Produces chilled water for the air-conditioning in ${b.name}. It sits in the roof plant room; the air handlers and fan coils on every floor depend on it.`,
  ahu: (e, b) => `Air handling unit for ${where(e, b)}. It filters, cools and supplies fresh air to the office floor through the ceiling ducts.`,
  fcu: (e, b) => `Fan coil unit giving local cooling to part of ${where(e, b)}, such as a meeting room or a corner office.`,
  lift: (e, b) => `Passenger lift serving all ${b.floorCount} floors of ${b.name}. The door operator and the ropes are the parts that wear most.`,
  booster_pump: (e, b) => `Pumps mains water up to the roof tanks and the taps on the upper floors of ${b.name}.`,
  sump_pump: (e, b) => `Pumps out groundwater and stormwater that collects in the basement sump of ${b.name}, so the lowest level does not flood.`,
  fire_pump: (e, b) => `Keeps the sprinkler and hose-reel system in ${b.name} pressurised and ready for a fire. It must start on demand, so it is test-run every week.`,
  generator: (e, b) => `Standby diesel generator for ${b.name}. It starts automatically in a power cut to keep the lifts, fire systems and emergency lighting running.`,
  ups: (e, b) => `Uninterruptible power supply in ${where(e, b)}. It bridges the seconds until the generator starts, protecting the server room and security systems.`,
  db: (e, b) => `Distribution board feeding the lighting and power circuits on ${where(e, b)}.`,
  bms: (e, b) => `Building management system sensor reporting temperature and humidity on ${where(e, b)}, so the air-conditioning can respond.`,
  lighting: (e, b) => `Lighting control panel that switches and dims the lights on ${where(e, b)} by schedule and occupancy.`,
  lights: (e, b) => `The light fittings and emergency lights on ${where(e, b)}. Emergency lights must keep the escape routes lit for 3 hours in a power cut, so they are checked monthly and fully tested every year.`,
  slab: (e, b) => `Reinforced concrete floor slab of ${where(e, b)}. Structural inspections check it for cracking and corrosion.`,
  roof: (e, b) => `Waterproof roof membrane over ${b.name}. It protects the top floor and the roof plant from rain.`,
  pipe: (e, b) => `Cold-water riser and branch pipework serving ${where(e, b)}.`,
  wiring: (e, b) => `Power and lighting cabling on ${where(e, b)}, from the distribution board to the sockets and light fittings.`,
  streetlight: (e, b) => `Street lighting along the ${where(e, b)}. It lights the walkway for pedestrians and drivers from dusk to dawn.`,
  waste_point: (e, b) => `Communal bin centre at the ${where(e, b)}, emptied by the council's waste collection contractor.`,
  drain: (e, b) => `Open U-drain along the ${where(e, b)}. It carries stormwater away; silt and litter reduce its capacity in heavy rain.`,
  playground: (e, b) => `Children's play area at the ${where(e, b)}, with a play frame and rubber safety surfacing.`,
};

export function describe(e, b) {
  return DESCRIBE[e.type]?.(e, b) ?? `${e.name} in ${where(e, b)}.`;
}
