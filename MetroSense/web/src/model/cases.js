// Maintenance cases: the loop from "something is wrong" to "fixed".
//   - Reactive: resident reports about the same asset (or place) become one case.
//   - Proactive: assets the model expects to be high risk within 7 days, using
//     the weather forecast, become a case even if nobody has complained yet.
//   - Each case is routed to whoever is responsible (routing.js), given a
//     priority and due time, and tracked: New -> Dispatched -> In progress -> Resolved.
//   - Resolving a case resets the asset (repairs) and closes its reports, which
//     feeds back into the risk model.
// Pure: the same inputs always give the same cases.

import { COMPLAINTS, CASE_HISTORY, CHANNELS, NOW_HOUR } from '../data/complaints.js';
import { routeCase, priorityOf, SLA_HOURS } from './routing.js';
import { HIGH_RISK_MIN } from './project.js';

export const STATUSES = ['New', 'Dispatched', 'In progress', 'Resolved'];
const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };

function hash4(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, '0');
}
export const caseIdFor = (key) => `WO-${hash4(key)}`;

// Hours before "now" (10:00 on the demo day).
export function hoursAgo(daysAgo, time = '06:00') {
  const [h, m] = time.split(':').map(Number);
  return daysAgo * 24 + NOW_HOUR - (h + m / 60);
}

