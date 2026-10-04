import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASK_NOESIS_QUERY_CLASSES,
  COGNITIVE_ARCHITECTURE_INVARIANTS,
  validateCognitiveBenchmark,
} from '../../src/lib/cognitive-architecture';
import {
  COGNITIVE_BENCHMARK_ANCHORS,
  COGNITIVE_BENCHMARK_CASES,
  COGNITIVE_BENCHMARK_RELATIONS,
} from '../fixtures/cognitive-benchmark';

const expectedCounts = {
  exact_retrieval: 10,
  current_view_synthesis: 10,
  temporal_update: 10,
  relationship: 8,
  contradiction_tension: 8,
  gap_adversarial: 6,
  deterministic_analytics: 4,
  insufficient_evidence: 4,
} as const;

test('Stage 0 locks the minimum architecture invariants', () => {
  assert.equal(COGNITIVE_ARCHITECTURE_INVARIANTS.length, 8);
  assert.ok(COGNITIVE_ARCHITECTURE_INVARIANTS.includes('ask-noesis-is-read-only-until-explicit-promotion'));
  assert.ok(COGNITIVE_ARCHITECTURE_INVARIANTS.includes('retrieved-content-never-receives-write-authority'));
});

test('benchmark contains the required 60 query cases by class', () => {
  assert.equal(COGNITIVE_BENCHMARK_CASES.length, 60);
  ASK_NOESIS_QUERY_CLASSES.forEach((queryClass) => {
    assert.equal(
      COGNITIVE_BENCHMARK_CASES.filter((benchmarkCase) => benchmarkCase.queryClass === queryClass).length,
      expectedCounts[queryClass],
      `Unexpected case count for ${queryClass}`,
    );
  });
});

test('benchmark cases are internally complete and reference exact fixture anchors', () => {
  assert.deepEqual(validateCognitiveBenchmark(
    COGNITIVE_BENCHMARK_CASES,
    COGNITIVE_BENCHMARK_ANCHORS,
    COGNITIVE_BENCHMARK_RELATIONS,
  ), []);
});

test('abstention and authorship confusion are explicit regression requirements', () => {
  const abstentionCases = COGNITIVE_BENCHMARK_CASES.filter((benchmarkCase) => benchmarkCase.abstentionRequired);
  assert.equal(abstentionCases.length, 4);
  assert.ok(COGNITIVE_BENCHMARK_CASES.some((benchmarkCase) =>
    benchmarkCase.forbiddenConclusions.some((conclusion) => conclusion.includes('source claim to the user')),
  ));
  assert.ok(COGNITIVE_BENCHMARK_CASES.some((benchmarkCase) =>
    benchmarkCase.acceptableAnswerBoundaries.some((boundary) => boundary.includes('temporal replacement')),
  ));
});

test('benchmark separates authorship, authority, temporal status, and privacy', () => {
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.authorship === 'ai' && anchor.authority === 'proposed'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.authorship === 'ai' && anchor.authority === 'accepted'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.authority === 'rejected'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.authority === 'stale'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.authority === 'superseded'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.some((anchor) => anchor.privacyPolicy === 'local_only'));
  assert.ok(COGNITIVE_BENCHMARK_ANCHORS.every((anchor) => anchor.contentHash && anchor.revisionId && anchor.speaker));
});

test('benchmark covers correction, privacy, injection, deletion, stale data, completeness, and budgets', () => {
  const scenarios = new Set(COGNITIVE_BENCHMARK_CASES.map((benchmarkCase) => benchmarkCase.securityScenario).filter(Boolean));
  assert.deepEqual(scenarios, new Set(['correction_recurrence', 'prompt_injection', 'stale_index', 'local_only', 'deletion']));
  assert.ok(COGNITIVE_BENCHMARK_CASES.some((benchmarkCase) => benchmarkCase.retrievalCompleteness?.mode === 'all_matching'));
  assert.ok(COGNITIVE_BENCHMARK_CASES.every((benchmarkCase) => benchmarkCase.budget.maxLatencyMs > 0));
  assert.ok(COGNITIVE_BENCHMARK_CASES.every((benchmarkCase) => benchmarkCase.budget.maxEvidenceAnchors > 0));
  assert.ok(COGNITIVE_BENCHMARK_RELATIONS.some((relation) => relation.authority === 'canonical'));
  assert.ok(COGNITIVE_BENCHMARK_RELATIONS.some((relation) => relation.authority === 'candidate'));
  assert.ok(COGNITIVE_BENCHMARK_RELATIONS.some((relation) => relation.authority === 'semantic_only'));
});
