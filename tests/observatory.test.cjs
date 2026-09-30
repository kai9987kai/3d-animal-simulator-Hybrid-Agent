const test = require('node:test');
const assert = require('node:assert/strict');
const {createCensus, record, summarize, historyView} = require('../src/observatory.js');

test('births and introductions remain distinct and conserve each living population', () => {
  const census = createCensus();
  for (const type of ['prey', 'pred']) {
    record(census, {kind: 'introduction', type});
    record(census, {kind: 'birth', type});
  }
  record(census, {kind: 'death', type: 'prey', cause: 'predation'});
  const result = summarize([
    {id: 2, founderId: 1, type: 'prey', energy: 30, generation: 1},
    {id: 3, founderId: 3, type: 'pred', energy: 80, generation: 0},
    {id: 4, founderId: 3, type: 'pred', energy: 40, generation: 1}
  ], census);
  assert.deepEqual(result.births, {prey: 1, pred: 1});
  assert.deepEqual(result.introductions, {prey: 1, pred: 1});
  assert.deepEqual(result.deaths, {prey: 1, pred: 0});
  assert.deepEqual(result.population, {prey: 1, pred: 2, total: 3});
  assert.deepEqual(result.balance, {prey: 0, pred: 0});
  assert.deepEqual(result.energy, {prey: 30, pred: 60});
  assert.deepEqual(result.lineages, {prey: 1, pred: 1, total: 2});
  assert.deepEqual(result.generation, {prey: 1, pred: 1, max: 1});
});

test('each death has exactly one recorded terminal cause; kills do not double-count deaths', () => {
  const census = createCensus();
  for (const cause of ['predation', 'starvation', 'disease', 'age', 'injury']) {
    record(census, {kind: 'death', type: 'prey', cause});
  }
  record(census, {kind: 'kill'});
  for (let i = 0; i < 3; i++) record(census, {kind: 'failedHunt'});
  record(census, {kind: 'graze'});record(census, {kind: 'regrow'});
  assert.equal(census.deaths.prey, 5);
  assert.equal(Object.values(census.causes).reduce((a, b) => a + b), 5);
  assert.equal(census.kills, 1);assert.equal(census.failedHunts, 3);
  assert.equal(summarize([], census).huntSuccess, .25);
  assert.equal(census.grazes, 1);assert.equal(census.regrown, 1);
  const saved = structuredClone(census);
  assert.throws(() => record(census, {kind: 'death', type: 'prey', cause: 'unknown'}));
  assert.throws(() => record(census, {kind: 'birth', type: 'plant'}));
  assert.throws(() => record(census, {kind: 'toString'}));
  assert.deepEqual(census, saved, 'rejected events must not partially modify accounting');
});

test('living census excludes dead agents and distinguishes resting from handling a meal', () => {
  const census = createCensus();
  const agents = [
    {id: 1, founderId: 1, type: 'pred', state: 'REST', energy: 90, generation: 0},
    {id: 2, founderId: 1, type: 'pred', state: 'HANDLE', handlingTimer: 2, energy: 50, generation: 3},
    {id: 3, founderId: 3, type: 'prey', state: 'IDLE', energy: 60, generation: 0},
    {id: 4, founderId: 4, type: 'prey', state: 'REST', energy: 130, generation: 7, dead: true}
  ];
  const saved = structuredClone({agents, census});
  const result = summarize(agents, census);
  assert.deepEqual(result.resting, {prey: 0, pred: 1, total: 1});
  assert.deepEqual(result.handling, {prey: 0, pred: 1, total: 1});
  assert.deepEqual(result.energy, {prey: 60, pred: 70});
  assert.equal(result.generation.max, 3);
  assert.deepEqual(result.lineages, {prey: 1, pred: 1, total: 2});
  assert.deepEqual({agents, census}, saved, 'summaries must be observational');
  result.births.prey++;result.causes.predation++;
  assert.deepEqual(census, saved.census, 'summary data must not alias census fields');
});

test('empty populations and independent new censuses have finite zero summaries', () => {
  const first = createCensus(), second = createCensus();
  record(first, {kind: 'introduction', type: 'prey'});
  const empty = summarize([], second);
  assert.equal(empty.population.total, 0);assert.equal(empty.lineages.total, 0);
  assert.equal(empty.generation.max, 0);assert.equal(empty.huntSuccess, 0);
  assert.deepEqual(empty.energy, {prey: 0, pred: 0});
  assert.deepEqual(empty.balance, {prey: 0, pred: 0});
  assert.equal(second.introductions.prey, 0);
});

test('population history uses one dynamic scale that includes peaks above old fixed limits', () => {
  const history = [{day: 0, prey: 52, pred: 8}, {day: 1, prey: 701, pred: 221}];
  const view = historyView(history);
  assert.equal(view.unit, 'animals');assert.equal(view.maximum, 1000);
  assert.deepEqual(view.series.map(s => s.values), [[52, 701], [8, 221]]);
  assert.equal(view.startDay, 0);assert.equal(view.endDay, 1);
  for (const peak of [0, .01, .03, 1, 2, 2.5, 2.6, 50, 135, 5500, 100000]) {
    assert.ok(historyView([{prey: peak, pred: 0}]).maximum >= peak, 'must never clip ' + peak);
  }
});

test('resource and energy histories keep their own units and represent absent readings as gaps', () => {
  const history = [{day: 0, food: 200}, {day: 1, food: 225, preyEnergy: 95, predEnergy: 110}];
  const saved = structuredClone(history);
  const resources = historyView(history, 'resources');
  assert.equal(resources.unit, 'plants');
  assert.deepEqual(resources.series[0].values, [4000, 4500]);
  assert.equal(resources.maximum, 5000);
  const energy = historyView(history, 'energy');
  assert.equal(energy.unit, 'energy units');assert.ok(energy.maximum >= 110);
  assert.deepEqual(energy.series.map(s => s.values), [[null, 95], [null, 110]]);
  assert.deepEqual(history, saved);
  assert.equal(historyView([]).maximum, 1);
  assert.equal(historyView([]).samples, 0);
});
