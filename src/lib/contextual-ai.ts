export type ContextualAiScope = 'current_item' | 'linked_items' | 'selected_pair' | 'selected_period';

export type ContextualAiAction =
  | 'summarize_source'
  | 'extract_source_claims'
  | 'propose_inquiry_prompts'
  | 'suggest_annotation_effect'
  | 'refine_concept_definition'
  | 'clarify_concept_boundaries'
  | 'socratic_inquiry_challenge'
  | 'find_position_assumptions'
  | 'generate_position_counterargument'
  | 'identify_missing_position_evidence'
  | 'stress_test_position'
  | 'compare_selected_positions'
  | 'synthesize_practice_outcome'
  | 'synthesize_evolution_period';

export interface AiContextEnvelope {
  action: ContextualAiAction;
  targetType: 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'practice' | 'evolution';
  targetId: string;
  scope: ContextualAiScope;
  itemMemory: string[];
  linkedMemory: string[];
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
  extract_source_claims: 'Extract Claims',
  propose_inquiry_prompts: 'Propose Inquiry Prompts',
  suggest_annotation_effect: 'Suggest Effect',
  refine_concept_definition: 'Refine Definition',
  clarify_concept_boundaries: 'Clarify Boundaries',
  socratic_inquiry_challenge: 'Socratic Challenge',
  find_position_assumptions: 'Find Assumptions',
  generate_position_counterargument: 'Generate Counterargument',
  identify_missing_position_evidence: 'Identify Missing Evidence',
  stress_test_position: 'Stress-Test Position',
  compare_selected_positions: 'Compare Positions',
  synthesize_practice_outcome: 'Synthesize Outcome',
  synthesize_evolution_period: 'Synthesize Period',
};
