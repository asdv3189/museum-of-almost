import assert from 'node:assert/strict';
import test from 'node:test';
import { changedContentFields, type ExhibitContent } from '../src/domain/model';
import { branch, content } from './fixtures';

function fixtureContent(): ExhibitContent {
  return content('A possible doorway', [
    branch('visit-clock', 'clock-room', 'You make more room for time.'),
    branch('visit-garden', 'garden-room', 'You share a slower afternoon.'),
  ]);
}

function reorderProperties(value: ExhibitContent): ExhibitContent {
  return {
    ...Object.fromEntries(Object.entries(value).reverse()),
    branches: value.branches.map(({ id, label, consequence, targetId }) => ({
      targetId, consequence, label, id,
    })),
  } as ExhibitContent;
}

test('different object property order produces no semantic content changes', () => {
  const previous = fixtureContent();
  const next = reorderProperties(previous);
  assert.notEqual(JSON.stringify(previous), JSON.stringify(next), 'Fixture must reproduce different serialization order');
  assert.deepEqual(previous, next);
  assert.deepEqual(changedContentFields(previous, next), []);
});

test('editing only subtitle reports one field despite reserialized branch properties', () => {
  const previous = fixtureContent();
  const next = { ...reorderProperties(previous), subtitle: 'A revised description for the same doorway' };
  assert.deepEqual(changedContentFields(previous, next), ['subtitle']);
});

test('changing a branch destination is a real branches change', () => {
  const previous = fixtureContent();
  const next = reorderProperties(previous);
  next.branches[0].targetId = 'bench-room';
  assert.deepEqual(changedContentFields(previous, next), ['branches']);
  assert.equal(previous.branches[0].targetId, 'clock-room');
});

test('changing a branch consequence is a real branches change', () => {
  const previous = fixtureContent();
  const next = reorderProperties(previous);
  next.branches[0].consequence = 'You discover a different possible future.';
  assert.deepEqual(changedContentFields(previous, next), ['branches']);
  assert.equal(previous.branches[0].consequence, 'You make more room for time.');
});

test('changing branch display order remains detectable even when branch values are unchanged', () => {
  const previous = fixtureContent();
  const next = reorderProperties(previous);
  next.branches.reverse();
  assert.deepEqual(changedContentFields(previous, next), ['branches']);
  assert.deepEqual(previous.branches.map((item) => item.id), ['visit-clock', 'visit-garden']);
});
