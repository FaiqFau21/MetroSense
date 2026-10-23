// Guest report channel: matching a tap on the map to an asset or a place, and
// the routing that follows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campus } from '../data/seed.js';
import { matchGuestReport, makeGuestReport, MATCH_RADIUS } from './guest.js';
import { routeCase } from './routing.js';
import { buildCases, openReports, repairedAssets } from './cases.js';
import { projectCampus } from './project.js';
import { COMPLAINTS } from '../data/complaints.js';

const site = campus.buildings.find((b) => b.kind === 'site');
const byName = (name) => site.equipment.find((e) => e.name === name);

test('guest: a tap near a streetlight matches the nearest streetlight', () => {
  const m = matchGuestReport({ categoryKey: 'streetlight', point: { x: 6, z: 20 } }, campus);
  assert.equal(m.assetId, byName('Streetlight SL-04').id);
  assert.ok(m.distance <= MATCH_RADIUS);
});

test('guest: drains match along their length, not only at the centre', () => {
  // 35 m from the centre of DR-1 but 5 m from the drain itself.
  const m = matchGuestReport({ categoryKey: 'drain', point: { x: 35, z: -54 } }, campus);
  assert.equal(m.assetId, byName('Drain DR-1').id);
});

test('guest: a tap far from any matching asset falls back to the nearest street', () => {
  const m = matchGuestReport({ categoryKey: 'playground', point: { x: -60, z: 60 } }, campus);
  assert.equal(m.assetId, null);
  assert.match(m.place, /^Near the /);
});

test('guest: a building problem is placed in the tapped building and routed to facilities', () => {
  const m = matchGuestReport({ categoryKey: 'building', point: { x: -34, z: -14 } }, campus);
  assert.equal(m.assetId, null);
  assert.equal(m.place, 'Tower A');
  assert.equal(m.category, 'Building problem');
  assert.equal(routeCase({ category: m.category }).partyKey, 'sdp_facilities');
  assert.equal(routeCase({ category: 'Other' }).partyKey, 'sdp_township');
});

test('guest: report has the shared report shape, with no photo unless one was attached', () => {
  const r = makeGuestReport({ n: 1, categoryKey: 'other', point: { x: 0, z: 0 }, reporter: '', text: 'Broken bench by the walkway', photoUrl: null }, campus);
  assert.equal(r.id, 'R-3001');
  assert.equal(r.channel, 'web');
  assert.equal(r.reporter, 'Guest');
  assert.equal(r.photo, null);
  assert.equal(r.category, 'Other');
  assert.ok(r.title);
});

test('guest: a matched report joins the existing case for that asset', () => {
  const r = makeGuestReport({ n: 1, categoryKey: 'streetlight', point: { x: 4, z: 18 }, reporter: 'Visitor', text: 'Light flickering at night', photoUrl: null }, campus);
  const casesWith = (complaints) => {
    const caseState = new Map();
    const ctx = { reports: openReports(caseState, complaints), repairs: repairedAssets(caseState) };
    return buildCases({
      today: projectCampus(campus, 0, 'normal', new Map(), ctx),
      week: projectCampus(campus, 7, 'weather', new Map(), ctx),
      weekNormal: projectCampus(campus, 7, 'normal', new Map(), ctx),
      caseState,
      complaints,
    });
  };
  const before = casesWith(COMPLAINTS);
  const after = casesWith([...COMPLAINTS, r]);
  assert.equal(after.length, before.length);
  const c = after.find((x) => x.assetId === r.assetId);
  assert.ok(c.reports.some((x) => x.id === 'R-3001'));
});
