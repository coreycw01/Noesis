import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAutomaticGoalProgress, deriveGoalProgress, goalCategories, goalCategoryChange, goalItems, questKindForGoal, type GoalProgressContext } from '../../src/lib/goal-progress';
import { commitmentPositionFocusPatch, commitmentPositionIds, withCommitmentCheckIn } from '../../src/lib/commitments';
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

test('switching goal kind clears hidden count filters but preserves concept focus and legacy grounding', () => {
  const position = goal({ goalKind: 'position', positionMeasure: 'revised',
    relatedObjectIds: { positionIds: ['position-identity'], conceptIds: ['concept-identity'] } });
  const category = { id: 'practice-category', name: 'Practice Completion', sortOrder: 0,
    createdAt: position.createdAt, updatedAt: position.updatedAt };
  const changed = { ...position, ...goalCategoryChange(position, undefined, category) };
  assert.equal(changed.goalKind, 'practice');
  assert.equal(changed.positionMeasure, undefined);
  assert.deepEqual(changed.relatedObjectIds, { conceptIds: ['concept-identity'] });
  assert.deepEqual(commitmentPositionIds(changed), ['position-identity']);
  const completed = { ...context, practices: [{ ...practices[0], status: 'completed' as const, positionIds: [] }] };
  assert.equal(deriveGoalProgress(changed, category, completed).currentProgress, 1);
  assert.deepEqual(goalCategoryChange(changed, category, category), {});
});

test('automatic goals count matching records once by ID, not by title or number of copies', () => {
  const duplicate = <T,>(items: T[]) => [...items, ...items.map((item) => ({ ...item }))];
  const scoped = { ...context, sources: duplicate(sources), inquiries: duplicate(inquiries),
    positions: duplicate(positions), practices: duplicate(practices),
    works: duplicate(works.map((work) => ({ ...work, title: 'Same title' }))) };
  assert.equal(deriveAutomaticGoalProgress(goal(), 'consumption', scoped), 3);
  assert.equal(deriveAutomaticGoalProgress(goal({ inquiryMeasure: 'resolved' }), 'inquiry', scoped), 2);
  assert.equal(deriveAutomaticGoalProgress(goal({ positionMeasure: 'revised' }), 'position', scoped), 1);
  assert.equal(deriveAutomaticGoalProgress(goal(), 'practice', scoped), 1);
  assert.equal(deriveAutomaticGoalProgress(goal({ workMeasure: 'published' }), 'expression', scoped), 2);
});

test('confidence goals exclude dormant claims without erasing recorded reviews or revisions', () => {
  const retired = (['abandoned', 'rejected', 'replaced', 'suspended'] as const)
    .map((status) => ({ ...positions[0], id: status, status, lastChallengedAt: '2026-10-01' }));
  const scoped = { ...context, positions: [positions[0], ...retired] };
  assert.equal(deriveAutomaticGoalProgress(goal({ positionMeasure: 'confident' }), 'position', scoped), 1);
  assert.equal(deriveAutomaticGoalProgress(goal({ positionMeasure: 'reviewed' }), 'position', scoped), 5);
  assert.equal(deriveAutomaticGoalProgress(goal({ positionMeasure: 'revised' }), 'position', scoped), 5);
});

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

test('commitment grounding and position progress focus can change independently', () => {
  const legacy = goal({ goalKind: 'position', positionMeasure: 'confident', relatedObjectIds: { positionIds: ['position-identity'] } });
  assert.deepEqual(commitmentPositionIds(legacy), ['position-identity']);
  assert.equal(deriveGoalProgress(legacy, undefined, context).currentProgress, 1);
  const broadened = { ...legacy, ...commitmentPositionFocusPatch(legacy, null) };
  assert.deepEqual(commitmentPositionIds(broadened), ['position-identity']);
  assert.equal(deriveGoalProgress(broadened, undefined, context).currentProgress, 2);
  const ungrounded = { ...legacy, commitmentPositionId: null };
  assert.deepEqual(commitmentPositionIds(ungrounded), []);
  assert.equal(deriveGoalProgress(ungrounded, undefined, context).currentProgress, 1);
  const reselected = { ...ungrounded, ...commitmentPositionFocusPatch(ungrounded, 'position-other') };
  assert.deepEqual(commitmentPositionIds(reselected), []);
  assert.deepEqual(reselected.relatedObjectIds?.positionIds, ['position-other']);
});

