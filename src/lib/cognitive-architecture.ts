export const ASK_NOESIS_QUERY_CLASSES = [
  'exact_retrieval',
  'current_view_synthesis',
  'temporal_update',
  'relationship',
  'contradiction_tension',
  'gap_adversarial',
  'deterministic_analytics',
  'insufficient_evidence',
] as const;

export type AskNoesisQueryClass = (typeof ASK_NOESIS_QUERY_CLASSES)[number];

export const EPISTEMIC_ATTRIBUTIONS = [
  'user_current',
  'user_historical',
  'source_author',
  'mixed',
  'not_applicable',
] as const;

export type EpistemicAttribution = (typeof EPISTEMIC_ATTRIBUTIONS)[number];

export type CognitiveAuthorship = 'user' | 'source_author' | 'ai' | 'system';
export type CognitiveAuthority = 'canonical' | 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'stale';
export type CognitiveTemporalStatus = 'current' | 'historical' | 'uncertain' | 'not_applicable';
export type CognitivePrivacyPolicy = 'external_ai_allowed' | 'local_only';
export type CognitiveInvalidationState = 'valid' | 'invalidated' | 'redacted' | 'deleted';
export type CognitiveRelationAuthority = 'canonical' | 'candidate' | 'semantic_only';

export type CognitiveEvidenceLocation =
  | {
      kind: 'text';
      fieldPath: string;
      blockId: string;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'media';
      fieldPath: string;
      locator: string;
      startSeconds?: number;
      endSeconds?: number;
    };

export interface CognitiveBenchmarkEvidenceAnchor {
  id: string;
  entityType: 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice' | 'thinking_event';
  entityId: string;
  revisionId: string;
  location: CognitiveEvidenceLocation;
  excerpt: string;
  speaker: string;
  authorship: CognitiveAuthorship;
  authority: CognitiveAuthority;
  temporalStatus: CognitiveTemporalStatus;
  contentHash: string;
  effectiveAt: string;
  recordedAt: string;
  current: boolean;
  privacyPolicy: CognitivePrivacyPolicy;
  invalidationState: CognitiveInvalidationState;
}

export interface CognitiveBenchmarkRelation {
  id: string;
  fromAnchorId: string;
  toAnchorId: string;
  type: 'supports' | 'challenges' | 'contradicts' | 'refines' | 'replaces' | 'tested_by' | 'related';
  authority: CognitiveRelationAuthority;
  evidenceAnchorIds: string[];
  reviewState: 'confirmed' | 'proposed' | 'rejected' | 'not_applicable';
}

export interface ExpectedAnswerClaim {
  id: string;
  statementBoundary: string;
  requiredCitationGroups: string[][];
  contraryEvidenceAnchorIds: string[];
}

export interface CognitiveBenchmarkBudget {
  maxEvidenceAnchors: number;
  maxLatencyMs: number;
  maxWeightedCostUnits: number;
  generationAllowed: boolean;
}

export interface CognitiveBenchmarkCase {
  id: string;
  queryClass: AskNoesisQueryClass;
  query: string;
  requiredEvidenceAnchorIds: string[];
  acceptableOptionalEvidenceAnchorIds: string[];
  expectedAttribution: EpistemicAttribution;
  expectedAnswerClaims: ExpectedAnswerClaim[];
  contraryEvidenceAnchorIds: string[];
  mustExcludeEvidenceAnchorIds: string[];
  expectedCanonicalRelationIds: string[];
  acceptableCandidateRelationIds: string[];
  mustExcludeRelationIds: string[];
  forbiddenConclusions: string[];
  acceptableAnswerBoundaries: string[];
  abstentionRequired: boolean;
  securityScenario?: 'prompt_injection' | 'local_only' | 'deletion' | 'stale_index' | 'correction_recurrence';
  retrievalCompleteness?: {
    mode: 'all_matching' | 'top_k';
    expectedAnchorIds: string[];
    minimumRecall: number;
  };
  budget: CognitiveBenchmarkBudget;
  notes?: string;
}

export const COGNITIVE_ARCHITECTURE_INVARIANTS = [
  'canonical-authored-content-is-never-overwritten-by-derivation',
  'derived-assertions-require-evidence-and-derivation-metadata',
  'current-and-historical-beliefs-remain-distinguishable',
  'user-source-author-and-ai-claims-remain-distinguishable',
  'unsupported-answer-claims-are-omitted-or-qualified',
  'derived-indexes-are-rebuildable-from-canonical-data',
  'ask-noesis-is-read-only-until-explicit-promotion',
  'retrieved-content-never-receives-write-authority',
] as const;

