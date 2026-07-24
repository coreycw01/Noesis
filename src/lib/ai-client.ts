"use client";

import type { Annotation, Media } from '@/lib/types';

export interface AiMemoryContext {
  scope: 'current_object' | 'linked_objects' | 'whole_workspace';
  itemMemory?: string[];
  linkedMemory?: string[];
  workspaceMemory?: string[];
  instruction?: string;
}

export interface DistillInsightsPayload {
  mediaTitle: string;
  mediaCreator?: string;
  capturedNotes?: Media['capture'];
  annotations?: Array<Pick<Annotation, 'text' | 'type' | 'context'>>;
}

export interface GenerateReflectiveQuestionsPayload {
  mediaTitle: string;
  beforePriorBeliefs?: string;
  beforeExpectation?: string;
  beforeOpenQuestion?: string;
  afterCoreArgument?: string;
  afterLastingIdea?: string;
  afterBeliefChange?: string;
}

export interface SuggestAnnotationConsequencesPayload {
  annotationText: string;
  annotationType?: string;
  sourceTitle?: string;
  existingConcepts?: string[];
  existingInquiries?: string[];
  existingPositions?: string[];
  memoryContext?: AiMemoryContext;
}

export interface SuggestAnnotationConsequencesResult {
  thoughtKind: 'claim_agree' | 'claim_reject' | 'question' | 'definition' | 'example' | 'contradiction' | 'personal_reaction';
  suggestedConcepts: string[];
  suggestedInquiry?: string;
  suggestedPosition?: string;
  suggestedLinkType?: 'supports' | 'challenges' | 'coheres' | 'defines' | 'refines' | 'contradicts' | 'exemplifies' | 'inspired_by' | 'tested_by' | 'expressed_in' | 'changed_by' | 'depends_on' | 'explains' | 'explained_by' | 'derived_from' | 'references' | 'replaces' | 'questions' | 'expands' | 'weakens' | 'strengthens';
  rationale: string;
}

export interface DetectMissingPerspectivesPayload {
  targetType: string;
  targetTitle: string;
  content: string;
  sourceTitles?: string[];
  conceptTags?: string[];
  existingPerspectiveCoverage?: string[];
  memoryContext?: AiMemoryContext;
}

export interface DetectMissingPerspectivesResult {
  suggestions: Array<{
    perspective: string;
    whyItMatters: string;
    evidence: string[];
    question: string;
    confidence: number;
  }>;
}

export interface DetectMissingQuestionsPayload {
  concepts: string[];
  positions: string[];
  unknowns: string[];
  inquiries: string[];
  contradictions: string[];
  memoryContext?: AiMemoryContext;
}

export interface DetectMissingQuestionsResult {
  suggestions: Array<{
    question: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
  }>;
}

export interface GenerateStressTestPayload {
  targetType: string;
  title: string;
  content: string;
  memoryContext?: AiMemoryContext;
}

export interface GenerateStressTestResult {
  prompts: Array<{
    kind: 'change_mind' | 'hidden_assumption' | 'falsification' | 'prediction' | 'opposite_case' | 'weakening_evidence';
    question: string;
  }>;
}

export interface InferThinkingPatternsPayload {
  positions: Array<{ title: string; statement: string; confidence?: number }>;
  inquiries: string[];
  works: string[];
  sources: Array<{ title: string; type: string }>;
  links: Array<{ from: string; to: string; type: string }>;
  thinkingEvents: Array<{ eventType: string; summary: string }>;
}

export interface InferThinkingPatternsResult {
  patterns: Array<{
    patternType: 'evidence_style' | 'reasoning_style' | 'questioning_style' | 'source_bias' | 'conceptual_gap' | 'revision_pattern' | 'contradiction_pattern' | 'certainty_pattern';
    label: string;
    description: string;
    evidence: string[];
    confidence: number;
    timespan: string;
    trendDirection: 'increasing' | 'decreasing' | 'stable' | 'unclear';
  }>;
}

export interface SocratesReflectPayload {
  question: string;
  initialAnswer: string;
  exchanges?: Array<{ probe: string; response: string }>;
}

export interface SocratesReflectResult {
  ready: boolean;
  probe?: string;
  focus?: string;
  positionTitle?: string;
  statement?: string;
  description?: string;
  confidence?: number;
}

export interface GenerateIdeaQuestionsPayload {
  ideaTitle: string;
  ideaBody?: string;
}

export interface GenerateIdeaQuestionsResult {
  questions: Array<{ question: string; focus: string }>;
}

export interface FormPositionFromIdeaPayload {
  ideaTitle: string;
  ideaBody?: string;
  qa: Array<{ question: string; answer: string }>;
}

export interface FormPositionFromIdeaResult {
  positionTitle: string;
  statement: string;
  description: string;
  confidence: number;
}

export interface SuggestConceptDescriptionPayload {
  conceptName: string;
  currentDescription?: string;
  linkedSources?: Array<{ title: string; creator?: string; description?: string; notes?: string }>;
  linkedIdeas?: Array<{ title: string; body: string }>;
  linkedBeliefs?: Array<{ title: string; description?: string; statement: string }>;
  memoryContext?: AiMemoryContext;
}

