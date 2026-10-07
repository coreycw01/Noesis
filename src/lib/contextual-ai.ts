export type ContextualAiScope = 'current_item' | 'linked_items' | 'selected_pair' | 'selected_period';

export type ContextualAiAction =
  | 'summarize_source'
  | 'reflect_on_source'
  | 'extract_source_claims'
  | 'propose_inquiry_prompts'
  | 'suggest_annotation_effect'
  | 'refine_concept_definition'
  | 'clarify_concept_boundaries'
  | 'socratic_inquiry_challenge'
  | 'find_position_assumptions'
  | 'generate_position_counterargument'
  | 'identify_missing_position_evidence'
  | 'compare_selected_positions'
  | 'synthesize_practice_outcome'
  | 'synthesize_evolution_period'
  | 'synthesize_profile_philosophy';

export interface AiContextEnvelope {
  action: ContextualAiAction;
  targetType: 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'practice' | 'evolution' | 'profile';
  targetId: string;
  scope: ContextualAiScope;
  itemMemory: string[];
  linkedMemory: string[];
  userPrompt?: string;
  selectedRange?: { from: string; to: string };
  secondaryTarget?: {
    targetType: 'position';
    targetId: string;
    label: string;
    memory: string[];
  };
  reasoningDepth?: 'light' | 'standard' | 'deep';
}

export interface AiReviewResult {
  action: ContextualAiAction;
  targetType: string;
  targetId: string;
  title: string;
  content: string;
  contextSummary: string;
  generatedAt: string;
}

export const CONTEXTUAL_AI_LABELS: Record<ContextualAiAction, string> = {
  summarize_source: 'Summarize Source',
  reflect_on_source: 'Reflect on Source',
  extract_source_claims: 'Extract Claims',
  propose_inquiry_prompts: 'Propose Inquiry Prompts',
  suggest_annotation_effect: 'Suggest Effect',
  refine_concept_definition: 'Refine Definition',
  clarify_concept_boundaries: 'Clarify Boundaries',
  socratic_inquiry_challenge: 'Socratic Challenge',
  find_position_assumptions: 'Find Assumptions',
  generate_position_counterargument: 'Generate Counterargument',
  identify_missing_position_evidence: 'Identify Missing Evidence',
  compare_selected_positions: 'Compare Positions',
  synthesize_practice_outcome: 'Synthesize Outcome',
  synthesize_evolution_period: 'Synthesize Period',
  synthesize_profile_philosophy: 'Shape My Philosophy',
};

export const CONTEXTUAL_AI_POLICIES: Record<ContextualAiAction, {
  targetType: AiContextEnvelope['targetType'];
  scope: ContextualAiScope;
}> = {
  summarize_source: { targetType: 'source', scope: 'linked_items' },
  reflect_on_source: { targetType: 'source', scope: 'linked_items' },
  extract_source_claims: { targetType: 'source', scope: 'linked_items' },
  propose_inquiry_prompts: { targetType: 'source', scope: 'linked_items' },
  suggest_annotation_effect: { targetType: 'annotation', scope: 'linked_items' },
  refine_concept_definition: { targetType: 'concept', scope: 'linked_items' },
  clarify_concept_boundaries: { targetType: 'concept', scope: 'linked_items' },
  socratic_inquiry_challenge: { targetType: 'inquiry', scope: 'linked_items' },
  find_position_assumptions: { targetType: 'position', scope: 'linked_items' },
  generate_position_counterargument: { targetType: 'position', scope: 'linked_items' },
  identify_missing_position_evidence: { targetType: 'position', scope: 'linked_items' },
  compare_selected_positions: { targetType: 'position', scope: 'selected_pair' },
  synthesize_practice_outcome: { targetType: 'practice', scope: 'linked_items' },
  synthesize_evolution_period: { targetType: 'evolution', scope: 'selected_period' },
  synthesize_profile_philosophy: { targetType: 'profile', scope: 'linked_items' },
};

export function isContextualAiRequestCompatible(input: Pick<AiContextEnvelope, 'action' | 'targetType' | 'scope'>) {
  const policy = CONTEXTUAL_AI_POLICIES[input.action];
  return policy.targetType === input.targetType && policy.scope === input.scope;
}