export function validateCognitiveBenchmark(
  cases: CognitiveBenchmarkCase[],
  anchors: CognitiveBenchmarkEvidenceAnchor[],
  relations: CognitiveBenchmarkRelation[] = [],
) {
  const errors: string[] = [];
  const caseIds = new Set<string>();
  const anchorIds = new Set(anchors.map((anchor) => anchor.id));
  const relationIds = new Set(relations.map((relation) => relation.id));

  anchors.forEach((anchor) => {
    if (!anchor.revisionId) errors.push(`${anchor.id}: revision is required`);
    if (!anchor.contentHash) errors.push(`${anchor.id}: content hash is required`);
    if (!anchor.speaker) errors.push(`${anchor.id}: speaker is required`);
    if (anchor.location.kind === 'text' && anchor.location.endOffset < anchor.location.startOffset) {
      errors.push(`${anchor.id}: invalid text offsets`);
    }
  });

  relations.forEach((relation) => {
    if (!anchorIds.has(relation.fromAnchorId)) errors.push(`${relation.id}: unknown from anchor`);
    if (!anchorIds.has(relation.toAnchorId)) errors.push(`${relation.id}: unknown to anchor`);
    relation.evidenceAnchorIds.forEach((anchorId) => {
      if (!anchorIds.has(anchorId)) errors.push(`${relation.id}: unknown evidence anchor ${anchorId}`);
    });
  });

  cases.forEach((benchmarkCase) => {
    if (caseIds.has(benchmarkCase.id)) errors.push(`Duplicate benchmark case id: ${benchmarkCase.id}`);
    caseIds.add(benchmarkCase.id);

    if (!benchmarkCase.query.trim()) errors.push(`${benchmarkCase.id}: query is empty`);
    if (!benchmarkCase.forbiddenConclusions.length) errors.push(`${benchmarkCase.id}: forbidden conclusions are required`);
    if (!benchmarkCase.acceptableAnswerBoundaries.length) errors.push(`${benchmarkCase.id}: answer boundaries are required`);

    const referencedAnchors = [
      ...benchmarkCase.requiredEvidenceAnchorIds,
      ...benchmarkCase.acceptableOptionalEvidenceAnchorIds,
      ...benchmarkCase.contraryEvidenceAnchorIds,
      ...benchmarkCase.mustExcludeEvidenceAnchorIds,
      ...(benchmarkCase.retrievalCompleteness?.expectedAnchorIds || []),
      ...benchmarkCase.expectedAnswerClaims.flatMap((claim) => [
        ...claim.requiredCitationGroups.flat(),
        ...claim.contraryEvidenceAnchorIds,
      ]),
    ];
    referencedAnchors.forEach((anchorId) => {
      if (!anchorIds.has(anchorId)) errors.push(`${benchmarkCase.id}: unknown anchor ${anchorId}`);
    });

    if (benchmarkCase.abstentionRequired && benchmarkCase.requiredEvidenceAnchorIds.length) {
      errors.push(`${benchmarkCase.id}: abstention cases cannot require supporting evidence`);
    }
    if (!benchmarkCase.abstentionRequired && !benchmarkCase.requiredEvidenceAnchorIds.length) {
      errors.push(`${benchmarkCase.id}: answerable cases require evidence`);
    }
    if (!benchmarkCase.abstentionRequired && !benchmarkCase.expectedAnswerClaims.length) {
      errors.push(`${benchmarkCase.id}: answerable cases require expected answer claims`);
    }
    if (benchmarkCase.retrievalCompleteness && (
      benchmarkCase.retrievalCompleteness.minimumRecall <= 0
      || benchmarkCase.retrievalCompleteness.minimumRecall > 1
    )) {
      errors.push(`${benchmarkCase.id}: completeness recall must be within (0, 1]`);
    }
    if (benchmarkCase.budget.maxEvidenceAnchors < 1 || benchmarkCase.budget.maxLatencyMs < 1) {
      errors.push(`${benchmarkCase.id}: invalid evidence or latency budget`);
    }
    [
      ...benchmarkCase.expectedCanonicalRelationIds,
      ...benchmarkCase.acceptableCandidateRelationIds,
      ...benchmarkCase.mustExcludeRelationIds,
    ].forEach((relationId) => {
      if (!relationIds.has(relationId)) errors.push(`${benchmarkCase.id}: unknown relation ${relationId}`);
    });
  });

  return errors;
}
