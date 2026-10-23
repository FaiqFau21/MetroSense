// Run with: npm test  (Node's built-in test runner, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, fitTrend, forecast } from './forecast.js';
import { healthIndexRisk, riskTerms, driftForTargetRisk } from './healthIndex.js';
import { campus } from '../data/seed.js';
import { readingsFor } from '../data/readings.js';
import { projectCampus, campusTotals } from './project.js';
import { pickSpikeTarget, makeSpike, applySpike } from './spike.js';
import { summarize } from '../risk.js';
import { CATALOGUE, GROUPS, FORECAST_STOPS, checkGap } from '../data/catalogue.js';
import { WEATHER, weatherEvents } from '../data/weather.js';
import { buildCases, openReports, repairedAssets } from './cases.js';
import { routeCase, PARTIES } from './routing.js';
import { PUBLIC_REALM, BUILDINGS } from '../data/seed.js';

const asset = { baseline: 100, threshold: 200, ageYears: 5, designLifeYears: 20 };
const line = (start, slope) =>
  Array.from({ length: 31 }, (_, i) => ({ day: i - 30, value: 100 + 100 * (start + slope * (i - 30)) }));

test('health index adds its four terms', () => {
  const input = { ageYears: 10, designLifeYears: 20, drift: 0.5, daysSinceService: 120, serviceIntervalDays: 90 };
  const t = riskTerms(input);
  assert.ok(t.service > 0);
  assert.ok(Math.abs(healthIndexRisk(input) - (t.base + t.age + t.drift + t.service)) < 1e-12);
});

test('overdue-service term: 0 on time, rises to 15% after a whole missed interval', () => {
  const t = (days) => riskTerms({ ageYears: 1, designLifeYears: 20, drift: 0, daysSinceService: days, serviceIntervalDays: 90 }).service;
  assert.equal(t(60), 0);
  assert.equal(t(90), 0);
  assert.ok(Math.abs(t(135) - 0.075) < 1e-12);
  assert.ok(Math.abs(t(180) - 0.15) < 1e-12);
  assert.ok(Math.abs(t(900) - 0.15) < 1e-12);
});

test('"no action" forecast lets service fall overdue', () => {
  const e = { ...asset, serviceIntervalDays: 30, lastServiceDaysAgo: 20 };
  const flat = line(0.2, 0);
  assert.ok(score(e, flat, 40).risk > score(e, flat, 0).risk);
});

test('health index is clamped to 0..0.99', () => {
  assert.equal(healthIndexRisk({ ageYears: 40, designLifeYears: 10, drift: 5 }), 0.99);
  assert.ok(healthIndexRisk({ ageYears: 0, designLifeYears: 10, drift: 0 }) > 0);
});

test('driftForTargetRisk inverts the health index', () => {
  const d = driftForTargetRisk(0.78, 14.8, 20);
  assert.ok(Math.abs(healthIndexRisk({ ageYears: 14.8, designLifeYears: 20, drift: d }) - 0.78) < 1e-9);
});

test('fitTrend recovers a clean linear slope', () => {
  assert.ok(Math.abs(fitTrend(line(0.5, 0.02), 100, 200) - 0.02) < 1e-9);
});

test('score is pure and deterministic', () => {
  const r = line(0.5, 0.02);
  const copy = JSON.parse(JSON.stringify(r));
  assert.deepEqual(score(asset, r, 7), score(asset, r, 7));
  assert.deepEqual(r, copy);
});

test('days to failure follows the trend', () => {
  const s = score(asset, line(0.5, 0.02), 0);
  assert.ok(Math.abs(s.daysToFailure - 25) < 1e-9);
  assert.ok(Math.abs(score(asset, line(0.5, 0.02), 10).daysToFailure - 15) < 1e-9);
});

test('flat or improving metric has no failure date and no rising risk', () => {
  const s0 = score(asset, line(0.3, -0.01), 0);
  const s30 = score(asset, line(0.3, -0.01), 30);
  assert.equal(s0.daysToFailure, null);
  assert.ok(Math.abs(s30.drift - s0.drift) < 1e-12);
});