// Reports grouped per asset, or per place for things not in the asset register.
export function reportGroups(complaints = COMPLAINTS) {
  const groups = new Map();
  for (const c of complaints) {
    const key = c.assetId ?? `place:${c.place}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return groups;
}

export function caseStatus(key, caseState) {
  return caseState.get(caseIdFor(key))?.status ?? CASE_HISTORY[key]?.at(-1).status ?? 'New';
}

// Open resident reports per asset: evidence for the risk model.
export function openReports(caseState, complaints = COMPLAINTS) {
  const out = new Map();
  for (const [key, reps] of reportGroups(complaints)) {
    if (reps[0].assetId && caseStatus(key, caseState) !== 'Resolved') out.set(reps[0].assetId, reps.length);
  }
  return out;
}

// Assets whose case was resolved during this session: they count as repaired.
export function repairedAssets(caseState) {
  return new Set([...caseState.values()].filter((s) => s.status === 'Resolved' && s.assetId).map((s) => s.assetId));
}

const indexAssets = (campus) =>
  new Map(campus.buildings.flatMap((b) => b.equipment.map((e) => [e.id, { e, b }])));

function locationOf(e, b) {
  if (b.kind === 'site') return `${b.name}: ${e.zone}`;
  return `${b.name}, ${b.floors[e.level - 1].label} · ${e.zone}`;
}

function makeCase({ key, reports, hit, week, weekNormal, caseState }) {
  const e = hit?.e;
  const b = hit?.b;
  const first = reports[0];
  const route = routeCase({ type: e?.type, category: e ? null : first.category });
  const risk = e?.risk ?? null;
  const priority = priorityOf({ type: e?.type, risk, reports: reports.length });
  const createdHoursAgo = reports.length
    ? Math.max(...reports.map((r) => hoursAgo(r.daysAgo, r.time)))
    : hoursAgo(0, '06:00'); // overnight model run
  const id = caseIdFor(key);
  const session = caseState.get(id);
  const history = CASE_HISTORY[key] ?? [];
  const status = session?.status ?? history.at(-1)?.status ?? 'New';

  const predicted = !!e && ((risk ?? 0) >= HIGH_RISK_MIN || (week?.risk ?? 0) >= HIGH_RISK_MIN);
  // Weather made the difference if the asset is high risk next week with the
  // forecast, but not without it.
  const weather = !!e && (week?.risk ?? 0) >= HIGH_RISK_MIN && (weekNormal?.risk ?? 0) < HIGH_RISK_MIN;

  const events = [];
  for (const r of reports) {
    events.push({ hoursAgo: hoursAgo(r.daysAgo, r.time), text: `${r.id} reported via ${CHANNELS[r.channel]} by ${r.reporter.toLowerCase()}` });
  }
  if (!reports.length && e) {
    events.push({
      hoursAgo: createdHoursAgo,
      text: e.spike
        ? `Sensor alert: ${e.metric.toLowerCase()} jumped past its alarm level`
        : `Flagged by the model: ${Math.round((weather ? week.risk : Math.max(risk ?? 0, week?.risk ?? 0)) * 100)}% risk${weather ? ' next week with the forecast heavy rain' : ''}`,
    });
  }
  if (reports.length && e) {
    events.push({ hoursAgo: createdHoursAgo - 0.01, text: `Matched to ${e.name} (same place and type of problem)` });
  }
  events.push({ hoursAgo: createdHoursAgo - 0.02, text: `Routed to ${route.party.name}: ${route.why.toLowerCase()}` });
  for (const h of history) {
    events.push({ hoursAgo: hoursAgo(h.daysAgo, h.time), text: h.note ? `${h.status}: ${h.note}` : `${h.status} (${route.party.name})` });
  }
  events.sort((a, c) => c.hoursAgo - a.hoursAgo);
  for (const s of session?.events ?? []) events.push({ hoursAgo: 0, text: s });

  const slaHours = SLA_HOURS[priority];
  return {
    id, key,
    assetId: e?.id ?? null, buildingId: e?.buildingId ?? null, level: e?.level ?? null,
    title: e ? e.fault : first.title,
    category: e?.category ?? first.category,
    item: e?.name ?? first.item,
    model: e?.model ?? 'Not in the asset register',
    location: e ? locationOf(e, b) : first.place,
    party: route.party, partyKey: route.partyKey ?? null, why: route.why,
    priority, slaHours,
    dueInHours: slaHours - createdHoursAgo,
    createdHoursAgo,
    status,
    reports,
    photos: reports.filter((r) => r.photo).map((r) => ({ kind: r.photo, url: r.photoUrl ?? null, reportId: r.id })),
    risk, riskWeek: week?.risk ?? null, daysToFailure: e?.daysToFailure ?? null,
    sources: { reports: reports.length, channels: [...new Set(reports.map((r) => CHANNELS[r.channel]))], predicted, sensor: !!e?.spike, weather },
    events,
  };
}

// today:      campus projected to day 0
// week:       campus projected to day 7 with the weather forecast
// weekNormal: campus projected to day 7 without it (to credit the weather)
export function buildCases({ today, week, weekNormal, caseState = new Map(), complaints = COMPLAINTS }) {
  const now = indexAssets(today);
  const next = indexAssets(week);
  const nextNormal = indexAssets(weekNormal);
  const groups = reportGroups(complaints);
  const cases = [];

  for (const [key, reports] of groups) {
    const hit = reports[0].assetId ? now.get(reports[0].assetId) : null;
    cases.push(makeCase({
      key, reports, hit, week: hit && next.get(hit.e.id)?.e, weekNormal: hit && nextNormal.get(hit.e.id)?.e, caseState,
    }));
  }
  for (const [id, hit] of now) {
    if (groups.has(id)) continue;
    const w = next.get(id)?.e;
    if ((hit.e.risk ?? 0) < HIGH_RISK_MIN && (w?.risk ?? 0) < HIGH_RISK_MIN) continue;
    cases.push(makeCase({ key: id, reports: [], hit, week: w, weekNormal: nextNormal.get(id)?.e, caseState }));
  }

  return cases.sort((a, b) =>
    (a.status === 'Resolved') - (b.status === 'Resolved')
    || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || a.dueInHours - b.dueInHours);
}

// Who may move a case on. Township managers (access 'all') can act on every case,
// including recording progress on behalf of outside parties (contractors, the
// council, vendors) who do not use MetroSense. Team staff (access 'team') can
// accept, start and resolve cases routed to their own team; other cases are
// read-only for them.
export const NEXT_ACTION = { New: 'dispatch', Dispatched: 'start', 'In progress': 'resolve' };

export function canAct(user, c) {
  if (!user || c.status === 'Resolved') return false;
  return user.access === 'all' || c.partyKey === user.team;
}

// Timeline line for a status change, saying who recorded it.
export function actorNote(user, c) {
  if (!user) return '';
  const own = c.partyKey === user.team;
  return own ? `by ${user.name}` : `by ${user.name} on behalf of ${c.party.name}`;
}

// Assets with a repair dispatched or under way, for the map and lists.
export function workByAsset(cases) {
  return new Map(cases.filter((c) => c.assetId && (c.status === 'Dispatched' || c.status === 'In progress')).map((c) => [c.assetId, c.status]));
}

// Text of the work order sent to the responsible party (shown before sending).
export function dispatchMessage(c) {
  const lines = [
    `To: ${c.party.name} (${c.party.channel})`,
    `Case ${c.id} · priority ${c.priority} · respond within ${c.slaHours} h`,
    `Location: ${c.location}`,
    `Item: ${c.item} · ${c.model}`,
    `Problem: ${c.title}`,
  ];
  if (c.risk != null) lines.push(`Predicted risk: ${Math.round(c.risk * 100)}% today${c.riskWeek != null ? `, ${Math.round(c.riskWeek * 100)}% in 7 days` : ''}`);
  if (c.reports.length) lines.push(`Reports: ${c.reports.length} (${c.sources.channels.join(', ')})`);
  if (c.photos.length) lines.push(`Photos: ${c.photos.length} attached from resident reports`);
  return lines.join('\n');
}
