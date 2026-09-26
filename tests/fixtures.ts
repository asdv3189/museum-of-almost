import assert from 'node:assert/strict';
import {
  MuseumError,
  type Branch,
  type Exhibit,
  type ExhibitContent,
  type MuseumCommand,
  type MuseumState,
} from '../src/domain/model';
import { transition } from '../src/domain/workflow';

export const NOW = '2026-09-21T09:00:00.000Z';

export function branch(id: string, targetId: string, consequence = `You chose ${id}.`): Branch {
  return { id, targetId, label: `Choose ${id}`, consequence };
}

export function content(title: string, branches: Branch[] = []): ExhibitContent {
  return {
    title,
    subtitle: 'An object from a possible tomorrow',
    category: 'Little rituals',
    year: '2038',
    premise: 'A small invention changes an ordinary habit.',
    almost: 'Its inventors never agreed on the final detail.',
    question: 'Which future would you choose?',
    color: '#bbaa88',
    artifact: 'umbrella',
    branches,
  };
}

export function fixture(): MuseumState {
  const definitions: [string, ExhibitContent][] = [
    ['entrance', content('The old entrance', [branch('take-clock', 'clock-room'), branch('take-garden', 'garden-room')])],
    ['clock-room', content('The patient clock', [branch('meet-neighbors', 'bench-room')])],
    ['garden-room', content('The shared garden', [branch('sit-together', 'bench-room')])],
    ['bench-room', content('The listening bench')],
  ];
  const exhibits = definitions.map(([id, value], index): Exhibit => ({
    id,
    number: String(index + 1).padStart(2, '0'),
    draft: { revision: 1, content: structuredClone(value) },
    published: { revision: 1, content: structuredClone(value) },
    review: null,
    approval: null,
  }));
  // Only the entrance starts with a pending edit. No production seed is imported.
  exhibits[0].draft = { revision: 2, content: { ...exhibits[0].draft.content, title: 'The new entrance' } };
  return { schemaVersion: 1, version: 10, exhibits, audit: [] };
}

export function exhibit(state: MuseumState, id = 'entrance'): Exhibit {
  const found = state.exhibits.find((item) => item.id === id);
  assert.ok(found, `Fixture exhibit ${id} must exist`);
  return found;
}

export function command(state: MuseumState, type: Exclude<MuseumCommand['type'], 'edit'>, id = 'entrance'): MuseumCommand {
  return {
    type,
    exhibitId: id,
    expectedVersion: state.version,
    expectedRevision: exhibit(state, id).draft.revision,
  };
}

export function edit(state: MuseumState, nextContent: ExhibitContent, id = 'entrance'): MuseumState {
  return transition(state, {
    type: 'edit',
    exhibitId: id,
    expectedVersion: state.version,
    expectedRevision: exhibit(state, id).draft.revision,
    content: nextContent,
  }, NOW);
}

export function approved(state = fixture(), id = 'entrance'): MuseumState {
  const review = transition(state, command(state, 'request-review', id), NOW);
  return transition(review, command(review, 'approve', id), NOW);
}

export function rejectsWith(operation: () => unknown, code: string, status = 422): void {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof MuseumError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}