test('metric already past alarm means 0 days to failure', () => {
  assert.equal(score(asset, line(1.1, 0.01), 0).daysToFailure, 0);
});

test('risk never falls as the forecast day moves forward', () => {
  const f = forecast(asset, line(0.4, 0.015), 30);
  for (let i = 1; i < f.length; i++) assert.ok(f[i].risk >= f[i - 1].risk);
});

test('seeded readings give today the same risk as the seed (within 0.5 pt)', () => {
  for (const b of campus.buildings) {
    for (const e of b.equipment) {
      const s = score(e, readingsFor(e), 0);
      assert.ok(Math.abs(s.risk - e.risk) < 0.005, `${e.id}: ${s.risk} vs ${e.risk}`);
    }
  }
});

test('scenario stress only affects the listed asset types', () => {
  const r = line(0.3, 0.005);
  const chiller = { ...asset, type: 'chiller' };
  const sump = { ...asset, type: 'sump_pump' };
  assert.deepEqual(score(sump, r, 10, 'heat'), score(sump, r, 10, 'normal'));
  assert.ok(score(chiller, r, 10, 'heat').risk > score(chiller, r, 10, 'normal').risk);
  assert.ok(score(sump, r, 10, 'rain').risk > score(sump, r, 10, 'normal').risk);
});

test('scenarios never change today', () => {
  const r = line(0.3, 0.005);
  const chiller = { ...asset, type: 'chiller' };
  assert.equal(score(chiller, r, 0, 'heat').risk, score(chiller, r, 0, 'normal').risk);
});

test('scenario stress lasts only for the event, then the normal trend resumes', () => {
  const r = line(0.3, 0.005);
  const chiller = { ...asset, type: 'chiller' };
  const gap = (d) => score(chiller, r, d, 'heat').drift - score(chiller, r, d, 'normal').drift;
  assert.ok(gap(10) < gap(21));
  assert.ok(Math.abs(gap(21) - gap(60)) < 1e-12);
});

test('weather scenario stresses only on the forecast\'s heavy-rain and hot days', () => {
  const r = line(0.3, 0.005);
  const sump = { ...asset, type: 'sump_pump' };
  const chiller = { ...asset, type: 'chiller' };
  const gap = (e, d) => score(e, r, d, 'weather').drift - score(e, r, d, 'normal').drift;
  // Heavy rain on days 2-4: the sump pump is stressed there and nowhere else.
  assert.equal(gap(sump, 2), 0);
  assert.ok(gap(sump, 5) > 0);
  assert.ok(Math.abs(gap(sump, 5) - gap(sump, 30)) < 1e-12);
  assert.equal(score(sump, r, 5, 'weather').stressDays, 3);
  // Hot days 8-11: the chiller is stressed there only.
  assert.equal(gap(chiller, 8), 0);
  assert.equal(score(chiller, r, 0, 'weather').stressDays, 4);
});

test('weather forecast: 14 deterministic days with heavy rain then a hot spell', () => {
  assert.equal(WEATHER.length, 14);
  assert.deepEqual(weatherEvents().map((e) => [e.kind, e.from, e.to]), [['rain', 2, 4], ['heat', 8, 11]]);
});

test('inspection asset: trend from recent inspections, carried forward to today', () => {
  const e = { ...asset, dataSource: 'inspection', serviceIntervalDays: 365 };
  const r = [-800, -435, -70].map((day) => ({ day, value: 100 + 100 * (0.5 + 0.0004 * day) }));
  const s = score(e, r, 0);
  assert.ok(Math.abs(s.trendPerDay - 0.0004) < 1e-9);
  assert.ok(Math.abs(s.drift - 0.5) < 1e-9);
});

// The app's starting state: no case changes yet, so every seeded report is open.
const startCtx = () => ({ reports: openReports(new Map()), repairs: repairedAssets(new Map()) });

