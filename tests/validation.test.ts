import assert from 'node:assert/strict';
import test from 'node:test';
import { publicExhibits } from '../src/domain/model';
import { graphProblems, parseCommand, parseContent } from '../src/domain/validation';
import { branch, content, fixture, rejectsWith } from './fixtures';

test('a branching public graph with converging paths is valid', () => {
  assert.deepEqual(graphProblems(publicExhibits(fixture())), []);
});

test('graph validation reports missing references with the source, branch, and missing target', () => {
  const exhibits = publicExhibits(fixture());
  exhibits[0].branches = [branch('lost-path', 'missing-room')];
  const problems = graphProblems(exhibits);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /The old entrance/);
  assert.match(problems[0], /Choose lost-path/);
  assert.match(problems[0], /missing-room/);
});

test('graph validation catches self-loops and cycles in disconnected components', () => {
  const selfLoop = publicExhibits(fixture());
  selfLoop[0].branches = [branch('stay-here', 'entrance')];
  assert.ok(graphProblems(selfLoop).some((problem) => /Branch cycle: entrance → entrance/.test(problem)));

  const disconnected = publicExhibits(fixture());
  disconnected[0].branches = [];
  disconnected.find((item) => item.id === 'bench-room')!.branches = [branch('back-to-clock', 'clock-room')];
  assert.ok(graphProblems(disconnected).some((problem) => /clock-room → bench-room → clock-room/.test(problem)));
});

test('duplicate public exhibit identifiers are invalid even if their branches are empty', () => {
  const exhibits = publicExhibits(fixture());
  assert.ok(graphProblems([...exhibits, structuredClone(exhibits[3])]).includes('Exhibit IDs must be unique.'));
});

test('content parsing trims display fields and keeps branch identity, target, and consequence', () => {
  const input = content('  A possible umbrella  ', [branch('open-it', 'garden-room', '  Rain becomes an invitation.  ')]);
  const parsed = parseContent(input);
  assert.equal(parsed.title, 'A possible umbrella');
  assert.deepEqual(parsed.branches, [{
    id: 'open-it', targetId: 'garden-room', label: 'Choose open-it', consequence: 'Rain becomes an invitation.',
  }]);
  assert.equal(input.title, '  A possible umbrella  ', 'Parsing must not mutate the supplied input');
});

for (const [label, override] of [
  ['blank title', { title: '   ' }],
  ['oversize premise', { premise: 'x'.repeat(1201) }],
  ['unsupported category', { category: 'Unregistered category' }],
  ['unsupported artifact', { artifact: 'helicopter' }],
  ['non-hex color', { color: 'orange' }],
  ['missing branches', { branches: undefined }],
  ['too many branches', { branches: ['aa', 'bb', 'cc', 'dd'].map((id) => branch(id, 'bench-room')) }],
  ['malformed branch identifier', { branches: [branch('../secret', 'bench-room')] }],
  ['malformed destination identifier', { branches: [branch('go-there', 'https://outside.test')] }],
  ['blank consequence', { branches: [{ ...branch('go-there', 'bench-room'), consequence: '' }] }],
] as const) {
  test(`content parsing rejects ${label}`, () => {
    rejectsWith(() => parseContent({ ...content('A valid exhibit'), ...override }), 'INVALID_INPUT');
  });
}

test('duplicate branch identifiers are rejected but different branches can share one destination', () => {
  rejectsWith(() => parseContent(content('A branching exhibit', [branch('same-id', 'clock-room'), branch('same-id', 'garden-room')])), 'DUPLICATE_BRANCH');
  const parsed = parseContent(content('Converging choices', [branch('one-way', 'bench-room'), branch('another-way', 'bench-room')]));
  assert.equal(parsed.branches.length, 2);
});

test('command parsing validates the version contract and content before accepting edits', () => {
  const base = { type: 'edit', exhibitId: 'entrance', expectedVersion: 10, expectedRevision: 2, content: content('A changed exhibit') };
  assert.deepEqual(parseCommand(base), base);
  for (const expectedVersion of [0, -1, 1.5, '10', null, Number.MAX_SAFE_INTEGER + 1]) {
    rejectsWith(() => parseCommand({ ...base, expectedVersion }), 'INVALID_INPUT');
  }
  for (const expectedRevision of [0, -1, 1.5, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
    rejectsWith(() => parseCommand({ ...base, expectedRevision }), 'INVALID_INPUT');
  }
  rejectsWith(() => parseCommand({ ...base, content: { ...base.content, title: '' } }), 'INVALID_INPUT');
  rejectsWith(() => parseCommand({ ...base, type: 'delete' }), 'INVALID_INPUT');
  rejectsWith(() => parseCommand({ ...base, exhibitId: '../entrance' }), 'INVALID_INPUT');
});

test('parsers reject primitives and arrays instead of treating them as records', () => {
  for (const value of [null, undefined, false, 1, 'exhibit', []]) {
    rejectsWith(() => parseContent(value), 'INVALID_INPUT');
    rejectsWith(() => parseCommand(value), 'INVALID_INPUT');
  }
});
