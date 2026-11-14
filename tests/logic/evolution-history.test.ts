import assert from 'node:assert/strict';
import test from 'node:test';
import { evolutionDateMatches, evolutionDisplayDate, evolutionSynthesisExcerpt, evolutionSynthesisReviewKey, evolutionSynthesisSourceIds, evolutionValueChange, indexEvolutionSources, isEvolutionDateOnly, isEvolutionTurningPoint, normalizeEvolutionDate, readEvolutionSynthesis, unmatchedEvolutionMilestones } from '../../src/lib/evolution-history';
import type { ThinkingEvent, TimelineEvent } from '../../src/lib/types';
import { olderEvolutionHistoryMayMatch } from '../../src/lib/evolution-history';

test('Evolution only warns about missing older history when it could match the range', () => {
  const history = [
    { createdAt: new Date(2026, 10, 15, 12).toISOString() },
    { createdAt: new Date(2026, 10, 10, 12).toISOString() },
  ];
  assert.equal(olderEvolutionHistoryMayMatch(true, '2026-11-11', history), false);
  assert.equal(olderEvolutionHistoryMayMatch(true, '2026-11-10', history), true);
  assert.equal(olderEvolutionHistoryMayMatch(true, '', history), true);
  assert.equal(olderEvolutionHistoryMayMatch(true, '2026-11-11', []), true);
  assert.equal(olderEvolutionHistoryMayMatch(false, '', history), false);
});

test('Evolution source lookup preserves Library order and skips duplicate or missing links', () => {
  const sources = [{ id: 's1', title: 'First' }, { id: 's2', title: 'Second' }, { id: 's3', title: 'Unlinked' }];
  const lookup = indexEvolutionSources(sources);
  assert.deepEqual(lookup(['s2', 'deleted', 's1', 's2']), sources.slice(0, 2));
  assert.deepEqual(lookup(), []);
});

test('period review identity tracks evidence independently of the provider excerpt', () => {
  const event = { id: 'event-a', targetType: 'position', targetId: 'p1', date: '2026-11-13', title: 'Position revised', sourceIds: ['source-a'] };
  const sameText = { ...event, id: 'event-b' };
  const changedSource = { ...event, sourceIds: ['source-b'] };
  assert.equal(evolutionSynthesisExcerpt(event), evolutionSynthesisExcerpt(sameText));
  assert.equal(evolutionSynthesisExcerpt(event), evolutionSynthesisExcerpt(changedSource));
  assert.notEqual(evolutionSynthesisReviewKey([event]), evolutionSynthesisReviewKey([sameText]));
  assert.notEqual(evolutionSynthesisReviewKey([event]), evolutionSynthesisReviewKey([changedSource]));
  assert.equal(evolutionSynthesisReviewKey([event]), evolutionSynthesisReviewKey([{ ...event }]));
});

test('canonical events replace matching legacy milestones without hiding other changes', () => {
  const first: TimelineEvent = { id: 'legacy', entityId: 'p1', entityType: 'vault', entityTitle: 'A position', eventType: 'revised', reason: 'Evidence changed.', date: '2026-01-02T12:00:00Z' };
  const history: ThinkingEvent[] = [{
    id: 'canonical', entityId: 'p1', entityType: 'position', eventType: 'position_revised',
    userId: 'owner', summary: 'Recorded revision', origin: 'user', createdAt: first.date,
  } as ThinkingEvent];
  const earlier = { ...first, id: 'earlier', date: '2026-01-01T12:00:00Z' };
  const anotherObject = { ...first, id: 'another', entityId: 'p2' };
  const anotherAction = { ...first, id: 'another-action', eventType: 'abandoned' as const };
  assert.deepEqual(unmatchedEvolutionMilestones([first, earlier, anotherObject, anotherAction], history), [earlier, anotherObject, anotherAction]);
});

test('Evolution synthesis excerpts retain measured changes and omit raw event metadata', () => {
  const event = {
    date: '2026-11-13', title: 'Revised a position', targetType: 'position', action: 'confidence changed',
    beforeLabel: 'Confidence: 86%', afterLabel: 'Confidence: 62%', trigger: 'New contradictory evidence',
    actor: 'user', detail: 'raw metadata should not be sent', significance: 'Changed fields: confidence',
  };
  const result = evolutionSynthesisExcerpt(event);
  for (const item of ['Confidence: 86%', 'Confidence: 62%', 'actor: user', 'New contradictory evidence']) assert.ok(result.includes(item));
  assert.ok(!result.includes(event.detail));
});

