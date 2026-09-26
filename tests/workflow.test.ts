import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, publicExhibits, type ExhibitContent, type MuseumCommand } from '../src/domain/model';
import { transition } from '../src/domain/workflow';
import { approved, branch, command, edit, exhibit, fixture, NOW, rejectsWith } from './fixtures';

test('review and approval keep public content unchanged; publication copies exactly the approved snapshot', () => {
  const original = fixture();
  const originalCopy = structuredClone(original);
  const publicBefore = structuredClone(publicExhibits(original));
  const review = transition(original, command(original, 'request-review'), NOW);
  const approval = transition(review, command(review, 'approve'), NOW);
  const approvedSnapshot = structuredClone(exhibit(approval).draft);

  assert.deepEqual(publicExhibits(review), publicBefore);
  assert.deepEqual(publicExhibits(approval), publicBefore);
  assert.equal(exhibit(approval).approval?.contentFingerprint, fingerprint(approvedSnapshot.content));

  const published = transition(approval, command(approval, 'publish'), NOW);
  assert.deepEqual(exhibit(published).published, approvedSnapshot);
  assert.notStrictEqual(exhibit(published).published, exhibit(published).draft);
  assert.notStrictEqual(exhibit(published).published?.content, exhibit(published).draft.content);
  assert.equal(publicExhibits(published)[0].title, 'The new entrance');
  assert.equal(publicExhibits(published)[0].revision, 2);
  assert.equal(published.version, original.version + 3);
  assert.deepEqual(published.audit.map(({ action, actor, revision, timestamp }) => ({ action, actor, revision, timestamp })), [
    { action: 'published', actor: 'curator', revision: 2, timestamp: NOW },
    { action: 'approved', actor: 'reviewer', revision: 2, timestamp: NOW },
    { action: 'review-requested', actor: 'curator', revision: 2, timestamp: NOW },
  ]);
  assert.equal(new Set(published.audit.map((event) => event.id)).size, 3);
  assert.deepEqual(original, originalCopy, 'Transitions must not mutate the supplied workspace');
  assert.deepEqual(exhibit(approval).published, exhibit(original).published);
});

test('editing an approved revision invalidates both review and approval and preserves the live exhibit', () => {
  const state = approved();
  const previous = structuredClone(state);
  const updated = edit(state, { ...exhibit(state).draft.content, premise: 'A revised possibility requires another review.' });

  assert.equal(exhibit(updated).draft.revision, 3);
  assert.equal(exhibit(updated).review, null);
  assert.equal(exhibit(updated).approval, null);
  assert.deepEqual(exhibit(updated).published, exhibit(state).published);
  rejectsWith(() => transition(updated, command(updated, 'publish'), NOW), 'APPROVAL_REQUIRED');
  rejectsWith(() => transition(updated, command(updated, 'approve'), NOW), 'REVIEW_REQUIRED');
  assert.deepEqual(state, previous);

  const restored = edit(updated, exhibit(state).draft.content);
  assert.equal(exhibit(restored).draft.revision, 4);
  rejectsWith(() => transition(restored, command(restored, 'publish'), NOW), 'APPROVAL_REQUIRED');

  const reapproved = approved(restored);
  const published = transition(reapproved, command(reapproved, 'publish'), NOW);
  assert.equal(exhibit(published).published?.revision, 4);
});

test('editing a revision already in review requires a new review request', () => {
  const state = fixture();
  const review = transition(state, command(state, 'request-review'), NOW);
  const updated = edit(review, { ...exhibit(review).draft.content, title: 'A different entrance' });
  assert.equal(exhibit(updated).review, null);
  rejectsWith(() => transition(updated, command(updated, 'approve'), NOW), 'REVIEW_REQUIRED');
});

for (const [label, tamper] of [
  ['scalar content', (value: ExhibitContent) => { value.premise = 'Changed after approval'; }],
  ['branch consequence', (value: ExhibitContent) => { value.branches[0].consequence = 'An unapproved consequence'; }],
  ['branch destination', (value: ExhibitContent) => { value.branches[0].targetId = 'garden-room'; }],
  ['branch ordering', (value: ExhibitContent) => { value.branches.reverse(); }],
] as const) {
  test(`publication rejects ${label} tampering even when the revision number still matches`, () => {
    const state = approved();
    tamper(exhibit(state).draft.content);
    const before = structuredClone(state);
    rejectsWith(() => transition(state, command(state, 'publish'), NOW), 'APPROVAL_REQUIRED');
    assert.deepEqual(state, before);
  });
}

test('publication rejects a tampered approval fingerprint and stale approval revision', () => {
  const state = approved();
  exhibit(state).approval!.contentFingerprint = 'forged';
  rejectsWith(() => transition(state, command(state, 'publish'), NOW), 'APPROVAL_REQUIRED');

  const stale = approved();
  exhibit(stale).approval!.revision -= 1;
  rejectsWith(() => transition(stale, command(stale, 'publish'), NOW), 'APPROVAL_REQUIRED');
});

test('concurrent edits from the same workspace allow only the first command', () => {
  const state = fixture();
  const base = { type: 'edit' as const, exhibitId: 'entrance', expectedVersion: state.version, expectedRevision: 2 };
  const first = transition(state, { ...base, content: { ...exhibit(state).draft.content, title: 'First editor wins' } }, NOW);
  const before = structuredClone(first);
  rejectsWith(() => transition(first, { ...base, content: { ...exhibit(state).draft.content, title: 'Stale editor overwrite' } }, NOW), 'STALE_WORKSPACE', 409);
  assert.deepEqual(first, before);
  assert.equal(exhibit(first).draft.content.title, 'First editor wins');
  assert.equal(first.audit.length, 1);
});

