import type {
  CognitiveBenchmarkCase,
  CognitiveBenchmarkEvidenceAnchor,
} from '../../src/lib/cognitive-architecture';

const STOP_WORDS = new Set([
  'a', 'about', 'and', 'are', 'as', 'at', 'be', 'did', 'do', 'does', 'everything',
  'find', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
  'show', 'that', 'the', 'these', 'this', 'to', 'was', 'what', 'when', 'which',
]);

function terms(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 1 && !STOP_WORDS.has(term)) || [];
}

function isEligible(
  anchor: CognitiveBenchmarkEvidenceAnchor,
  benchmarkCase: CognitiveBenchmarkCase,
  mode: 'local' | 'external_bundle',
) {
  if (anchor.invalidationState !== 'valid') return false;
  if (anchor.authority === 'rejected' || anchor.authority === 'stale') return false;
  if (anchor.authority === 'superseded' && benchmarkCase.queryClass !== 'temporal_update' && benchmarkCase.retrievalCompleteness?.mode !== 'all_matching') return false;
  if (mode === 'external_bundle' && anchor.privacyPolicy === 'local_only') return false;
  return true;
}

function lexicalScore(query: string, anchor: CognitiveBenchmarkEvidenceAnchor) {
  const queryTerms = terms(query);
  const documentTerms = new Set(terms(`${anchor.excerpt} ${anchor.entityId} ${anchor.speaker}`));
  const matched = queryTerms.filter((term) => documentTerms.has(term));
  if (!matched.length) return 0;
  const coverage = matched.length / Math.max(queryTerms.length, 1);
  const density = matched.length / Math.max(documentTerms.size, 1);
  return coverage * 0.85 + density * 0.15;
}

export interface LexicalBaselineCaseResult {
  caseId: string;
  selectedAnchorIds: string[];
  requiredRecall: number;
  completenessRecall?: number;
  excludedEvidenceViolations: string[];
  evidenceCount: number;
  latencyMs: number;
  budgetExceeded: boolean;
}

export function runLexicalBaselineCase(
  benchmarkCase: CognitiveBenchmarkCase,
  anchors: CognitiveBenchmarkEvidenceAnchor[],
  mode: 'local' | 'external_bundle' = 'local',
): LexicalBaselineCaseResult {
  const startedAt = performance.now();
  const selected = anchors
    .filter((anchor) => isEligible(anchor, benchmarkCase, mode))
    .map((anchor) => ({ anchor, score: lexicalScore(benchmarkCase.query, anchor) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.anchor.id.localeCompare(right.anchor.id))
    .slice(0, benchmarkCase.budget.maxEvidenceAnchors)
    .map((candidate) => candidate.anchor);
  const selectedAnchorIds = selected.map((anchor) => anchor.id);
  const selectedIds = new Set(selectedAnchorIds);
  const requiredHits = benchmarkCase.requiredEvidenceAnchorIds.filter((anchorId) => selectedIds.has(anchorId)).length;
  const requiredRecall = benchmarkCase.requiredEvidenceAnchorIds.length
    ? requiredHits / benchmarkCase.requiredEvidenceAnchorIds.length
    : 1;
  const completenessExpected = benchmarkCase.retrievalCompleteness?.expectedAnchorIds || [];
  const completenessRecall = completenessExpected.length
    ? completenessExpected.filter((anchorId) => selectedIds.has(anchorId)).length / completenessExpected.length
    : undefined;
  const latencyMs = performance.now() - startedAt;

  return {
    caseId: benchmarkCase.id,
    selectedAnchorIds,
    requiredRecall,
    completenessRecall,
    excludedEvidenceViolations: benchmarkCase.mustExcludeEvidenceAnchorIds.filter((anchorId) => selectedIds.has(anchorId)),
    evidenceCount: selected.length,
    latencyMs,
    budgetExceeded: selected.length > benchmarkCase.budget.maxEvidenceAnchors || latencyMs > benchmarkCase.budget.maxLatencyMs,
  };
}

export function summarizeLexicalBaseline(results: LexicalBaselineCaseResult[]) {
  const answerable = results.filter((result) => result.caseId && result.requiredRecall <= 1);
  const completeness = results.filter((result) => result.completenessRecall != null);
  return {
    caseCount: results.length,
    averageRequiredRecall: answerable.reduce((sum, result) => sum + result.requiredRecall, 0) / Math.max(answerable.length, 1),
    averageCompletenessRecall: completeness.reduce((sum, result) => sum + (result.completenessRecall || 0), 0) / Math.max(completeness.length, 1),
    exclusionViolationCount: results.reduce((sum, result) => sum + result.excludedEvidenceViolations.length, 0),
    budgetViolationCount: results.filter((result) => result.budgetExceeded).length,
    averageEvidenceCount: results.reduce((sum, result) => sum + result.evidenceCount, 0) / Math.max(results.length, 1),
    maximumLatencyMs: Math.max(0, ...results.map((result) => result.latencyMs)),
  };
}
