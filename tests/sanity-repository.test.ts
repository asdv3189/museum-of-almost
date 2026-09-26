import assert from 'node:assert/strict';
import test from 'node:test';
import type { SanityClient } from '@sanity/client';
import { MuseumError, publicExhibits } from '../src/domain/model';
import { SanityMuseumRepository } from '../src/repositories/sanity';
import { decodeWorkspace, PUBLIC_EXHIBITS_QUERY, publishedDocument, WORKSPACE_ID, WORKSPACE_QUERY, workspaceDocument, type WorkspaceDocument } from '../src/sanity/documents';
import { apiError } from '../src/server/access';
import { approved, command, exhibit, fixture } from './fixtures';

type WorkspaceFields = Omit<ReturnType<typeof workspaceDocument>, '_id' | '_type'>;
type PublicDocument = ReturnType<typeof publishedDocument>;
type PatchOperation = { kind: 'patch'; id: string; revision: string | null; fields: WorkspaceFields | null };
type ReplaceOperation = { kind: 'replace'; document: PublicDocument };

/** All mutations stay in this test-owned store. No real client is constructed. */
function fakeSanity(state = fixture()) {
  const store = {
    workspace: { ...workspaceDocument(state), _rev: 'provider-revision-1' } as WorkspaceDocument | null,
    documents: new Map(publicExhibits(state).map((item) => [publishedDocument(item)._id, publishedDocument(item)])),
    publicResult: structuredClone(publicExhibits(state)) as unknown,
    fetches: [] as { query: string; params: unknown }[],
    transactions: [] as { operations: (PatchOperation | ReplaceOperation)[]; commits: unknown[] }[],
    commitError: undefined as unknown,
    afterCommitError: undefined as unknown,
    fetchError: undefined as unknown,
  };
  const reader = {
    async fetch(query: string, params?: unknown) {
      store.fetches.push({ query, params });
      if (store.fetchError) throw store.fetchError;
      if (query === WORKSPACE_QUERY) return structuredClone(store.workspace);
      if (query === PUBLIC_EXHIBITS_QUERY) return structuredClone(store.publicResult);
      throw new Error('Unexpected query in the offline client');
    },
  } as unknown as SanityClient;
  const writer = {
    transaction() {
      const record = { operations: [] as (PatchOperation | ReplaceOperation)[], commits: [] as unknown[] };
      store.transactions.push(record);
      const transaction = {
        patch(id: string, configure: (patch: {
          ifRevisionId(revision: string): unknown;
          set(fields: WorkspaceFields): unknown;
        }) => unknown) {
          const operation: PatchOperation = { kind: 'patch', id, revision: null, fields: null };
          const patch = {
            ifRevisionId(revision: string) { operation.revision = revision; return patch; },
            set(fields: WorkspaceFields) { operation.fields = structuredClone(fields); return patch; },
          };
          configure(patch);
          record.operations.push(operation);
          return transaction;
        },
        createOrReplace(document: PublicDocument) {
          record.operations.push({ kind: 'replace', document: structuredClone(document) });
          return transaction;
        },
        async commit(options: unknown) {
          record.commits.push(options);
          if (store.commitError) throw store.commitError;
          const patch = record.operations.find((operation) => operation.kind === 'patch');
          assert.ok(patch && patch.kind === 'patch' && patch.fields);
          if (patch.revision !== store.workspace?._rev) {
            throw Object.assign(new Error('Mock revision conflict'), { statusCode: 409 });
          }
          // Apply both recorded mutations only after the revision precondition succeeds.
          const workspace = { ...store.workspace, ...structuredClone(patch.fields), _rev: `provider-revision-${patch.fields.version}` } as WorkspaceDocument;
          const documents = new Map(store.documents);
          for (const operation of record.operations) {
            if (operation.kind === 'replace') documents.set(operation.document._id, structuredClone(operation.document));
          }
          store.workspace = workspace;
          store.documents = documents;
          if (store.afterCommitError) throw store.afterCommitError;
          return { transactionId: 'offline-transaction' };
        },
      };
      return transaction;
    },
  } as unknown as SanityClient;
  return { store, repository: new SanityMuseumRepository(reader, writer) };
}

async function withWriteEnvironment<T>(operation: () => Promise<T>, enabled = 'true', token: string | null = 'offline-test-token'): Promise<T> {
  const oldEnabled = process.env.SANITY_WRITE_ENABLED;
  const oldToken = process.env.SANITY_WRITE_TOKEN;
  process.env.SANITY_WRITE_ENABLED = enabled;
  if (token === null) delete process.env.SANITY_WRITE_TOKEN;
  else process.env.SANITY_WRITE_TOKEN = token;
  try { return await operation(); }
  finally {
    if (oldEnabled === undefined) delete process.env.SANITY_WRITE_ENABLED;
    else process.env.SANITY_WRITE_ENABLED = oldEnabled;
    if (oldToken === undefined) delete process.env.SANITY_WRITE_TOKEN;
    else process.env.SANITY_WRITE_TOKEN = oldToken;
  }
}

