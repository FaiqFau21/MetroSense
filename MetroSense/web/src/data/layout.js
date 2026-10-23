// Generic, illustrative floor layout shared by every floor. Coordinates are
// fractions of the building footprint (x across the width, y across the depth).
// Not based on any real floor plan.

export const ZONES = {
  'Plant room': { x: 0.04, y: 0.06, w: 0.3, h: 0.34 },
  'AHU room': { x: 0.04, y: 0.06, w: 0.26, h: 0.3 },
  'Pump room': { x: 0.04, y: 0.6, w: 0.3, h: 0.34 },
  'DB room': { x: 0.68, y: 0.06, w: 0.28, h: 0.28 },
  'Electrical riser': { x: 0.63, y: 0.38, w: 0.07, h: 0.26 },
  'Wet riser': { x: 0.74, y: 0.4, w: 0.07, h: 0.24 },
  'Lift machine room': { x: 0.38, y: 0.36, w: 0.22, h: 0.28 },
  'Floor plate': { x: 0.4, y: 0.72, w: 0.3, h: 0.2 },
  'Open office': { x: 0.74, y: 0.7, w: 0.22, h: 0.24 },
  'Roof deck': { x: 0.4, y: 0.72, w: 0.3, h: 0.2 },
};

// The lift lobby core is drawn on every floor below the roof.
export const CORE = { name: 'Lift lobby', x: 0.38, y: 0.36, w: 0.22, h: 0.28 };

// Spread n items along the longer side of a zone, staggered across the shorter
// side so their labels do not sit on top of each other; returns {x, y} fractions.
export function placeInZone(zoneName, index, count) {
  const z = ZONES[zoneName];
  const t = (index + 1) / (count + 1);
  const s = count > 1 ? (index % 2 ? 0.7 : 0.3) : 0.5;
  return z.w >= z.h
    ? { x: z.x + z.w * t, y: z.y + z.h * s }
    : { x: z.x + z.w * s, y: z.y + z.h * t };
}