export interface GenerateClarityCheckPayload {
  conceptName: string;
  conceptDefinition?: string;
  positionStatements: string[];
  annotationTexts: string[];
  relatedConcepts: string[];
  memoryContext?: AiMemoryContext;
}

export interface ClarityCheckOption {
  id: 'a' | 'b' | 'c' | 'd';
  text: string;
  isClosest: boolean;
}

export interface ClarityCheckQuestion {
  text: string;
  dimension: 'definition' | 'distinction' | 'application' | 'tension' | 'connection';
  options: ClarityCheckOption[];
  feedback: string;
}

export interface GenerateClarityCheckResult {
  questions: ClarityCheckQuestion[];
}

export interface SuggestPositionDraftsPayload {
  conceptName?: string;
  annotations: string[];
  sourceTitles?: string[];
  memoryContext?: AiMemoryContext;
}

export interface SuggestPositionDraftsResult {
  drafts: Array<{
    claim: string;
    confidence: 'low' | 'medium' | 'high';
    supportSummary: string;
    challengeToConsider: string;
  }>;
}

type AiActionMap = {
  distillInsightsFromMedia: {
    payload: DistillInsightsPayload;
    result: { coreClaim: string };
  };
  generateReflectiveQuestions: {
    payload: GenerateReflectiveQuestionsPayload;
    result: string[];
  };
  suggestAnnotationConsequences: {
    payload: SuggestAnnotationConsequencesPayload;
    result: SuggestAnnotationConsequencesResult;
  };
  socratesReflect: {
    payload: SocratesReflectPayload;
    result: SocratesReflectResult;
  };
  generateIdeaQuestions: {
    payload: GenerateIdeaQuestionsPayload;
    result: GenerateIdeaQuestionsResult;
  };
  formPositionFromIdea: {
    payload: FormPositionFromIdeaPayload;
    result: FormPositionFromIdeaResult;
  };
  suggestConceptDescription: {
    payload: SuggestConceptDescriptionPayload;
    result: { suggestedDescription: string };
  };
  generateClarityCheck: {
    payload: GenerateClarityCheckPayload;
    result: GenerateClarityCheckResult;
  };
  suggestPositionDrafts: {
    payload: SuggestPositionDraftsPayload;
    result: SuggestPositionDraftsResult;
  };
  detectMissingPerspectives: {
    payload: DetectMissingPerspectivesPayload;
    result: DetectMissingPerspectivesResult;
  };
  detectMissingQuestions: {
    payload: DetectMissingQuestionsPayload;
    result: DetectMissingQuestionsResult;
  };
  generateStressTest: {
    payload: GenerateStressTestPayload;
    result: GenerateStressTestResult;
  };
  inferThinkingPatterns: {
    payload: InferThinkingPatternsPayload;
    result: InferThinkingPatternsResult;
  };
};

async function callAiAction<K extends keyof AiActionMap>(
  action: K,
  payload: AiActionMap[K]['payload'],
): Promise<AiActionMap[K]['result']> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'AI request failed. Please try again.');
  }

  if (!('result' in data)) {
    throw new Error('No usable AI response was returned.');
  }

  return data.result as AiActionMap[K]['result'];
}

export const aiClient = {
  distillInsightsFromMedia: (payload: DistillInsightsPayload) => callAiAction('distillInsightsFromMedia', payload),
  generateReflectiveQuestions: (payload: GenerateReflectiveQuestionsPayload) => callAiAction('generateReflectiveQuestions', payload),
  suggestAnnotationConsequences: (payload: SuggestAnnotationConsequencesPayload) => callAiAction('suggestAnnotationConsequences', payload),
  socratesReflect: (payload: SocratesReflectPayload) => callAiAction('socratesReflect', payload),
  generateIdeaQuestions: (payload: GenerateIdeaQuestionsPayload) => callAiAction('generateIdeaQuestions', payload),
  formPositionFromIdea: (payload: FormPositionFromIdeaPayload) => callAiAction('formPositionFromIdea', payload),
  suggestConceptDescription: (payload: SuggestConceptDescriptionPayload) => callAiAction('suggestConceptDescription', payload),
  generateClarityCheck: (payload: GenerateClarityCheckPayload) => callAiAction('generateClarityCheck', payload),
  suggestPositionDrafts: (payload: SuggestPositionDraftsPayload) => callAiAction('suggestPositionDrafts', payload),
  detectMissingPerspectives: (payload: DetectMissingPerspectivesPayload) => callAiAction('detectMissingPerspectives', payload),
  detectMissingQuestions: (payload: DetectMissingQuestionsPayload) => callAiAction('detectMissingQuestions', payload),
  generateStressTest: (payload: GenerateStressTestPayload) => callAiAction('generateStressTest', payload),
  inferThinkingPatterns: (payload: InferThinkingPatternsPayload) => callAiAction('inferThinkingPatterns', payload),
};