for (const type of ['edit', 'request-review', 'approve', 'publish'] as const) {
  test(`${type} rejects a stale workspace before changing content or audit`, () => {
    const state = approved();
    const before = structuredClone(state);
    const action = {
      type, exhibitId: 'entrance', expectedVersion: state.version - 1, expectedRevision: 2,
      ...(type === 'edit' ? { content: { ...exhibit(state).draft.content, title: 'Racing edit' } } : {}),
    } as MuseumCommand;
    rejectsWith(() => transition(state, action, NOW), 'STALE_WORKSPACE', 409);
    assert.deepEqual(state, before);
  });

  test(`${type} rejects a stale exhibit revision even with the current workspace version`, () => {
    const state = approved();
    const before = structuredClone(state);
    const action = {
      type, exhibitId: 'entrance', expectedVersion: state.version, expectedRevision: 1,
      ...(type === 'edit' ? { content: { ...exhibit(state).draft.content, title: 'Wrong revision edit' } } : {}),
    } as MuseumCommand;
    rejectsWith(() => transition(state, action, NOW), 'STALE_REVISION', 409);
    assert.deepEqual(state, before);
  });
}

test('an edit in a different exhibit invalidates a previously prepared publish command', () => {
  const state = approved();
  const readyToPublish = command(state, 'publish');
  const updated = edit(state, { ...exhibit(state, 'clock-room').draft.content, title: 'A newly edited clock' }, 'clock-room');
  rejectsWith(() => transition(updated, readyToPublish, NOW), 'STALE_WORKSPACE', 409);
  assert.equal(exhibit(updated).draft.revision, readyToPublish.expectedRevision);
  const published = transition(updated, command(updated, 'publish'), NOW);
  assert.deepEqual(exhibit(published).published, exhibit(state).draft);
});

test('missing or unpublished branch targets make publication fail atomically', () => {
  for (const targetId of ['missing-room', 'unpublished-room']) {
    const initial = fixture();
    if (targetId === 'unpublished-room') {
      initial.exhibits.push({ ...structuredClone(exhibit(initial, 'bench-room')), id: targetId, published: null });
    }
    const updated = edit(initial, { ...exhibit(initial).draft.content, branches: [branch('visit-missing', targetId)] });
    const state = approved(updated);
    const before = structuredClone(state);
    rejectsWith(() => transition(state, command(state, 'publish'), NOW), 'INVALID_GRAPH');
    assert.deepEqual(state, before, 'Failed publication must preserve live snapshot, approval, version, and audit');
  }
});

test('a newly published edge that closes an existing public cycle is rejected atomically', () => {
  const initial = fixture();
  const updated = edit(initial, { ...exhibit(initial, 'bench-room').draft.content, branches: [branch('return-home', 'entrance')] }, 'bench-room');
  const state = approved(updated, 'bench-room');
  const before = structuredClone(state);
  rejectsWith(() => transition(state, command(state, 'publish', 'bench-room'), NOW), 'INVALID_GRAPH');
  assert.deepEqual(state, before);
});

test('invalid unrelated drafts do not prevent publication of a valid candidate public graph', () => {
  const initial = fixture();
  const updated = edit(initial, { ...exhibit(initial, 'clock-room').draft.content, branches: [branch('not-ready', 'missing-room')] }, 'clock-room');
  const state = approved(updated);
  const published = transition(state, command(state, 'publish'), NOW);
  assert.deepEqual(exhibit(published, 'clock-room').published, exhibit(initial, 'clock-room').published);
  assert.deepEqual(exhibit(published, 'clock-room').draft, exhibit(updated, 'clock-room').draft);
  assert.equal(exhibit(published).published?.revision, 2);
});

test('approval requires a review of the exact current revision', () => {
  const state = fixture();
  rejectsWith(() => transition(state, command(state, 'approve'), NOW), 'REVIEW_REQUIRED');
  exhibit(state).review = { revision: 1, requestedAt: NOW };
  rejectsWith(() => transition(state, command(state, 'approve'), NOW), 'REVIEW_REQUIRED');
});

test('duplicate review, approval, and publication cannot create duplicate audit events', () => {
  const initial = fixture();
  const review = transition(initial, command(initial, 'request-review'), NOW);
  rejectsWith(() => transition(review, command(review, 'request-review'), NOW), 'ALREADY_REVIEWED');
  const state = transition(review, command(review, 'approve'), NOW);
  rejectsWith(() => transition(state, command(state, 'approve'), NOW), 'ALREADY_APPROVED');
  const published = transition(state, command(state, 'publish'), NOW);
  const before = structuredClone(published);
  rejectsWith(() => transition(published, command(published, 'publish'), NOW), 'ALREADY_PUBLISHED');
  assert.deepEqual(published, before);
  assert.equal(published.audit.length, 3);
});

test('unchanged content, including surrounding whitespace, creates no new revision', () => {
  const state = fixture();
  const before = structuredClone(state);
  rejectsWith(() => edit(state, structuredClone(exhibit(state).draft.content)), 'NO_CHANGE');
  rejectsWith(() => edit(state, { ...exhibit(state).draft.content, title: `  ${exhibit(state).draft.content.title}  ` }), 'NO_CHANGE');
  assert.deepEqual(state, before);
});

test('a published exhibit with no edits cannot enter review', () => {
  const state = fixture();
  rejectsWith(() => transition(state, command(state, 'request-review', 'bench-room'), NOW), 'NO_UNPUBLISHED_CHANGES');
});

test('unknown exhibit commands leave the workspace untouched', () => {
  const state = fixture();
  const before = structuredClone(state);
  rejectsWith(() => transition(state, { ...command(state, 'request-review'), exhibitId: 'unknown-room' }, NOW), 'NOT_FOUND', 404);
  assert.deepEqual(state, before);
});
