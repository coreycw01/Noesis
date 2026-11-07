import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAutomaticGoalProgress, deriveGoalProgress, questKindForGoal, type GoalProgressContext } from '../../src/lib/goal-progress';
import type { Concept, Draft, GoalItem, Media, Practice, Question, VaultEntry } from '../../src/lib/types';

function goal(overrides: Partial<GoalItem> = {}): GoalItem {
  return {
    id: 'goal-1',
    title: 'Focused progress',
    typeId: 'type-1',
    currentProgress: 0,
    targetProgress: 10,
    sortOrder: 0,
    status: 'active',
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    ...overrides,
  };
}

const concepts = [{ id: 'concept-identity', name: 'Identity', aliases: ['Selfhood'] }] as Concept[];
const sources = [
  { id: 'book-identity', type: 'book', status: 'Finished', tags: ['Identity'], capture: { sessions: [] } },
  { id: 'article-identity', type: 'article', status: 'Finished', tags: ['Identity'], capture: { sessions: [] } },
  { id: 'book-truth', type: 'book', status: 'Finished', tags: ['Truth'], capture: { sessions: [] } },
] as unknown as Media[];
const inquiries = [
  { id: 'inquiry-identity', status: 'resolved', answer: 'Identity follows repeated action.', conceptIds: ['concept-identity'] },
  { id: 'inquiry-other', status: 'resolved', answer: 'Another answer.', conceptIds: [] },
] as Question[];
const positions = [
  { id: 'position-identity', status: 'revised', confidence: 100, tags: ['Identity'], versionHistory: [{ eventType: 'revised' }] },
  { id: 'position-other', status: 'active', confidence: 100, tags: ['Truth'], versionHistory: [] },
] as VaultEntry[];
const practices = [
  { id: 'practice-identity', status: 'active', conceptTags: ['Identity'], positionIds: ['position-identity'], logDates: ['2026-10-01', '2026-10-02', '2026-10-03'] },
  { id: 'practice-other', status: 'completed', conceptTags: ['Truth'], positionIds: [] },
] as Practice[];
const works = [
  { id: 'work-identity', status: 'published', conceptTags: ['Identity'] },
  { id: 'work-other', status: 'published', conceptTags: ['Identity'] },
] as Draft[];

const context: GoalProgressContext = { concepts, sources, inquiries, positions, practices, works };

test('source commitments combine result, concept, and source-type refinements', () => {
  const item = goal({
    sourceMeasure: 'finished',
    sourceType: 'book',
    relatedObjectIds: { conceptIds: ['concept-identity'] },
  });
  assert.equal(deriveAutomaticGoalProgress(item, 'consumption', context), 1);
});

test('inquiry and position commitments honor their selected item focus', () => {
  assert.equal(deriveAutomaticGoalProgress(goal({
    inquiryMeasure: 'resolved',
    relatedObjectIds: { conceptIds: ['concept-identity'], inquiryIds: ['inquiry-identity'] },
  }), 'inquiry', context), 1);
  assert.equal(deriveAutomaticGoalProgress(goal({
    positionMeasure: 'confident',
    relatedObjectIds: { conceptIds: ['concept-identity'], positionIds: ['position-identity'] },
  }), 'position', context), 1);
});

test('practice commitments count matching log days and exclude unrelated practices', () => {
  assert.equal(deriveAutomaticGoalProgress(goal({
    practiceMeasure: 'logged_days',
    relatedObjectIds: { conceptIds: ['concept-identity'], practiceIds: ['practice-identity'] },
  }), 'practice', context), 3);
});

test('work commitments can be narrowed to one selected work', () => {
  assert.equal(deriveAutomaticGoalProgress(goal({
    workMeasure: 'published',
    relatedObjectIds: { conceptIds: ['concept-identity'], workIds: ['work-identity'] },
  }), 'expression', context), 1);
});

test('Home and commitment previews use the same refined progress instead of source totals', () => {
  const item = goal({ goalKind: 'inquiry', inquiryMeasure: 'resolved', relatedObjectIds: { inquiryIds: ['inquiry-identity'] } });
  const result = deriveGoalProgress(item, undefined, context, { book: 80 });
  assert.deepEqual(result, { currentProgress: 1, targetProgress: 10, percent: 10 });
  assert.equal(questKindForGoal({ title: 'Book target', goalKind: 'practice' }), 'practice');
});

test('shared progress preserves manual increments and unique completed check-ins without double counting', () => {
  const item = goal({ goalKind: 'inquiry', currentProgress: 4, commitmentCheckIns: [
    { id: 'a', date: '2026-11-05', status: 'completed' },
    { id: 'b', date: '2026-11-05', status: 'completed' },
    { id: 'c', date: '2026-11-06', status: 'skipped' },
  ] });
  assert.equal(deriveGoalProgress(item, undefined, context).currentProgress, 4);
  assert.equal(deriveGoalProgress({ ...item, currentProgress: 0 }, undefined, { ...context, inquiries: [] }).currentProgress, 1);
});
