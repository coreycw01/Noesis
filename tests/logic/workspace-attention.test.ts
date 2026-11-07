import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { allAnnotations } from '../../src/lib/readex';
import { deriveWorkspaceAttention } from '../../src/lib/workspace-attention';

const fixture = buildDemoWorkspace('attention-test');
const position = { ...fixture.vault[0], id: 'shared-id', status: 'active' as const, evidenceFor: [], sourceIds: [] };
const inquiry = { ...fixture.questions[0], id: 'shared-id', status: 'open' as const, answer: '' };
const empty = { annotations: [], positions: [], inquiries: [], practices: [] };

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

test('an abandoned practice does not count as a live test of a position', () => {
  const practice = { ...fixture.practices[0], positionIds: [position.id] };
  assert.equal(deriveWorkspaceAttention({ ...empty, positions: [position], practices: [{ ...practice, status: 'abandoned' }] }).metrics.positionsWithoutPractice, 1);
  assert.equal(deriveWorkspaceAttention({ ...empty, positions: [position], practices: [{ ...practice, status: 'completed' }] }).metrics.positionsWithoutPractice, 0);
});
