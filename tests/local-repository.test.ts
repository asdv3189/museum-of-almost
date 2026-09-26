import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { MuseumError, publicExhibits, type MuseumState } from '../src/domain/model';
import { LocalMuseumRepository } from '../src/repositories/local';
import { approved, branch, command, edit, exhibit, fixture } from './fixtures';

async function temporaryRepository(t: TestContext, state?: MuseumState) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'almost-repository-test-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('almost-repository-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  const statePath = path.join(directory, 'museum.json');
  if (state) await writeFile(statePath, JSON.stringify(state), 'utf8');
  return { directory, statePath, repository: new LocalMuseumRepository(directory) };
}

async function rejectsWithAsync(operation: () => Promise<unknown>, code: string, status: number) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof MuseumError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('an empty local repository initializes once and a new instance reads the persisted state', async (t) => {
  const { directory, statePath, repository } = await temporaryRepository(t);
  const initial = await repository.readWorkspace();
  assert.equal(initial.schemaVersion, 1);
  assert.ok(initial.exhibits.length > 0);
  assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')), initial);
  assert.deepEqual(await new LocalMuseumRepository(directory).readWorkspace(), initial);
  assert.deepEqual(await repository.readPublic(), publicExhibits(initial));
  assert.deepEqual(await readdir(directory), ['museum.json']);
});

test('local publication persists the approved snapshot and audit across repository instances', async (t) => {
  const initial = approved();
  const { directory, statePath, repository } = await temporaryRepository(t, initial);
  const published = await repository.execute(command(initial, 'publish'));
  const reopened = new LocalMuseumRepository(directory);
  assert.deepEqual(await reopened.readWorkspace(), published);
  assert.deepEqual(await reopened.readPublic(), publicExhibits(published));
  assert.deepEqual(exhibit(published).published, exhibit(initial).draft);
  assert.equal(published.audit[0].action, 'published');
  assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')), published);
  assert.deepEqual(await readdir(directory), ['museum.json']);
});

test('concurrent writers from independent instances cannot overwrite each other', async (t) => {
  const initial = fixture();
  const { directory, repository } = await temporaryRepository(t, initial);
  const rival = new LocalMuseumRepository(directory);
  const editCommand = (title: string) => ({
    type: 'edit' as const, exhibitId: 'entrance', expectedVersion: initial.version,
    expectedRevision: exhibit(initial).draft.revision,
    content: { ...exhibit(initial).draft.content, title },
  });
  const results = await Promise.allSettled([
    repository.execute(editCommand('Editor one')),
    rival.execute(editCommand('Editor two')),
  ]);
  const winners = results.filter((result) => result.status === 'fulfilled');
  const losers = results.filter((result) => result.status === 'rejected');
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.ok(losers[0].reason instanceof MuseumError);
  assert.equal(losers[0].reason.status, 409);
  assert.ok(['WORKSPACE_BUSY', 'STALE_WORKSPACE'].includes(losers[0].reason.code));
  const saved = await rival.readWorkspace();
  assert.deepEqual(saved, winners[0].value);
  assert.equal(saved.version, initial.version + 1);
  assert.equal(saved.audit.length, 1);
  assert.deepEqual(publicExhibits(saved), publicExhibits(initial));
  assert.deepEqual(await readdir(directory), ['museum.json']);
});

test('a persistent lock blocks writes, preserves bytes, and still permits reading the last confirmed state', async (t) => {
  const initial = fixture();
  const { directory, statePath, repository } = await temporaryRepository(t, initial);
  await mkdir(path.join(directory, 'write.lock'));
  const bytes = await readFile(statePath);
  await rejectsWithAsync(() => repository.execute(command(initial, 'request-review')), 'WORKSPACE_BUSY', 409);
  assert.deepEqual(await readFile(statePath), bytes);
  assert.deepEqual(await repository.readWorkspace(), initial);
  assert.deepEqual(await readdir(directory), ['museum.json', 'write.lock']);
});

