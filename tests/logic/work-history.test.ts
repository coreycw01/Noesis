import assert from 'node:assert/strict';
import test from 'node:test';
import type { Draft } from '../../src/lib/types';
import { workHistorySnapshot } from '../../src/lib/thinkingEvents/work-history';

test('Work history summarizes revisions without copying prose, tools, or AI review text', () => {
  const work: Partial<Draft> = {
    title: 'Working notes', status: 'drafting', type: 'text_note', revision: 4,
    body: 'private prose',
    documentPages: [{ id: 'p2', title: 'Page 2', content: 'more prose' }],
    aiReviewHistory: [{ id: 'review', title: 'Review', action: 'review_selected_context', content: 'private analysis', date: '2026-11-13' }],
  };
  const snapshot = workHistorySnapshot(work);
  assert.deepEqual(snapshot, { title: 'Working notes', status: 'drafting', type: 'text_note', revision: 4, pageCount: 2, contentLength: 23 });
  assert.doesNotMatch(JSON.stringify(snapshot), /private|more prose|aiReviewHistory/);
  assert.equal(workHistorySnapshot(undefined), null);
});