test('demo step 4: four more assets high-risk at +7 days (normal, with open reports)', () => {
  const ctx = startCtx();
  const high = (d) => campusTotals(projectCampus(campus, d, 'normal', new Map(), ctx)).highRisk;
  assert.equal(high(7) - high(0), 4);
});

test('demo step 3: the tenant report lifts AHU-14 from 78% to 88%', () => {
  const ahu = (ctx) => projectCampus(campus, 0, 'normal', new Map(), ctx).buildings[0].equipment.find((e) => e.id === 'A-L14-ahu-1');
  assert.equal(Math.round(ahu(undefined).risk * 100), 78);
  assert.equal(Math.round(ahu(startCtx()).risk * 100), 88);
});

test('every asset type and the unlisted pantry category has someone responsible', () => {
  for (const type of Object.keys(CATALOGUE)) assert.ok(routeCase({ type }).partyKey, type);
  assert.equal(routeCase({ type: 'drain' }).party, PARTIES.council);
  assert.equal(routeCase({ type: 'waste_point' }).party, PARTIES.waste_contractor);
  assert.equal(routeCase({ type: 'lift' }).party, PARTIES.lift_contractor);
  assert.equal(routeCase({ type: 'streetlight' }).party, PARTIES.sdp_township);
  assert.equal(routeCase({ category: 'Pantry appliance' }).party, PARTIES.vendor);
});

const casesFor = (caseState = new Map()) => {
  const ctx = { reports: openReports(caseState), repairs: repairedAssets(caseState) };
  return buildCases({
    today: projectCampus(campus, 0, 'normal', new Map(), ctx),
    week: projectCampus(campus, 7, 'weather', new Map(), ctx),
    weekNormal: projectCampus(campus, 7, 'normal', new Map(), ctx),
    caseState,
  });
};

test('cases: reports about one asset merge; predictions open cases with no reports', () => {
  const cases = casesFor();
  const sl = cases.filter((c) => c.assetId === 'P-L1-streetlight-4');
  assert.equal(sl.length, 1);
  assert.equal(sl[0].reports.length, 2);
  const chiller = cases.find((c) => c.assetId === 'B-L16-chiller-1');
  assert.equal(chiller.reports.length, 0);
  assert.ok(chiller.sources.predicted);
  const dispenser = cases.find((c) => !c.assetId);
  assert.equal(dispenser.party, PARTIES.vendor);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
});

test('cases: the south walkway drain is flagged because of the forecast heavy rain', () => {
  const drain = casesFor().find((c) => c.assetId === 'P-L1-drain-2');
  assert.ok(drain.sources.weather);
  assert.equal(drain.party, PARTIES.council);
});

test('resolving a case repairs the asset and closes its reports', () => {
  const id = casesFor().find((c) => c.assetId === 'P-L1-streetlight-4').id;
  const resolved = new Map([[id, { status: 'Resolved', assetId: 'P-L1-streetlight-4', events: [] }]]);
  const sl = (state) => projectCampus(campus, 0, 'normal', new Map(), { reports: openReports(state), repairs: repairedAssets(state) })
    .buildings.find((b) => b.kind === 'site').equipment.find((e) => e.id === 'P-L1-streetlight-4');
  assert.ok(sl(new Map()).risk >= 0.5);
  assert.ok(sl(resolved).risk < 0.3);
  assert.equal(openReports(resolved).get('P-L1-streetlight-4'), undefined);
  assert.equal(casesFor(resolved).find((c) => c.id === id).status, 'Resolved');
});

test('every office floor has one lights and emergency lights asset; the roof-plant level has none', () => {
  for (const b of campus.buildings.filter((x) => x.kind !== 'site')) {
    for (const f of b.floors) {
      const lights = f.equipment.filter((e) => e.type === 'lights');
      assert.equal(lights.length, f.level === b.floorCount ? 0 : 1, `${b.name} ${f.label}`);
    }
  }
  // Added on their own random sequences: the planted demo assets are unchanged.
  const ahu = campus.buildings[0].equipment.find((e) => e.id === 'A-L14-ahu-1');
  assert.ok(Math.abs(ahu.risk - 0.78) < 0.01);
});

