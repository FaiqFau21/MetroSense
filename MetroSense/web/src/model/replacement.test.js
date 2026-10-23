// Repair-or-replace rule and the energy case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replacementAdvice, replacementSummary, REPLACEMENTS, ENERGY } from './replacement.js';
import { COSTS } from './problem.js';
import { campus } from '../data/seed.js';
import { projectCampus } from './project.js';

const base = { type: 'streetlight', designLifeYears: 15 };

test('replacement: near end of life means replace', () => {
  const a = replacementAdvice({ ...base, ageYears: 14 }, 0.1);
  assert.equal(a.verdict, 'replace');
});

test('replacement: an ageing unit with a costly repair is replaced, a cheap repair is not', () => {
  // Streetlight repair is 28% of a new smart LED: replace.
  assert.equal(replacementAdvice({ ...base, ageYears: 11 }, 0.5).verdict, 'replace');
  // AHU filter change is 4% of a new AHU: repair now, plan the replacement.
  const ahu = replacementAdvice({ type: 'ahu', designLifeYears: 20, ageYears: 15 }, 0.88);
  assert.equal(ahu.verdict, 'plan');
  assert.ok(COSTS.ahu.planned / REPLACEMENTS.ahu.capex < 0.15);
});

test('replacement: young assets are left alone unless the upgrade pays back fast', () => {
  assert.equal(replacementAdvice({ ...base, ageYears: 2 }, 0.1), null);
  // Booster set: pays back in 4 years once past 40% of its life.
  const b = replacementAdvice({ type: 'booster_pump', designLifeYears: 15, ageYears: 8 }, 0.1);
  assert.equal(b.verdict, 'upgrade');
  assert.ok(b.paybackYears <= 5);
});

test('replacement: savings follow the stated tariff and grid factor', () => {
  const a = replacementAdvice({ ...base, ageYears: 14 }, 0.1);
  assert.equal(a.rmPerYear, Math.round(REPLACEMENTS.streetlight.kwhSaved * ENERGY.tariffRm));
  assert.equal(a.co2Tonnes, Math.round(REPLACEMENTS.streetlight.kwhSaved * ENERGY.gridKgCo2PerKwh / 100) / 10);
});

test('replacement: structural slabs are never "replaced"; demo AHU-14 is repair now', () => {
  assert.equal(replacementAdvice({ type: 'slab', designLifeYears: 60, ageYears: 59 }, 0.9), null);
  const all = projectCampus(campus, 0, 'normal').buildings.flatMap((b) => b.equipment);
  assert.equal(replacementAdvice(all.find((e) => e.id === 'A-L14-ahu-1')).verdict, 'plan');
  const s = replacementSummary(all);
  assert.ok(s.count > 0 && s.rmPerYear > 0);
});
