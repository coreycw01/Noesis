import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceConnections } from '../../src/lib/source-connections';
import { recentSourceSessionExcerpts, sourceSessionExcerpt, stopSourceSession } from '../../src/lib/source-session';
import type { Concept, Draft, Media, Question, VaultEntry } from '../../src/lib/types';

test('source connections favor real downstream uses over tags and leave out unrelated records', () => {
  const source = { id: 'book', tags: ['Attention'], annotations: [{ createdPositionId: 'formed' }] } as Media;
  const rows = sourceConnections(source, {
    concepts: [{ id: 'attention', name: 'Attention' } as Concept],
    positions: [{ id: 'formed', title: 'Formed from a note' } as VaultEntry, { id: 'other', title: 'Unrelated' } as VaultEntry],
    inquiries: [{ id: 'q', text: 'Cites the source', sourceIds: ['book'] } as Question],
    works: [{ id: 'draft', title: 'Draws on the source', sourceIds: ['book'] } as Draft],
    practices: [],
  });
  assert.deepEqual(rows.map(row => row.kind), ['position', 'inquiry', 'work', 'concept']);
});

test('stopping a session freezes its duration and keeps its chapter and preparation', () => {
  const session = {
    id: 'session', status: 'paused' as const, startedAt: '2026-11-20T15:00:00Z',
    pauseStartedAt: '2026-11-20T15:12:00Z', totalPausedSeconds: 120, section: 'Chapter 3', intent: 'Look for a counterexample.',
  };
  const stopped = stopSourceSession(session, new Date('2026-11-20T15:20:00Z'));
  assert.equal(stopped.durationSeconds, 600);
  assert.equal(stopped.status, 'completed');
  assert.equal(sourceSessionExcerpt({ ...stopped, notes: 'The example only holds in groups.' }), 'Source session (Chapter 3): Preparation: Look for a counterexample. | Reflection: The example only holds in groups.');
});

test('session answers become labeled AI context alongside older notes, with empty answers omitted', () => {
  assert.equal(sourceSessionExcerpt({
    id: 'chapter-2',
    section: 'Chapter 2',
    reflection: { takeaway: ' Attention takes practice. ', effect: ' ', openQuestion: 'What would count as progress?' },
    notes: 'Original note.',
  }), 'Source session (Chapter 2): Takeaway: Attention takes practice. | Open question: What would count as progress? | Reflection: Original note.');
});

test('source context keeps the four most recent sessions that have something recorded', () => {
  const sessions = [2, 5, 1, 4, 6, 3].map(day => ({
    id: String(day),
    endedAt: `2026-11-0${day}`,
    reflection: day === 6 ? {} : { takeaway: `Day ${day}` },
  }));
  assert.deepEqual(recentSourceSessionExcerpts(sessions), [5, 4, 3, 2].map(day => `Source session (whole source): Takeaway: Day ${day}`));
});