test('public-realm assets sit clear of every building footprint', () => {
  for (const [, name, , x, z] of PUBLIC_REALM) {
    for (const b of BUILDINGS) {
      const inside = Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1;
      assert.ok(!inside, `${name} overlaps ${b.name}`);
    }
  }
});

test('past its forecast range, an unfixed problem keeps its risk; a healthy asset gets none', () => {
  const p = projectCampus(campus, 1825, 'normal');
  const all = p.buildings.flatMap((b) => b.equipment);
  const ahu = all.find((e) => e.id === 'A-L14-ahu-1');
  const at30 = projectCampus(campus, 30, 'normal').buildings[0].equipment.find((e) => e.id === 'A-L14-ahu-1');
  assert.ok(ahu.outOfRange && ahu.held);
  assert.equal(ahu.risk, at30.risk);
  assert.equal(ahu.daysToFailure, 0);
  const healthyOut = all.filter((e) => e.outOfRange && !e.held);
  assert.ok(healthyOut.length > 0);
  assert.ok(healthyOut.every((e) => e.risk == null));
  const slab = all.find((e) => e.id === 'A-L6-slab-1');
  assert.ok(slab.risk >= 0.7, `slab ${slab.risk}`);
});

test('moving the forecast later never makes a problem disappear or improve', () => {
  for (const scenario of ['normal', 'weather']) {
    const stops = FORECAST_STOPS.map((d) => projectCampus(campus, d, scenario));
    const risks = new Map();
    stops.forEach((c, i) => {
      for (const e of c.buildings.flatMap((b) => b.equipment)) {
        const prev = risks.get(e.id);
        if (i > 0 && prev != null && prev >= 0.3) {
          assert.ok(e.risk != null && e.risk >= prev - 1e-9, `${e.id} ${scenario}: ${prev} then ${e.risk} at ${FORECAST_STOPS[i]}d`);
        }
        risks.set(e.id, e.risk);
      }
    });
    const totals = stops.map(campusTotals);
    for (let i = 1; i < totals.length; i++) {
      assert.ok(totals[i].open >= totals[i - 1].open, `${scenario} open problems fell at ${FORECAST_STOPS[i]}d`);
      assert.ok(totals[i].highRisk >= totals[i - 1].highRisk, `${scenario} high risk fell at ${FORECAST_STOPS[i]}d`);
    }
  }
});

test('long-range demo: Level 6 slab healthy today, critical within 5 years', () => {
  const at = (d) => projectCampus(campus, d, 'normal').buildings[0].equipment.find((e) => e.id === 'A-L6-slab-1').risk;
  assert.ok(at(0) < 0.3);
  assert.ok(at(1825) >= 0.7);
});

test('long-range demo: Tower B roof and Annex D wiring critical at +1 year', () => {
  const p = projectCampus(campus, 365, 'normal');
  const find = (id) => p.buildings.flatMap((b) => b.equipment).find((e) => e.id === id);
  assert.ok(find('B-L16-roof-1').risk >= 0.7);
  assert.ok(find('D-L2-wiring-1').risk >= 0.7);
});

test('every asset type has lifecycle data and a forecast range on a slider stop', () => {
  for (const [type, spec] of Object.entries(CATALOGUE)) {
    for (const k of ['designLifeYears', 'serviceIntervalDays', 'warningDays', 'horizonDays']) {
      assert.ok(spec[k] > 0, `${type}.${k}`);
    }
    assert.ok(FORECAST_STOPS.includes(spec.horizonDays), type);
    assert.ok(spec.horizonDays >= Math.min(spec.warningDays, 1825), type);
    assert.ok(GROUPS[spec.group], type);
  }
});