test('reads an accepted period synthesis from the canonical event, including older writes', () => {
  const snapshot = { id: 'review', entityType: 'evolution', entityTitle: 'Period synthesis: March', reason: 'Reviewed text', date: '2026-03-10' };
  const event = { entityType: 'evolution', eventType: 'synthesized', after: { legacyTimelineEvent: snapshot } } as const;
  assert.deepEqual(readEvolutionSynthesis(event), snapshot);
  assert.equal(readEvolutionSynthesis({ ...event, entityType: 'atlasMap' }), null);
  assert.equal(readEvolutionSynthesis({ ...event, after: { legacyTimelineEvent: { ...snapshot, reason: '' } } }), null);
  const referenced = { ...snapshot, reason: '', synthesisProvenance: { provenanceId: snapshot.id, kind: 'ai-assisted' } };
  assert.deepEqual(readEvolutionSynthesis({ ...event, after: { legacyTimelineEvent: referenced } }), referenced);
});

test('compares the changed field rather than repeating an unchanged title', () => {
  const event = { before: { title: 'Same', status: 'draft' }, after: { title: 'Same', status: 'revised' } };
  assert.deepEqual(evolutionValueChange(event), { beforeLabel: 'draft', afterLabel: 'revised' });
  assert.deepEqual(evolutionValueChange({ ...event, confidenceBefore: 0, confidenceAfter: 12 }), {
    beforeLabel: 'Confidence: 0%', afterLabel: 'Confidence: 12%',
  });
});

test('date windows include the full final local day and respect date-only records', () => {
  assert.equal(evolutionDateMatches('2026-11-13T23:59:59.999', '2026-11-13', '2026-11-13'), true);
  assert.equal(evolutionDateMatches('2026-11-13', '2026-11-13', '2026-11-13'), true);
  assert.equal(evolutionDateMatches('2026-11-14T00:00:00', '', '2026-11-13'), false);
  assert.equal(evolutionDateMatches('invalid', '', ''), false);
});

test('Evolution preserves calendar precision while retaining actual timestamps', () => {
  const day = '2026-11-01';
  const normalized = normalizeEvolutionDate(day);
  assert.equal(normalized, day);
  assert.ok(normalized && isEvolutionDateOnly(normalized));
  assert.equal(evolutionDisplayDate(day).getDate(), 1);
  assert.equal(evolutionDisplayDate(day).getMonth(), 10);
  assert.equal(normalizeEvolutionDate('2026-02-30'), null);
  const timestamp = '2026-11-01T04:05:06.000Z';
  assert.equal(normalizeEvolutionDate({ toDate: () => new Date(timestamp) }), timestamp);
  assert.equal(isEvolutionDateOnly(timestamp), false);
});

test('turning points require a consequential action or a substantial measured confidence change', () => {
  for (const type of ['position_revised', 'Position abandoned', 'position_replaced', 'contradiction_resolved', 'question_resolved']) {
    assert.equal(isEvolutionTurningPoint(type), true);
  }
  for (const type of ['created', 'edited', 'challenge_added', 'practice_logged', 'synthesized']) {
    assert.equal(isEvolutionTurningPoint(type), false);
  }
  assert.equal(isEvolutionTurningPoint('confidence_changed', 75, 80), false);
  assert.equal(isEvolutionTurningPoint('confidence_changed', null, 90), false);
  assert.equal(isEvolutionTurningPoint('confidence_changed', 85, 70), true);
});

test('period synthesis links only deduplicated source IDs from its sampled events', () => {
  assert.deepEqual(evolutionSynthesisSourceIds([
    { targetType: 'position', targetId: 'position-a', sourceIds: ['book-a'] },
    { targetType: 'source', targetId: 'book-a' },
    { targetType: 'inquiry', targetId: 'inquiry-a' },
    { targetType: 'media', targetId: 'film-b' },
  ]), ['book-a', 'film-b']);
  assert.equal(evolutionSynthesisSourceIds([{ targetType: 'position', targetId: 'p', sourceIds: Array.from({ length: 24 }, (_, i) => `s${i}`) }]).length, 20);
});
