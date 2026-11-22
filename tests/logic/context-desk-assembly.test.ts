import test from 'node:test';
import assert from 'node:assert/strict';
import { aiUsageMeter, formatResetsIn } from '../../src/lib/ai-usage';
import { deskComposition, deskSuggestions, proposeFromQuestion, type DeskItem } from '../../src/lib/context-desk-suggestions';
import { MAX_FOLDERS, MAX_FOLDER_ITEMS, folderAdditions, readFolders, replaceFolder, toggleFolderItem, type ContextFolder } from '../../src/lib/context-folders';

const item = (over: Partial<DeskItem> & Pick<DeskItem, 'key' | 'type'>): DeskItem => ({
  label: over.key, sourceIds: [], conceptIds: [], ...over,
});
const name = (key: string) => key;
const label = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

test('a source several desk records cite, but which is absent, is suggested', () => {
  const onDesk = [
    item({ key: 'position:a', type: 'position', sourceIds: ['deep-work'] }),
    item({ key: 'work:b', type: 'work', sourceIds: ['deep-work'] }),
  ];
  const pool = [item({ key: 'source:deep-work', type: 'source', sourceIds: ['deep-work'] })];
  const [first] = deskSuggestions(onDesk, pool, name);
  assert.equal(first.key, 'source:deep-work');
  assert.match(first.why, /Cited by 2 records/);

  // One record leaning on it is not a pattern.
  assert.equal(deskSuggestions([onDesk[0]], pool, name).length, 0);
  // And a source already on the desk is never suggested back to you.
  assert.equal(deskSuggestions([...onDesk, pool[0]], pool, name).length, 0);
});

test('an inquiry still open on a concept you brought is suggested; a closed one is not', () => {
  const onDesk = [item({ key: 'concept:attention', type: 'concept', conceptIds: ['attention'] })];
  const open = item({ key: 'inquiry:q1', type: 'inquiry', conceptIds: ['attention'], open: true });
  const closed = item({ key: 'inquiry:q2', type: 'inquiry', conceptIds: ['attention'], open: false });

  const found = deskSuggestions(onDesk, [open, closed], (key) => key === 'attention' ? 'Attention' : key);
  assert.deepEqual(found.map((s) => s.key), ['inquiry:q1']);
  assert.match(found[0].why, /Attention/);
});

test('a concept several records are about, but which is not itself on the desk, is suggested', () => {
  const onDesk = [
    item({ key: 'position:a', type: 'position', conceptIds: ['habit'] }),
    item({ key: 'annotation:b', type: 'annotation', conceptIds: ['habit'] }),
  ];
  const concept = item({ key: 'concept:habit', type: 'concept', conceptIds: ['habit'] });
  const found = deskSuggestions(onDesk, [concept], name);
  assert.deepEqual(found.map((s) => s.key), ['concept:habit']);

  // Once the concept is on the desk the rule stops firing.
  assert.equal(deskSuggestions([...onDesk, concept], [concept], name).length, 0);
});

test('suggestions never repeat a record and never exceed the limit', () => {
  const onDesk = [
    item({ key: 'position:a', type: 'position', sourceIds: ['s1'], conceptIds: ['c1'] }),
    item({ key: 'work:b', type: 'work', sourceIds: ['s1'], conceptIds: ['c1'] }),
  ];
  const pool = [
    item({ key: 'source:s1', type: 'source', sourceIds: ['s1'] }),
    item({ key: 'concept:c1', type: 'concept', conceptIds: ['c1'] }),
    item({ key: 'inquiry:q', type: 'inquiry', conceptIds: ['c1'], open: true }),
  ];
  const found = deskSuggestions(onDesk, pool, name, 2);
  assert.equal(found.length, 2);
  assert.equal(new Set(found.map((s) => s.key)).size, 2);
});

test('composition calls out a desk drawn from a single kind', () => {
  const same = deskComposition([
    item({ key: 'a', type: 'inquiry' }), item({ key: 'b', type: 'inquiry' }),
  ], label);
  assert.equal(same.tone, 'thin');
  assert.equal(same.kinds, 1);
  assert.match(same.verdict, /rarely turns up a tension/);

  const mixed = deskComposition([
    item({ key: 'a', type: 'inquiry' }), item({ key: 'b', type: 'position' }),
    item({ key: 'c', type: 'source' }), item({ key: 'd', type: 'concept' }),
  ], label);
  assert.equal(mixed.tone, 'good');
  assert.equal(mixed.kinds, 4);

  assert.equal(deskComposition([], label).tone, 'empty');
  // Kinds come back most numerous first, so the bar reads in order.
  assert.equal(deskComposition([
    item({ key: 'a', type: 'source' }), item({ key: 'b', type: 'position' }), item({ key: 'c', type: 'position' }),
  ], label).counts[0].type, 'position');
});