async function rejectsWithAsync(operation: () => Promise<unknown>, code: string, status: number) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof MuseumError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('Sanity publication commits the revision-guarded workspace and exact public snapshot in one transaction', async () => {
  await withWriteEnvironment(async () => {
    const initial = approved();
    const { store, repository } = fakeSanity(initial);
    const next = await repository.execute(command(initial, 'publish'));

    assert.equal(store.transactions.length, 1);
    const transaction = store.transactions[0];
    assert.equal(transaction.commits.length, 1);
    assert.deepEqual(transaction.commits[0], { visibility: 'sync' });
    assert.equal(transaction.operations.length, 2);
    const patch = transaction.operations.find((operation) => operation.kind === 'patch');
    assert.ok(patch && patch.kind === 'patch');
    assert.equal(patch.id, WORKSPACE_ID);
    assert.equal(patch.revision, 'provider-revision-1');
    assert.equal(patch.fields?.version, initial.version + 1);
    assert.deepEqual(decodeWorkspace(store.workspace!), next);

    const published = publicExhibits(next).find((item) => item.id === 'entrance')!;
    const expected = publishedDocument(published);
    assert.deepEqual(store.documents.get(expected._id), expected);
    assert.equal(expected._type, 'almostExhibit');
    assert.deepEqual(exhibit(next).published, exhibit(initial).draft);
    assert.deepEqual(store.fetches, [{ query: WORKSPACE_QUERY, params: { id: WORKSPACE_ID } }]);
  });
});

test('review and approval mutate only the workspace and leave all public documents unchanged', async () => {
  await withWriteEnvironment(async () => {
    const initial = fixture();
    const { store, repository } = fakeSanity(initial);
    const publicBefore = structuredClone([...store.documents]);
    const review = await repository.execute(command(initial, 'request-review'));
    const approval = await repository.execute(command(review, 'approve'));
    assert.deepEqual([...store.documents], publicBefore);
    assert.equal(store.transactions.length, 2);
    for (const transaction of store.transactions) {
      assert.equal(transaction.operations.length, 1);
      assert.equal(transaction.operations[0].kind, 'patch');
      assert.equal(transaction.commits.length, 1);
    }
    assert.deepEqual(decodeWorkspace(store.workspace!), approval);
    assert.equal(exhibit(approval).approval?.revision, 2);
  });
});

test('concurrent Sanity saves use the provider revision to permit exactly one committed mutation', async () => {
  await withWriteEnvironment(async () => {
    const initial = fixture();
    const { store, repository } = fakeSanity(initial);
    const editCommand = (title: string) => ({
      type: 'edit' as const, exhibitId: 'entrance', expectedVersion: initial.version,
      expectedRevision: exhibit(initial).draft.revision,
      content: { ...exhibit(initial).draft.content, title },
    });
    const results = await Promise.allSettled([
      repository.execute(editCommand('Sanity editor one')),
      repository.execute(editCommand('Sanity editor two')),
    ]);
    const winners = results.filter((result) => result.status === 'fulfilled');
    const losers = results.filter((result) => result.status === 'rejected');
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.ok(losers[0].reason instanceof MuseumError);
    assert.equal(losers[0].reason.code, 'STALE_WORKSPACE');
    assert.equal(losers[0].reason.status, 409);
    assert.deepEqual(decodeWorkspace(store.workspace!), winners[0].value);
    assert.equal(store.workspace!.audit.length, 1);
    assert.equal(store.transactions.length, 2, 'Both editors read the old snapshot, so the provider CAS must settle the race');
  });
});

for (const [label, providerError, expectedCode, expectedStatus] of [
  ['revision conflict', Object.assign(new Error('Private conflict payload'), { statusCode: 409, body: 'do-not-expose-this-body' }), 'STALE_WORKSPACE', 409],
  ['provider failure', Object.assign(new Error('Private provider payload'), { statusCode: 500, body: 'do-not-expose-this-body' }), 'SANITY_WRITE_FAILED', 503],
] as const) {
  test(`${label} produces a sanitized failure and never returns an unconfirmed publish result`, async () => {
    await withWriteEnvironment(async () => {
      const initial = approved();
      const { store, repository } = fakeSanity(initial);
      const workspaceBefore = structuredClone(store.workspace);
      const publicBefore = structuredClone([...store.documents]);
      store.commitError = providerError;
      let response: Response | undefined;
      try { await repository.execute(command(initial, 'publish')); }
      catch (error) { response = apiError(error); }
      assert.ok(response, 'A failed commit must reject rather than return a successful new state');
      assert.equal(response.status, expectedStatus);
      const payload = await response.json();
      assert.equal(payload.code, expectedCode);
      assert.ok(!JSON.stringify(payload).includes('do-not-expose'));
      assert.ok(!JSON.stringify(payload).includes('Private'));
      assert.deepEqual(store.workspace, workspaceBefore);
      assert.deepEqual([...store.documents], publicBefore);
      assert.equal(store.transactions.length, 1);
      assert.equal(store.transactions[0].commits.length, 1, 'Uncertain saves must not retry automatically');
    });
  });
}

