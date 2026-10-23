// Who can move a case on, and how work under way shows on the map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campus } from '../data/seed.js';
import { STAFF_ACCOUNTS } from '../data/accounts.js';
import { GUEST_TEXT } from '../data/guestText.js';
import { GUEST_CATEGORIES, GUEST_ROLES } from '../data/accounts.js';
import { projectCampus, withWork } from './project.js';
import { buildCases, openReports, repairedAssets, canAct, actorNote, workByAsset } from './cases.js';

const [manager, engineer] = STAFF_ACCOUNTS;

const casesFor = (caseState = new Map()) => {
  const ctx = { reports: openReports(caseState), repairs: repairedAssets(caseState) };
  return buildCases({
    today: projectCampus(campus, 0, 'normal', new Map(), ctx),
    week: projectCampus(campus, 7, 'weather', new Map(), ctx),
    weekNormal: projectCampus(campus, 7, 'normal', new Map(), ctx),
    caseState,
  });
};

test('permissions: the township manager can act on every open case', () => {
  for (const c of casesFor().filter((x) => x.status !== 'Resolved')) assert.ok(canAct(manager, c), c.id);
});

test('permissions: the engineer can act only on the facilities team\'s cases', () => {
  const cases = casesFor().filter((x) => x.status !== 'Resolved');
  const own = cases.filter((c) => c.partyKey === engineer.team);
  const other = cases.filter((c) => c.partyKey !== engineer.team);
  assert.ok(own.length > 0 && other.length > 0);
  assert.ok(own.every((c) => canAct(engineer, c)));
  assert.ok(other.every((c) => !canAct(engineer, c)));
});

test('permissions: nobody acts on a resolved case; the timeline says who acted for whom', () => {
  const c = casesFor().find((x) => x.partyKey === 'lift_contractor');
  assert.equal(canAct(manager, { ...c, status: 'Resolved' }), false);
  assert.match(actorNote(manager, c), /on behalf of Lift maintenance contractor/);
  const own = casesFor().find((x) => x.partyKey === engineer.team);
  assert.equal(actorNote(engineer, own), 'by Daniel Lee');
});

test('work status: in-progress repairs are marked on the asset but keep its risk until resolved', () => {
  const ahuCase = casesFor().find((c) => c.assetId === 'A-L14-ahu-1');
  const state = new Map([[ahuCase.id, { status: 'In progress', assetId: 'A-L14-ahu-1', events: [] }]]);
  const cases = casesFor(state);
  const ctx = { reports: openReports(state), repairs: repairedAssets(state) };
  const shown = withWork(projectCampus(campus, 0, 'normal', new Map(), ctx), workByAsset(cases));
  const ahu = shown.buildings[0].equipment.find((e) => e.id === 'A-L14-ahu-1');
  assert.equal(ahu.work, 'In progress');
  assert.ok(ahu.risk >= 0.7);

  const done = new Map([[ahuCase.id, { status: 'Resolved', assetId: 'A-L14-ahu-1', events: [] }]]);
  const ctx2 = { reports: openReports(done), repairs: repairedAssets(done) };
  const fixed = withWork(projectCampus(campus, 0, 'normal', new Map(), ctx2), workByAsset(casesFor(done)))
    .buildings[0].equipment.find((e) => e.id === 'A-L14-ahu-1');
  assert.equal(fixed.work, undefined);
  assert.ok(fixed.risk < 0.3, `repaired AHU ${fixed.risk}`);
});

test('guest form: English and Bahasa Malaysia cover the same text, categories and roles', () => {
  const { en, ms } = GUEST_TEXT;
  assert.deepEqual(Object.keys(ms).sort(), Object.keys(en).sort());
  for (const c of GUEST_CATEGORIES) assert.ok(en.categories[c.key] && ms.categories[c.key], c.key);
  assert.equal(en.roles.length, GUEST_ROLES.length);
  assert.equal(ms.roles.length, GUEST_ROLES.length);
});