test('a folder holds a few records, and the cap is enforced on the way in', () => {
  const folder: ContextFolder = { id: 'f1', name: 'Staples', items: ['a', 'b'], revision: 'r1' };
  assert.deepEqual(toggleFolderItem(folder, 'c').items, ['a', 'b', 'c']);
  assert.deepEqual(toggleFolderItem(folder, 'a').items, ['b']);

  const full: ContextFolder = { ...folder, items: ['a', 'b', 'c', 'd', 'e'] };
  assert.equal(full.items.length, MAX_FOLDER_ITEMS);
  // A full folder refuses quietly rather than dropping someone else's record.
  assert.deepEqual(toggleFolderItem(full, 'f').items, full.items);
  assert.deepEqual(toggleFolderItem(full, 'a').items, ['b', 'c', 'd', 'e']);

  // What it would add to a desk skips what is already there.
  assert.deepEqual(folderAdditions(folder, ['a']), ['b']);
  assert.deepEqual(folderAdditions(folder, ['a', 'b']), []);
});

test('folders refuse a stale write, an over-full folder, and one folder too many', () => {
  const current: ContextFolder[] = [{ id: 'f1', name: 'Staples', items: ['a'], revision: 'r1' }];
  const next: ContextFolder = { id: 'f1', name: 'Staples', items: ['a', 'b'], revision: 'r2' };
  assert.deepEqual(replaceFolder(current, 'f1', 'r1', next)[0].items, ['a', 'b']);
  assert.throws(() => replaceFolder(current, 'f1', 'wrong', next), /changed on another device/);
  assert.equal(replaceFolder(current, 'f1', 'r1', null).length, 0);

  const many = Array.from({ length: MAX_FOLDERS }, (_, index) => ({ id: `f${index}`, name: `F${index}`, items: [], revision: 'r' }));
  assert.throws(() => replaceFolder(many, 'new', null, { id: 'new', name: 'One more', items: [], revision: 'r' }), /Delete one/);
  assert.throws(
    () => replaceFolder([], 'big', null, { id: 'big', name: 'Big', items: ['a', 'b', 'c', 'd', 'e', 'f'], revision: 'r' }),
    /holds up to/,
  );
});

test('stored folders are read back defensively', () => {
  const read = readFolders([
    { id: 'f1', name: ' Staples ', items: ['a', 'a', 'b'], revision: 'r1' },
    { id: 'f1', name: 'Duplicate id', items: [], revision: 'r2' },
    { id: 'bad id!', name: 'Rejected', items: [], revision: 'r3' },
    { id: 'f2', name: '   ', items: [], revision: 'r4' },
    { id: 'f3', name: 'No revision', items: [] },
    null,
  ]);
  assert.deepEqual(read.map((folder) => folder.id), ['f1']);
  assert.equal(read[0].name, 'Staples');
  assert.deepEqual(read[0].items, ['a', 'b']);
  assert.deepEqual(readFolders('not an array'), []);
});