test('data sources match a typical office: big plant on sensors, floor items read by technicians', () => {
  const by = (src) => Object.keys(CATALOGUE).filter((t) => CATALOGUE[t].dataSource === src).sort();
  assert.deepEqual(by('sensor'), ['ahu', 'bms', 'chiller', 'fire_pump', 'generator', 'lift', 'ups']);
  assert.deepEqual(by('manual'), ['booster_pump', 'db', 'fcu', 'lighting', 'lights', 'streetlight', 'sump_pump', 'waste_point']);
  assert.deepEqual(by('inspection'), ['drain', 'pipe', 'playground', 'roof', 'slab', 'wiring']);
});

test('check-gap rule: readings must come at least twice within the warning time', () => {
  assert.equal(checkGap(CATALOGUE.booster_pump), false); // weekly, 21-day warning
  assert.equal(checkGap(CATALOGUE.fcu), true); // monthly, 21-day warning
  assert.equal(checkGap(CATALOGUE.db), true); // quarterly, 45-day warning
  assert.equal(checkGap(CATALOGUE.ahu), false); // daily sensor
});

test('technician readings: one per round, the latest some days ago', () => {
  const e = campus.buildings.flatMap((b) => b.equipment).find((x) => x.dataSource === 'manual' && x.lastReadingDaysAgo > 0);
  const r = readingsFor(e);
  assert.equal(r.at(-1).day, -e.lastReadingDaysAgo);
  for (let i = 1; i < r.length; i++) assert.equal(r[i].day - r[i - 1].day, e.readingIntervalDays);
});

test('spikes only hit live-sensor assets', () => {
  const spikes = new Map();
  for (let n = 0; n < 30; n++) {
    const t = pickSpikeTarget(campus, spikes, n);
    assert.equal(t.dataSource, 'sensor');
    spikes.set(t.id, makeSpike(t, n));
  }
});

test('projectCampus does not mutate the seed', () => {
  const before = campus.buildings[0].equipment[0].risk;
  projectCampus(campus, 30, 'heat');
  assert.equal(campus.buildings[0].equipment[0].risk, before);
});

test('first spike is a healthy lift in Office Block C and turns it critical', () => {
  const target = pickSpikeTarget(campus, new Map(), 0);
  assert.equal(target.type, 'lift');
  assert.equal(target.buildingId, 'C');
  assert.ok(target.risk < 0.3);
  const spikes = new Map([[target.id, makeSpike(target, 0)]]);
  const p = projectCampus(campus, 0, 'normal', spikes);
  const hit = p.buildings.find((b) => b.id === 'C').equipment.find((e) => e.id === target.id);
  assert.ok(hit.risk >= 0.7, `risk ${hit.risk}`);
  assert.equal(hit.daysToFailure, 0);
  assert.ok(hit.spike);
  assert.equal(summarize(p.buildings.find((b) => b.id === 'C').equipment).level.key, 'critical');
});

test('spike picks are deterministic and never repeat an asset', () => {
  const spikes = new Map();
  const ids = [];
  for (let n = 0; n < 10; n++) {
    const t = pickSpikeTarget(campus, spikes, n);
    assert.equal(t.id, pickSpikeTarget(campus, spikes, n).id);
    spikes.set(t.id, makeSpike(t, n));
    ids.push(t.id);
  }
  assert.equal(new Set(ids).size, 10);
});

test('applySpike does not mutate readings', () => {
  const r = line(0.2, 0);
  const before = JSON.stringify(r);
  const out = applySpike(r, { value: 999 });
  assert.equal(JSON.stringify(r), before);
  assert.equal(out[out.length - 1].value, 999);
});

test('demo asset AHU-14: 78% today, about 6 days to failure', () => {
  const e = campus.buildings[0].floors[13].equipment.find((x) => x.type === 'ahu');
  const s = score(e, readingsFor(e), 0);
  assert.equal(Math.round(s.risk * 100), 78);
  assert.ok(s.daysToFailure > 5 && s.daysToFailure < 7.5, `got ${s.daysToFailure}`);
});