test('a lost acknowledgement after provider commit reports uncertainty and does not retry the publication', async () => {
  await withWriteEnvironment(async () => {
    const initial = approved();
    const { store, repository } = fakeSanity(initial);
    store.afterCommitError = new Error('Offline simulation: response lost after commit');
    await rejectsWithAsync(() => repository.execute(command(initial, 'publish')), 'SANITY_WRITE_FAILED', 503);
    assert.equal(store.transactions.length, 1);
    assert.equal(store.transactions[0].commits.length, 1);
    const reloaded = await repository.readWorkspace();
    assert.equal(reloaded.version, initial.version + 1);
    assert.deepEqual(exhibit(reloaded).published, exhibit(initial).draft);
    assert.equal(reloaded.audit[0].action, 'published');
    assert.equal(reloaded.audit.filter((event) => event.action === 'published').length, 1);
  });
});

test('domain preconditions reject before a Sanity transaction is opened', async () => {
  await withWriteEnvironment(async () => {
    const initial = fixture();
    const { store, repository } = fakeSanity(initial);
    await rejectsWithAsync(() => repository.execute(command(initial, 'publish')), 'APPROVAL_REQUIRED', 422);
    const stale = command(initial, 'request-review');
    stale.expectedVersion -= 1;
    await rejectsWithAsync(() => repository.execute(stale), 'STALE_WORKSPACE', 409);
    assert.equal(store.transactions.length, 0);
    assert.deepEqual(decodeWorkspace(store.workspace!), initial);
  });
});

test('write enablement and a token are both required before contacting the reader or writer', async () => {
  for (const [enabled, token] of [['false', 'offline-token'], ['true', null]] as const) {
    await withWriteEnvironment(async () => {
      const { store, repository } = fakeSanity();
      await rejectsWithAsync(() => repository.execute(command(fixture(), 'request-review')), 'SANITY_WRITES_DISABLED', 403);
      assert.equal(store.fetches.length, 0);
      assert.equal(store.transactions.length, 0);
    }, enabled, token);
  }
});

test('workspace reads use the fixed workspace identity and preserve all decoded state', async () => {
  const state = approved();
  const { store, repository } = fakeSanity(state);
  assert.deepEqual(await repository.readWorkspace(), state);
  assert.deepEqual(store.fetches, [{ query: WORKSPACE_QUERY, params: { id: WORKSPACE_ID } }]);
  assert.equal(store.transactions.length, 0);
});

test('an absent Sanity workspace is reported without seeding or writes', async () => {
  const { store, repository } = fakeSanity();
  store.workspace = null;
  await rejectsWithAsync(() => repository.readWorkspace(), 'SANITY_NOT_SEEDED', 503);
  assert.equal(store.transactions.length, 0);
});

test('public reads return validated projected content and never consult the workspace document', async () => {
  const initial = fixture();
  const { store, repository } = fakeSanity(initial);
  store.workspace = null;
  assert.deepEqual(await repository.readPublic(), publicExhibits(initial));
  assert.deepEqual(store.fetches, [{ query: PUBLIC_EXHIBITS_QUERY, params: undefined }]);
  assert.equal(store.transactions.length, 0);
});

test('public reads reject empty collections and missing or cyclic branch graphs', async () => {
  for (const makeInvalid of [
    () => [],
    () => publicExhibits(fixture()).filter((item) => item.id !== 'clock-room'),
    () => {
      const exhibits = publicExhibits(fixture());
      exhibits[0].branches[0].targetId = 'entrance';
      return exhibits;
    },
  ]) {
    const { store, repository } = fakeSanity();
    store.publicResult = makeInvalid();
    await rejectsWithAsync(() => repository.readPublic(), 'INVALID_SANITY_DATA', 503);
    assert.equal(store.transactions.length, 0);
  }
});

test('public reads normalize a missing branch collection on a terminal exhibit', async () => {
  const { store, repository } = fakeSanity();
  const terminal = publicExhibits(fixture()).find((item) => item.id === 'bench-room')!;
  store.publicResult = [{ ...terminal, branches: null }];
  assert.deepEqual(await repository.readPublic(), [{ ...terminal, branches: [] }]);
});

test('unexpected provider read errors are sanitized at the API boundary', async () => {
  const { store, repository } = fakeSanity();
  store.fetchError = Object.assign(new Error('private provider request details'), { headers: { authorization: 'not-a-real-secret' } });
  let response: Response | undefined;
  try { await repository.readWorkspace(); }
  catch (error) { response = apiError(error); }
  assert.ok(response);
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.code, 'SERVICE_UNAVAILABLE');
  assert.equal(typeof payload.error, 'string');
  assert.ok(payload.error.length > 0);
  assert.ok(!JSON.stringify(payload).includes('private provider'));
  assert.ok(!JSON.stringify(payload).includes('authorization'));
  assert.ok(!JSON.stringify(payload).includes('not-a-real-secret'));
});
