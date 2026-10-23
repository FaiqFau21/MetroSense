// Maintenance log and asset descriptions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campus } from '../data/seed.js';
import { describe } from '../data/descriptions.js';
import { CATALOGUE } from '../data/catalogue.js';
import { maintenanceLog, nextDue, dateOf, SERVICE_TASKS } from './maintenanceLog.js';

const all = campus.buildings.flatMap((b) => b.equipment.map((e) => ({ e, b })));
const find = (id) => all.find((x) => x.e.id === id);

test('log: every asset has a description, an install entry and newest-first order', () => {
  for (const { e, b } of all) {
    assert.ok(describe(e, b).length > 20, e.id);
    const log = maintenanceLog(e);
    assert.equal(log.at(-1).kind, 'install', e.id);
    for (let i = 1; i < log.length; i++) assert.ok(log[i].daysAgo >= log[i - 1].daysAgo, `${e.id} order`);
  }
  assert.deepEqual(Object.keys(SERVICE_TASKS).sort(), Object.keys(CATALOGUE).sort());
});

test('log agrees with the risk model: latest service or inspection is the one it counts from', () => {
  for (const { e } of all) {
    const log = maintenanceLog(e);
    const kind = e.dataSource === 'inspection' ? 'inspection' : 'service';
    const latest = log.find((x) => x.kind === kind);
    if (!latest) continue; // installed after the last due date
    assert.equal(latest.daysAgo, e.dataSource === 'inspection' ? e.lastReadingDaysAgo : e.lastServiceDaysAgo, e.id);
  }
});

test('log is deterministic and includes the asset\'s reports and case history', () => {
  const { e } = find('P-L1-playground-1');
  assert.deepEqual(maintenanceLog(e), maintenanceLog(e));
  const log = maintenanceLog(e);
  assert.ok(log.some((x) => x.kind === 'report' && x.title.startsWith('Report R-2046')));
  assert.ok(log.some((x) => x.kind === 'case' && /in progress/.test(x.title)));
});

test('log adds this session\'s case updates; a repair moves the next service out', () => {
  const { e } = find('A-L14-ahu-1');
  const openCase = { id: 'WO-TEST', reports: [], events: [{ hoursAgo: 0, text: 'Fixed and closed, recorded by Daniel Lee' }] };
  const log = maintenanceLog({ ...e, repaired: true, lastServiceDaysAgo: 0 }, openCase);
  assert.equal(log[0].title, 'Fixed and closed, recorded by Daniel Lee');
  assert.equal(nextDue({ ...e, lastServiceDaysAgo: 0 }).inDays, e.serviceIntervalDays);
  assert.equal(dateOf(0), '18 Oct 2026');
});