test('a failed publication preserves exact disk bytes and releases its lock for a later valid command', async (t) => {
  const base = fixture();
  const invalid = approved(edit(base, { ...exhibit(base).draft.content, branches: [branch('missing-choice', 'missing-room')] }));
  const { directory, statePath, repository } = await temporaryRepository(t, invalid);
  const bytes = await readFile(statePath);
  await rejectsWithAsync(() => repository.execute(command(invalid, 'publish')), 'INVALID_GRAPH', 422);
  assert.deepEqual(await readFile(statePath), bytes);
  assert.deepEqual(await repository.readPublic(), publicExhibits(invalid));
  assert.deepEqual(await readdir(directory), ['museum.json']);

  const repaired = await repository.execute({
    type: 'edit', exhibitId: 'entrance', expectedVersion: invalid.version,
    expectedRevision: exhibit(invalid).draft.revision,
    content: { ...exhibit(invalid).draft.content, branches: [] },
  });
  assert.equal(repaired.version, invalid.version + 1);
  assert.equal(exhibit(repaired).approval, null);
});

test('stale local commands do not rewrite persisted state or append audit events', async (t) => {
  const initial = approved();
  const { statePath, repository } = await temporaryRepository(t, initial);
  const stale = command(initial, 'publish');
  stale.expectedVersion -= 1;
  const before = await readFile(statePath);
  await rejectsWithAsync(() => repository.execute(stale), 'STALE_WORKSPACE', 409);
  assert.deepEqual(await readFile(statePath), before);
  assert.deepEqual(await repository.readWorkspace(), initial);
});

for (const [label, corrupted] of [
  ['truncated JSON', '{"schemaVersion":1,"version":10,'],
  ['unsupported schema', JSON.stringify({ ...fixture(), schemaVersion: 99 })],
  ['invalid version', JSON.stringify({ ...fixture(), version: 'ten' })],
  ['invalid exhibit collection', JSON.stringify({ ...fixture(), exhibits: {} })],
  ['invalid audit collection', JSON.stringify({ ...fixture(), audit: null })],
] as const) {
  test(`${label} is rejected and preserved without silently restoring seed data`, async (t) => {
    const { directory, statePath, repository } = await temporaryRepository(t);
    await writeFile(statePath, corrupted, 'utf8');
    await rejectsWithAsync(() => repository.readWorkspace(), 'LOCAL_STATE_INVALID', 503);
    await rejectsWithAsync(() => repository.readPublic(), 'LOCAL_STATE_INVALID', 503);
    await rejectsWithAsync(() => repository.execute(command(fixture(), 'request-review')), 'LOCAL_STATE_INVALID', 503);
    assert.equal(await readFile(statePath, 'utf8'), corrupted);
    assert.deepEqual(await readdir(directory), ['museum.json']);
  });
}

test('readers observe complete snapshots while atomic local saves replace the data file', async (t) => {
  const initial = fixture();
  const { directory, repository } = await temporaryRepository(t, initial);
  const reader = new LocalMuseumRepository(directory);
  const observed: MuseumState[] = [];
  const writing = (async () => {
    let current = initial;
    for (let index = 1; index <= 12; index += 1) {
      current = await repository.execute({
        type: 'edit', exhibitId: 'entrance', expectedVersion: current.version,
        expectedRevision: exhibit(current).draft.revision,
        content: { ...exhibit(current).draft.content, title: `Saved title ${index}` },
      });
    }
    return current;
  })();
  const reading = (async () => {
    for (let index = 0; index < 40; index += 1) observed.push(await reader.readWorkspace());
  })();
  // Always finish both tasks before the temp-directory cleanup runs, even on failure.
  const [written, read] = await Promise.allSettled([writing, reading]);
  if (written.status === 'rejected') throw written.reason;
  if (read.status === 'rejected') throw read.reason;
  const final = written.value;
  for (const snapshot of observed) {
    const count = snapshot.version - initial.version;
    assert.ok(count >= 0 && count <= 12);
    assert.equal(snapshot.audit.length, count);
    assert.equal(exhibit(snapshot).draft.revision, 2 + count);
    assert.equal(exhibit(snapshot).draft.content.title, count === 0 ? 'The new entrance' : `Saved title ${count}`);
  }
  assert.deepEqual(await reader.readWorkspace(), final);
  assert.equal(final.audit.length, 12);
  assert.deepEqual(await readdir(directory), ['museum.json']);
});
