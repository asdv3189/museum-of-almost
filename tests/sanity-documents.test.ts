import assert from 'node:assert/strict';
import test from 'node:test';
import { publicExhibits } from '../src/domain/model';
import { transition } from '../src/domain/workflow';
import { decodeWorkspace, encodeContent, exhibitDocumentId, publishedDocument, workspaceDocument, WORKSPACE_ID, type WorkspaceDocument } from '../src/sanity/documents';
import { approved, command, exhibit, fixture, NOW, rejectsWith } from './fixtures';

test('workspace encoding and decoding roundtrip drafts, published snapshots, approvals, and audit', () => {
  const approval = approved();
  const state = transition(approval, command(approval, 'publish'), NOW);
  const before = structuredClone(state);
  const document: WorkspaceDocument = { ...workspaceDocument(state), _rev: 'revision-one' };
  assert.equal(document._id, WORKSPACE_ID);
  assert.equal(document._type, 'almostWorkspace');
  assert.deepEqual(decodeWorkspace(document), state);
  assert.deepEqual(state, before);
  assert.deepEqual(document.audit.map((event) => event._key), state.audit.map((event) => event.id));
});

test('roundtrip preserves unpublished exhibits and absent review and approval', () => {
  const state = fixture();
  exhibit(state, 'garden-room').published = null;
  const document = { ...workspaceDocument(state), _rev: 'revision-two' };
  assert.deepEqual(decodeWorkspace(document), state);
  assert.equal(document.exhibits.find((item) => item.id === 'garden-room')?.published, null);
});

test('draft branches use weak native references while published branches use strong native references', () => {
  const state = fixture();
  const document = workspaceDocument(state);
  const entrance = document.exhibits.find((item) => item.id === 'entrance')!;
  assert.deepEqual(entrance.draft.content.branches[0].target, {
    _type: 'reference', _ref: exhibitDocumentId('clock-room'), _weak: true,
  });
  assert.deepEqual(entrance.published!.content.branches[0].target, {
    _type: 'reference', _ref: exhibitDocumentId('clock-room'),
  });
  assert.equal(entrance.draft.content.branches[0]._key, 'take-clock');
  assert.equal(entrance.draft.content.branches[0]._type, 'almostBranch');
  assert.ok(!('targetId' in entrance.draft.content.branches[0]));
});

test('public document keeps its collection type instead of inheriting the embedded content type', () => {
  const source = publicExhibits(fixture())[0];
  const document = publishedDocument(source);
  assert.equal(document._type, 'almostExhibit');
  assert.equal(document._id, exhibitDocumentId(source.id));
  assert.equal(document.exhibitId, source.id);
  assert.equal(document.revision, source.revision);
  assert.equal(document.fiction, true);
  assert.equal(document.title, 'The old entrance');
  assert.deepEqual(document.branches[0].target, { _type: 'reference', _ref: exhibitDocumentId('clock-room') });
  assert.ok(!('draft' in document));
  assert.ok(!('approval' in document));
  assert.ok(!('review' in document));
  assert.ok(!('audit' in document));
});

test('content serialization does not mutate domain branches or introduce reference metadata into them', () => {
  const source = exhibit(fixture()).draft.content;
  const before = structuredClone(source);
  const encoded = encodeContent(source, true);
  encoded.branches[0].target._ref = exhibitDocumentId('garden-room');
  assert.deepEqual(source, before);
  assert.equal(source.branches[0].targetId, 'clock-room');
});

test('unsupported Sanity workspace envelopes fail with a controlled service error', () => {
  for (const invalid of [
    { schemaVersion: 2 }, { version: 2.5 }, { exhibits: null }, { audit: {} },
  ]) {
    const document = { ...workspaceDocument(fixture()), _rev: 'revision-bad', ...invalid } as unknown as WorkspaceDocument;
    rejectsWith(() => decodeWorkspace(document), 'INVALID_SANITY_DATA', 503);
  }
});
