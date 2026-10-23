// Guided tour steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tourSteps, tourPrefKey } from '../data/tourSteps.js';
import { STAFF_ACCOUNTS } from '../data/accounts.js';

test('tour: opens with a welcome, ends ready, and every step has a title and text', () => {
  for (const user of STAFF_ACCOUNTS) {
    const steps = tourSteps(user);
    assert.equal(steps[0].id, 'welcome');
    assert.equal(steps.at(-1).id, 'done');
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
    for (const s of steps) assert.ok(s.title && s.body.length > 20, s.id);
    assert.match(steps[0].title, new RegExp(user.name.split(' ')[0]));
  }
});

test('tour: the case step matches the role, and the preference is per account', () => {
  const [manager, engineer] = STAFF_ACCOUNTS;
  const cases = (u) => tourSteps(u).find((s) => s.id === 'cases');
  assert.equal(cases(manager).tab, 'cases');
  assert.match(cases(engineer).body, /your team/);
  assert.doesNotMatch(cases(manager).body, /view-only/);
  assert.notEqual(tourPrefKey(manager), tourPrefKey(engineer));
});