test('active, answered and resolved inquiry goals count distinct recorded states', () => {
  const inquiryContext = { ...context, inquiries: [
    { ...inquiries[0], id: 'open', status: 'open', answer: '' },
    { ...inquiries[0], id: 'provisional', status: 'provisionally_answered' },
    { ...inquiries[0], id: 'converted', status: 'converted' },
    { ...inquiries[0], id: 'resolved', status: 'resolved' },
    { ...inquiries[0], id: 'no-answer', status: 'answered', answer: ' ' },
  ] as Question[] };
  assert.equal(deriveAutomaticGoalProgress(goal({ inquiryMeasure: 'active' }), 'inquiry', inquiryContext), 2);
  assert.equal(deriveAutomaticGoalProgress(goal({ inquiryMeasure: 'answered' }), 'inquiry', inquiryContext), 3);
  assert.equal(deriveAutomaticGoalProgress(goal({ inquiryMeasure: 'resolved' }), 'inquiry', inquiryContext), 1);
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

test('a missing concept cannot silently broaden a goal and stable ids survive renamed tags', () => {
  const focused = goal({ relatedObjectIds: { conceptIds: ['missing-concept'] } });
  for (const kind of ['consumption', 'inquiry', 'position', 'practice', 'expression'] as const) {
    assert.equal(deriveAutomaticGoalProgress(focused, kind, context), 0, kind);
  }
  const scoped = goal({ relatedObjectIds: { conceptIds: ['concept-identity'] } });
  assert.equal(deriveAutomaticGoalProgress(scoped, 'consumption', {
    ...context, sources: [
      { ...sources[0], conceptIds: ['concept-identity'], tags: ['Old name'] },
      { ...sources[1], conceptIds: ['another-concept'], tags: ['Identity'] },
    ],
  }), 1);
});

test('a longest streak belongs to one practice, while logged days count distinct dates across practices', () => {
  const split = { ...context, practices: [
    { ...practices[0], logDates: ['2026-10-01', '2026-10-03', '2026-02-30'] },
    { ...practices[1], logDates: ['2026-10-02', '2026-10-03'] },
  ] };
  assert.equal(deriveAutomaticGoalProgress(goal({ practiceMeasure: 'log_streak' }), 'practice', split), 2);
  assert.equal(deriveAutomaticGoalProgress(goal({ practiceMeasure: 'logged_days' }), 'practice', split), 3);
});

test('practice goals preserve the recorded calendar day in legacy timestamps', () => {
  const dated = { ...context, practices: [{
    ...practices[0],
    logDates: ['2026-10-02T00:01:00+14:00', '2026-10-02', '2026-10-03', '2026-02-30'],
    logs: [{ id: 'missed', date: '2026-10-04', actionCompleted: false }],
  }] };
  assert.equal(deriveAutomaticGoalProgress(goal({ practiceMeasure: 'logged_days' }), 'practice', dated), 2);
  assert.equal(deriveAutomaticGoalProgress(goal({ practiceMeasure: 'log_streak' }), 'practice', dated), 2);
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

test('a check-in never copies automatic progress into the stored manual count', () => {
  const item = goal({ goalKind: 'consumption', currentProgress: 1 });
  const checked = withCommitmentCheckIn(item, { id: 'done', date: '2026-11-05', status: 'completed' });
  assert.equal(checked.currentProgress, 1);
  assert.equal(deriveGoalProgress(checked, undefined, context).currentProgress, 3);
  const skipped = withCommitmentCheckIn(checked, { id: 'skip', date: '2026-11-05', status: 'skipped' });
  assert.deepEqual(skipped.commitmentCheckIns?.map(({ id }) => id), ['skip']);
  assert.equal(deriveGoalProgress(skipped, undefined, { ...context, sources: [] }).currentProgress, 1);
});

test('legacy source goals count their category and explicitly empty goals stay empty', () => {
  const settings = { label: 'Legacy', types: ['book' as const], targets: { book: 5 } };
  const categories = goalCategories(settings);
  const [bookGoal] = goalItems(settings, categories);
  assert.equal(deriveGoalProgress(bookGoal, categories[0], context).currentProgress, 2);
  assert.equal(deriveGoalProgress({ ...bookGoal, sourceType: 'article' }, categories[0], context).currentProgress, 1);
  assert.deepEqual(goalItems({ ...settings, goals: [] }, categories), []);
});
