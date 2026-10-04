import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runLexicalBaselineCase,
  summarizeLexicalBaseline,
} from '../helpers/cognitive-retrieval-baseline';
import {
  COGNITIVE_BENCHMARK_ANCHORS,
  COGNITIVE_BENCHMARK_CASES,
} from '../fixtures/cognitive-benchmark';

test('lexical baseline evaluates every benchmark case without violating evidence budgets', () => {
  const results = COGNITIVE_BENCHMARK_CASES.map((benchmarkCase) =>
    runLexicalBaselineCase(benchmarkCase, COGNITIVE_BENCHMARK_ANCHORS),
  );
  const summary = summarizeLexicalBaseline(results);

  assert.equal(summary.caseCount, 60);
  assert.equal(summary.exclusionViolationCount, 0);
  assert.equal(summary.budgetViolationCount, 0);
  assert.ok(summary.averageRequiredRecall >= 0 && summary.averageRequiredRecall <= 1);
  assert.ok(summary.averageCompletenessRecall >= 0 && summary.averageCompletenessRecall <= 1);
});

test('external evidence bundles exclude local-only, deleted, rejected, and stale evidence', () => {
  const privacyCase = COGNITIVE_BENCHMARK_CASES.find((benchmarkCase) => benchmarkCase.securityScenario === 'local_only');
  assert.ok(privacyCase);
  const result = runLexicalBaselineCase(privacyCase, COGNITIVE_BENCHMARK_ANCHORS, 'external_bundle');

  assert.ok(!result.selectedAnchorIds.includes('a-local-only-note'));
  assert.ok(!result.selectedAnchorIds.includes('a-deleted-source'));
  assert.ok(!result.selectedAnchorIds.includes('a-ai-rejected'));
  assert.ok(!result.selectedAnchorIds.includes('a-ai-stale'));
});

test('local exact retrieval may find local-only evidence without granting it external processing', () => {
  const syntheticCase = {
    ...COGNITIVE_BENCHMARK_CASES[0],
    id: 'local-only-exact-check',
    query: 'private reflection local exact search',
    requiredEvidenceAnchorIds: ['a-local-only-note'],
    mustExcludeEvidenceAnchorIds: [],
    retrievalCompleteness: undefined,
  };
  const local = runLexicalBaselineCase(syntheticCase, COGNITIVE_BENCHMARK_ANCHORS, 'local');
  const external = runLexicalBaselineCase(syntheticCase, COGNITIVE_BENCHMARK_ANCHORS, 'external_bundle');

  assert.ok(local.selectedAnchorIds.includes('a-local-only-note'));
  assert.ok(!external.selectedAnchorIds.includes('a-local-only-note'));
});
