// Turns a guest's report into the same shape as the other reports, so it flows
// through the same case builder and routing. Pure.

import { GUEST_CATEGORIES } from '../data/accounts.js';

// Max distance (campus metres) from the tap to an asset for an automatic match.
export const MATCH_RADIUS = 30;

// Distance from a point to an asset; drains are line segments.
function distanceTo(e, x, z) {
  if (e.type === 'drain') {
    const half = e.length / 2;
    const dx = e.axis === 'x' ? Math.max(0, Math.abs(x - e.wx) - half) : x - e.wx;
    const dz = e.axis === 'z' ? Math.max(0, Math.abs(z - e.wz) - half) : z - e.wz;
    return Math.hypot(dx, dz);
  }
  return Math.hypot(x - e.wx, z - e.wz);
}

export function matchGuestReport({ categoryKey, point }, campus) {
  const cat = GUEST_CATEGORIES.find((c) => c.key === categoryKey);
  const site = campus.buildings.find((b) => b.kind === 'site');
  const { x, z } = point;

  if (cat.types.length) {
    const nearest = site.equipment
      .filter((e) => cat.types.includes(e.type))
      .map((e) => ({ e, d: distanceTo(e, x, z) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearest && nearest.d <= MATCH_RADIUS) {
      return { assetId: nearest.e.id, asset: nearest.e, place: `${site.name}: ${nearest.e.zone}`, distance: nearest.d };
    }
  }
  const building = campus.buildings.find(
    (b) => b.kind !== 'site' && Math.abs(x - b.x) <= b.footprintW / 2 && Math.abs(z - b.z) <= b.footprintD / 2,
  );
  const street = site.equipment
    .map((e) => ({ e, d: distanceTo(e, x, z) }))
    .sort((a, b) => a.d - b.d)[0]?.e.zone;
  return {
    assetId: null,
    asset: null,
    place: building ? building.name : `Near the ${street?.toLowerCase() ?? 'campus'}`,
    category: cat.category ?? 'Other',
  };
}

// The report itself, in the same shape as data/complaints.js entries.
export function makeGuestReport({ n, categoryKey, point, reporter, text, photoUrl, lang = 'en' }, campus) {
  const cat = GUEST_CATEGORIES.find((c) => c.key === categoryKey);
  const m = matchGuestReport({ categoryKey, point }, campus);
  return {
    id: `R-${3000 + n}`,
    channel: 'web',
    daysAgo: 0,
    time: '10:00',
    reporter: reporter || 'Guest',
    text,
    lang,
    photo: photoUrl ? 'upload' : null,
    photoUrl: photoUrl || null,
    assetId: m.assetId,
    ...(m.assetId ? {} : { place: m.place, category: m.category, item: cat.label, title: `${cat.label} (guest report)` }),
    matchedName: m.asset?.name ?? null,
    matchedPlace: m.place,
  };
}
