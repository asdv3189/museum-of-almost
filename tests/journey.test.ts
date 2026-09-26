import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveJourney, type JourneyStep } from '../src/domain/journey';
import { publicExhibits } from '../src/domain/model';
import { branch, fixture } from './fixtures';

const clockPath: JourneyStep[] = [
  { exhibitId: 'entrance', branchId: 'take-clock' },
  { exhibitId: 'clock-room', branchId: 'meet-neighbors' },
];

test('a visitor branch chain carries ordered stops and consequences from published content', () => {
  const exhibits = publicExhibits(fixture());
  const before = structuredClone(exhibits);
  const pathBefore = structuredClone(clockPath);
  const result = resolveJourney(exhibits, 'entrance', clockPath);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance', 'clock-room', 'bench-room']);
  assert.deepEqual(result.consequences, ['You chose take-clock.', 'You chose meet-neighbors.']);
  assert.equal(result.stops[0].title, 'The old entrance');
  assert.equal(result.invalidAt, null);
  assert.deepEqual(exhibits, before);
  assert.deepEqual(clockPath, pathBefore);
});

test('changing an earlier choice invalidates the old downstream path and preserves only the valid prefix', () => {
  const exhibits = publicExhibits(fixture());
  const changed = [{ exhibitId: 'entrance', branchId: 'take-garden' }, clockPath[1]];
  const result = resolveJourney(exhibits, 'entrance', changed);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance', 'garden-room']);
  assert.deepEqual(result.consequences, ['You chose take-garden.']);
  assert.equal(result.invalidAt, 1);

  const continued = resolveJourney(exhibits, 'entrance', [changed[0], { exhibitId: 'garden-room', branchId: 'sit-together' }]);
  assert.deepEqual(continued.stops.map((stop) => stop.id), ['entrance', 'garden-room', 'bench-room']);
  assert.deepEqual(continued.consequences, ['You chose take-garden.', 'You chose sit-together.']);
  assert.equal(continued.invalidAt, null);
});

test('a known start with no choices produces exactly the starting stop', () => {
  const result = resolveJourney(publicExhibits(fixture()), 'entrance', []);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance']);
  assert.deepEqual(result.consequences, []);
  assert.equal(result.invalidAt, null);
});

test('a missing starting exhibit gives an empty invalid journey', () => {
  assert.deepEqual(resolveJourney(publicExhibits(fixture()), 'missing-room', clockPath), {
    stops: [], consequences: [], invalidAt: 0,
  });
  assert.deepEqual(resolveJourney([], 'entrance', []), { stops: [], consequences: [], invalidAt: 0 });
});

for (const [label, step] of [
  ['unknown branch', { exhibitId: 'entrance', branchId: 'nonexistent-choice' }],
  ['wrong source exhibit', { exhibitId: 'garden-room', branchId: 'take-clock' }],
  ['skipped first exhibit', { exhibitId: 'clock-room', branchId: 'meet-neighbors' }],
] as const) {
  test(`${label} cannot inject a destination or consequence`, () => {
    const result = resolveJourney(publicExhibits(fixture()), 'entrance', [step]);
    assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance']);
    assert.deepEqual(result.consequences, []);
    assert.equal(result.invalidAt, 0);
  });
}

test('an invalid later step preserves earlier consequences without accepting anything after the error', () => {
  const result = resolveJourney(publicExhibits(fixture()), 'entrance', [
    clockPath[0],
    { exhibitId: 'clock-room', branchId: 'nonexistent-choice' },
    clockPath[1],
  ]);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance', 'clock-room']);
  assert.deepEqual(result.consequences, ['You chose take-clock.']);
  assert.equal(result.invalidAt, 1);
});

test('a branch pointing at missing public content is rejected before recording its consequence', () => {
  const exhibits = publicExhibits(fixture()).filter((item) => item.id !== 'clock-room');
  const result = resolveJourney(exhibits, 'entrance', clockPath);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance']);
  assert.deepEqual(result.consequences, []);
  assert.equal(result.invalidAt, 0);
});

test('visitor paths cannot continue past a terminal exhibit', () => {
  const result = resolveJourney(publicExhibits(fixture()), 'entrance', [
    ...clockPath,
    { exhibitId: 'bench-room', branchId: 'invented-exit' },
  ]);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance', 'clock-room', 'bench-room']);
  assert.equal(result.consequences.length, 2);
  assert.equal(result.invalidAt, 2);
});

test('a corrupt public graph cannot make a journey revisit an earlier exhibit', () => {
  const exhibits = publicExhibits(fixture());
  exhibits.find((item) => item.id === 'bench-room')!.branches = [branch('return-home', 'entrance')];
  const result = resolveJourney(exhibits, 'entrance', [...clockPath, { exhibitId: 'bench-room', branchId: 'return-home' }]);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance', 'clock-room', 'bench-room']);
  assert.deepEqual(result.consequences, ['You chose take-clock.', 'You chose meet-neighbors.']);
  assert.equal(result.invalidAt, 2);
});

test('a self-loop is rejected on its first selection', () => {
  const exhibits = publicExhibits(fixture());
  exhibits[0].branches = [branch('stay-here', 'entrance')];
  const result = resolveJourney(exhibits, 'entrance', [{ exhibitId: 'entrance', branchId: 'stay-here' }]);
  assert.deepEqual(result.stops.map((stop) => stop.id), ['entrance']);
  assert.deepEqual(result.consequences, []);
  assert.equal(result.invalidAt, 0);
});
