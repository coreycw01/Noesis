import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { allAnnotations } from '../../src/lib/readex';
import { deriveWorkspaceAttention } from '../../src/lib/workspace-attention';
import { isLivePosition } from '../../src/lib/position-state';

const fixture = buildDemoWorkspace('attention-test');
const position = { ...fixture.vault[0], id: 'shared-id', status: 'active' as const, evidenceFor: [], sourceIds: [] };
const inquiry = { ...fixture.questions[0], id: 'shared-id', status: 'open' as const, answer: '' };
const empty = { annotations: [], positions: [], inquiries: [], practices: [] };

test('Today practice reminders follow the local day without requiring a record update', () => {
  const practice = {
    ...fixture.practices[0], status: 'active' as const, intellectualBasis: 'Observe attention.',
    hypothesis: 'A pause helps.', action: 'Pause once.', observationMethod: 'Write a line.',
    expectedOutcome: 'Name the distraction.', startDate: '2026-11-14', endDate: '2026-11-15',
    logs: [], logDates: ['2026-11-14'],
  };
  const input = { ...empty, practices: [practice] };
  assert.deepEqual(deriveWorkspaceAttention({ ...input, now: new Date(2026, 10, 14, 23, 59) }).practicesNeedingLogs, []);
  assert.deepEqual(deriveWorkspaceAttention({ ...input, now: new Date(2026, 10, 15, 0, 1) }).practicesNeedingLogs, [practice]);
  assert.deepEqual(deriveWorkspaceAttention({ ...input, now: new Date(2026, 10, 16, 0, 1) }).practicesNeedingLogs, []);
});

test('attention counts distinct records while preserving overlapping category totals', () => {
  const result = deriveWorkspaceAttention({ ...empty, positions: [position, position], inquiries: [inquiry, inquiry] });
  assert.equal(result.metrics.unsupportedPositions, 1);
  assert.equal(result.metrics.positionsWithoutPractice, 1);
  assert.equal(result.metrics.openInquiries, 1);
  assert.equal(result.metrics.uniqueTotal, 2);
});

test('closed positions and inactive inquiries do not repeatedly request attention', () => {
  const positions = ['abandoned', 'rejected', 'replaced', 'suspended'].map((status) => ({ ...position, id: status, status })) as typeof position[];
  const inquiries = ['answered', 'resolved', 'archived', 'suspended', 'converted', 'no_longer_meaningful'].map((status) => ({ ...inquiry, id: status, status })) as typeof inquiry[];
  assert.equal(deriveWorkspaceAttention({ ...empty, positions, inquiries }).metrics.uniqueTotal, 0);
});

test('the Profile and Attention position rule includes revised claims but excludes suspended or replaced ones', () => {
  const revised = { ...position, status: 'revised' as const };
  const candidates = [revised, { ...position, status: 'suspended' as const }, { ...position, status: 'replaced' as const }];
  assert.deepEqual(candidates.filter(isLivePosition), [revised]);
});

test('a saved provisional answer remains in active inquiry attention', () => {
  const provisional = { ...inquiry, status: 'provisionally_answered' as const, answer: 'A working answer.' };
  const result = deriveWorkspaceAttention({ ...empty, inquiries: [provisional] });
  assert.deepEqual(result.openInquiries, [provisional]);
  assert.equal(result.metrics.openInquiries, 1);
});

test('written purpose or linked inquiry anchors a practice without requiring a position', () => {
  const practice = { ...fixture.practices[0], status: 'planned' as const, positionIds: [], questionIds: [], sourceIds: [], conceptTags: ['Unsorted Ideas'], intellectualBasis: '' };
  assert.equal(deriveWorkspaceAttention({ ...empty, practices: [practice] }).metrics.unanchoredPractices, 1);
  assert.equal(deriveWorkspaceAttention({ ...empty, practices: [{ ...practice, intellectualBasis: 'Protect deliberate attention.' }] }).metrics.unanchoredPractices, 0);
  assert.equal(deriveWorkspaceAttention({ ...empty, practices: [{ ...practice, questionIds: ['q1'] }] }).metrics.unanchoredPractices, 0);
  assert.equal(deriveWorkspaceAttention({ ...empty, practices: [{ ...practice, status: 'abandoned' }] }).metrics.unanchoredPractices, 0);
});

test('a promoted annotation is not still in the raw processing queue', () => {
  const annotation = { ...allAnnotations(fixture.media)[0], philosophyStatus: 'raw' as const };
  assert.equal(deriveWorkspaceAttention({ ...empty, annotations: [annotation] }).metrics.rawAnnotations, 1);
  assert.equal(deriveWorkspaceAttention({ ...empty, annotations: [{ ...annotation, createdInquiryId: 'q1' }] }).metrics.rawAnnotations, 0);
});

test('raw annotations are deduplicated within a source, not across sources', () => {
  const annotation = { ...allAnnotations(fixture.media)[0], philosophyStatus: 'raw' as const, createdInquiryId: undefined, createdPositionId: undefined };
  const other = { ...annotation, source: { ...annotation.source, id: 'another-source' } };
  const result = deriveWorkspaceAttention({ ...empty, annotations: [annotation, annotation, other] });
  assert.deepEqual(result.rawAnnotations, [annotation, other]);
  assert.equal(result.metrics.uniqueTotal, 2);
});

test('an abandoned practice does not count as a live test of a position', () => {
  const practice = { ...fixture.practices[0], positionIds: [position.id] };
  assert.equal(deriveWorkspaceAttention({ ...empty, positions: [position], practices: [{ ...practice, status: 'abandoned' }] }).metrics.positionsWithoutPractice, 1);
  assert.equal(deriveWorkspaceAttention({ ...empty, positions: [position], practices: [{ ...practice, status: 'completed' }] }).metrics.positionsWithoutPractice, 0);
});

test('one practice can cover multiple positions; repeated or unknown links do not alter totals', () => {
  const second = { ...position, id: 'second' };
  const third = { ...position, id: 'third' };
  const practice = { ...fixture.practices[0], status: 'completed' as const, positionIds: [position.id, second.id, position.id, 'missing'] };
  const result = deriveWorkspaceAttention({ ...empty, positions: [position, second, third], practices: [practice] });
  assert.deepEqual(result.untestedPositions, [third]);
  assert.equal(result.metrics.positionsWithoutPractice, 1);
  assert.equal(result.metrics.uniqueTotal, 3);
});