test('the usage meter reads the day allowance and names the limit that binds', () => {
  const easy = aiUsageMeter({ day: 10, minute: 1, dayLimit: 50, minuteLimit: 5 });
  assert.equal(easy.tone, 'ok');
  assert.equal(easy.remaining, 40);
  assert.equal(easy.blocked, false);
  assert.match(easy.message, /10 of 50 used today/);

  const nearly = aiUsageMeter({ day: 45, minute: 1, dayLimit: 50, minuteLimit: 5 });
  assert.equal(nearly.tone, 'caution');
  assert.match(nearly.message, /5 reviews left today/);

  const spent = aiUsageMeter({ day: 50, minute: 0, dayLimit: 50, minuteLimit: 5, dayResetsIn: 7200 });
  assert.equal(spent.tone, 'problem');
  assert.equal(spent.blocked, true);
  assert.equal(spent.remaining, 0);
  assert.match(spent.message, /resets in 2 hours/);

  // A minute pause is a wait, not a shortage: it still says what is left.
  const paused = aiUsageMeter({ day: 10, minute: 5, dayLimit: 50, minuteLimit: 5, minuteResetsIn: 20 });
  assert.equal(paused.blocked, true);
  assert.match(paused.message, /in 20 seconds/);
  assert.match(paused.message, /40 left today/);

  // Nonsense never breaks the bar.
  const odd = aiUsageMeter({ day: 999, minute: 0, dayLimit: 0, minuteLimit: 0 });
  assert.ok(odd.fraction <= 1 && odd.fraction >= 0);
  assert.equal(aiUsageMeter({ day: -4, minute: -1, dayLimit: 50, minuteLimit: 5 }).used, 0);
});

test('a reset time is always said in words', () => {
  assert.equal(formatResetsIn(0), 'shortly');
  assert.equal(formatResetsIn(undefined), 'shortly');
  assert.equal(formatResetsIn(1), 'in 1 second');
  assert.equal(formatResetsIn(45), 'in 45 seconds');
  assert.equal(formatResetsIn(600), 'in 10 minutes');
  assert.equal(formatResetsIn(7200), 'in 2 hours');
});

test('a question brings the concept it names, and what is open or argued about it', () => {
  const pool: DeskItem[] = [
    { key: 'concept:attention', type: 'concept', label: 'Attention', sourceIds: [], conceptIds: ['attention'] },
    { key: 'concept:habit', type: 'concept', label: 'Habit', sourceIds: [], conceptIds: ['habit'] },
    { key: 'inquiry:open', type: 'inquiry', label: 'Is attention a resource?', sourceIds: [], conceptIds: ['attention'], open: true },
    { key: 'inquiry:shut', type: 'inquiry', label: 'Settled question', sourceIds: [], conceptIds: ['attention'], open: false },
    { key: 'position:p', type: 'position', label: 'Attention must be protected', sourceIds: [], conceptIds: ['attention'] },
    { key: 'source:far', type: 'source', label: 'Something unrelated', sourceIds: [], conceptIds: ['habit'] },
  ];
  const names = new Map([['attention', 'Attention'], ['habit', 'Habit']]);
  const found = proposeFromQuestion('Is my attention a resource or a capacity?', pool, names);

  assert.equal(found[0].key, 'concept:attention');
  assert.match(found[0].why, /named this concept/);
  // What is open on the named concept outranks what merely asserts about it.
  const order = found.map((item) => item.key);
  assert.ok(order.indexOf('inquiry:open') < order.indexOf('position:p'));
  assert.match(found[order.indexOf('inquiry:open')].why, /Still open on Attention/);
  // Nothing about an unnamed concept arrives on its coat-tails.
  assert.ok(!order.includes('source:far'));
  // A closed inquiry is still about the concept, but not urged as open.
  assert.ok(!/Still open/.test(found[order.indexOf('inquiry:shut')]?.why || ''));
});

test('a question with nothing in it proposes nothing, and filler words match nothing', () => {
  const pool: DeskItem[] = [
    { key: 'concept:a', type: 'concept', label: 'Attention', sourceIds: [], conceptIds: ['attention'] },
    { key: 'source:b', type: 'source', label: 'These records should be examined', sourceIds: [], conceptIds: [] },
  ];
  const names = new Map([['attention', 'Attention']]);
  assert.deepEqual(proposeFromQuestion('', pool, names), []);
  assert.deepEqual(proposeFromQuestion('  ?  ', pool, names), []);
  // "should", "these" and "records" are filler and must not drag a record in.
  assert.deepEqual(proposeFromQuestion('What should these records show?', pool, names), []);
});

test('a question proposes at most the limit, best first', () => {
  const pool: DeskItem[] = Array.from({ length: 12 }, (_, index) => ({
    key: `position:${index}`, type: 'position', label: `Position ${index} on attention`,
    sourceIds: [], conceptIds: ['attention'],
  }));
  const names = new Map([['attention', 'Attention']]);
  const found = proposeFromQuestion('What do I hold about attention?', pool, names, 4);
  assert.equal(found.length, 4);
  assert.ok(found.every((item) => /A position about Attention/.test(item.why)));
});
