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

export interface AssumptionSuggestion {
  assumption: string;
  reason: string;
}

export interface AiReviewItem {
  title: string;
  content: string;
  detail?: string;
}

export type AiReviewMode = 'single' | 'list' | 'sections';

export interface AiReviewPresentation {
  mode: AiReviewMode;
  heading: string;
  guidance: string;
  destination: string;
  itemName: string;
}

export function parseAssumptionSuggestions(content: string): AssumptionSuggestion[] {
  const suggestions: AssumptionSuggestion[] = [];
  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    let line = rawLine.trim();
    if (!line || /^#{1,6}\s/.test(line)) continue;
    line = line
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^\*\*(.*?)\**:?\s*/, '$1: ')
      .trim();
    const structured = line.match(/^ASSUMPTION:\s*(.+?)\s*\|\|\s*WHY:\s*(.+)$/i);
    if (structured) {
      suggestions.push({ assumption: structured[1].trim(), reason: structured[2].trim() });
      continue;
    }
    const explained = line.match(/^(?:Assumption\s*\d*:\s*)?(.+?)(?:\s+[-—|]\s+|\s+Why (?:it )?matters:\s*)(.+)$/i);
    if (explained) {
      suggestions.push({ assumption: explained[1].trim(), reason: explained[2].trim() });
      continue;
    }
    if (/^Assumption\s*\d*:/i.test(line)) {
      suggestions.push({ assumption: line.replace(/^Assumption\s*\d*:\s*/i, '').trim(), reason: '' });
      continue;
    }
    if (/^[-*+]|^\d+[.)]/.test(rawLine.trim())) suggestions.push({ assumption: line, reason: '' });
  }
  return suggestions.filter((item, index, all) => item.assumption && all.findIndex((candidate) => candidate.assumption.toLowerCase() === item.assumption.toLowerCase()) === index).slice(0, 8);
}

export const CONTEXTUAL_AI_REVIEW: Record<ContextualAiAction, AiReviewPresentation> = {
  summarize_source: { mode: 'sections', heading: 'Review the source summary', guidance: 'Edit or remove any section that does not accurately represent the source.', destination: 'source summary', itemName: 'section' },
  reflect_on_source: { mode: 'sections', heading: 'Review your learning reflection', guidance: 'Keep only the interpretations that reflect what you learned from this source.', destination: 'source reflection', itemName: 'reflection' },
  extract_source_claims: { mode: 'list', heading: 'Review each claim', guidance: 'Keep only claims the source actually makes, and revise their wording before saving.', destination: 'source claims', itemName: 'claim' },
  propose_inquiry_prompts: { mode: 'list', heading: 'Review each inquiry', guidance: 'Choose the questions worth pursuing. Each selected question becomes a separate inquiry prompt.', destination: 'inquiry prompts', itemName: 'inquiry' },
  suggest_annotation_effect: { mode: 'sections', heading: 'Review the effect on your thinking', guidance: 'Edit the interpretation so it describes your thinking rather than treating the suggestion as fact.', destination: 'annotation reflection', itemName: 'point' },
  refine_concept_definition: { mode: 'single', heading: 'Review the definition', guidance: 'Make the definition precise and recognizably yours before saving.', destination: 'concept definition', itemName: 'definition' },
  clarify_concept_boundaries: { mode: 'list', heading: 'Review each boundary', guidance: 'Keep the distinctions that clarify what this concept is not.', destination: 'concept boundaries', itemName: 'boundary' },
  socratic_inquiry_challenge: { mode: 'sections', heading: 'Review the challenge', guidance: 'Work through the questions, assumptions, counterpoints, and next steps before adding the note.', destination: 'inquiry investigation note', itemName: 'section' },
  find_position_assumptions: { mode: 'list', heading: 'Review each assumption', guidance: 'Keep only assumptions this position truly depends on. Edit their wording before saving.', destination: 'position assumptions', itemName: 'assumption' },
  generate_position_counterargument: { mode: 'sections', heading: 'Review the counterargument', guidance: 'Strengthen or remove parts until this is an argument you consider genuinely challenging.', destination: 'evidence against this position', itemName: 'section' },
  identify_missing_position_evidence: { mode: 'list', heading: 'Review each evidence gap', guidance: 'Keep only gaps that would materially affect your confidence in the position.', destination: 'position confidence reasoning', itemName: 'evidence gap' },
  compare_selected_positions: { mode: 'sections', heading: 'Review the comparison', guidance: 'Check that agreements, tensions, and tradeoffs fairly represent both positions.', destination: 'position review history', itemName: 'section' },
  synthesize_practice_outcome: { mode: 'sections', heading: 'Review the practice outcome', guidance: 'Keep the observations grounded in your actual logs and revise any overstatement.', destination: 'practice outcome draft; save the practice to confirm it', itemName: 'finding' },
  synthesize_evolution_period: { mode: 'sections', heading: 'Review the period synthesis', guidance: 'Choose the changes that genuinely mattered during this period.', destination: 'exportable evolution synthesis', itemName: 'change' },
  synthesize_profile_philosophy: { mode: 'sections', heading: 'Review your philosophy draft', guidance: 'Shape each section until it sounds like your philosophy, not an outside description.', destination: 'profile philosophy statement', itemName: 'section' },
};

function cleanReviewText(value: string) {
  return value.trim().replace(/^\*\*(.*?)\*\*:?[ \t]*/, '$1: ').trim();
}

export function parseAiReviewItems(action: ContextualAiAction, content: string): AiReviewItem[] {
  if (action === 'find_position_assumptions') {
    return parseAssumptionSuggestions(content).map((item, index) => ({ title: `Assumption ${index + 1}`, content: item.assumption, detail: item.reason }));
  }
  const presentation = CONTEXTUAL_AI_REVIEW[action];
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (presentation.mode === 'single') return [{ title: presentation.itemName, content: normalized }];

  if (presentation.mode === 'sections') {
    const sections: AiReviewItem[] = [];
    let title = '';
    let body: string[] = [];
    const flush = () => {
      const value = body.join('\n').trim();
      if (value) sections.push({ title: title || `${presentation.itemName} ${sections.length + 1}`, content: value });
      body = [];
    };
    for (const line of normalized.split('\n')) {
      const heading = line.trim().match(/^#{1,6}\s+(.+)$/);
      if (heading) {
        flush();
        title = heading[1].replace(/\*\*/g, '').trim();
      } else body.push(line);
    }
    flush();
    if (sections.length > 1 || title) return sections.slice(0, 10);
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const listItems = lines
    .filter((line) => /^[-*+]\s+|^\d+[.)]\s+|^(?:ITEM|CLAIM|QUESTION|BOUNDARY|GAP):/i.test(line))
    .map((line, index) => ({
      title: `${presentation.itemName} ${index + 1}`,
      content: cleanReviewText(line.replace(/^[-*+]\s+|^\d+[.)]\s+|^(?:ITEM|CLAIM|QUESTION|BOUNDARY|GAP):\s*/i, '')),
    }));
  if (listItems.length) return listItems.slice(0, 12);

  const paragraphs = normalized.split(/\n\s*\n/).map(cleanReviewText).filter(Boolean);
  return paragraphs.map((paragraph, index) => ({ title: `${presentation.itemName} ${index + 1}`, content: paragraph })).slice(0, 10);
}

export function serializeAiReviewItems(action: ContextualAiAction, items: AiReviewItem[]): string {
  const selected = items.filter((item) => item.content.trim());
  const presentation = CONTEXTUAL_AI_REVIEW[action];
  if (presentation.mode === 'single') return selected[0]?.content.trim() || '';
  if (presentation.mode === 'sections') return selected.map((item) => `## ${item.title}\n${item.content.trim()}`).join('\n\n');
  return selected.map((item) => item.content.trim()).join('\n');
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
  return Boolean(policy && policy.targetType === input.targetType && policy.scope === input.scope);
}

export function boundedAiContext(input: AiContextEnvelope): AiContextEnvelope {
  let remaining = 32_000;
  const limit = (lines: string[], count: number) => lines.slice(0, count).flatMap((line) => {
    const value = line.trim().slice(0, Math.min(4_000, remaining));
    remaining -= value.length;
    return value ? [value] : [];
  });
  const itemMemory = limit(input.itemMemory, 20);
  const secondaryTarget = input.secondaryTarget ? { ...input.secondaryTarget, memory: limit(input.secondaryTarget.memory, 12) } : undefined;
  const linkedMemory = limit(input.linkedMemory, 20);
  return { ...input, itemMemory, secondaryTarget, linkedMemory, userPrompt: input.userPrompt?.trim().slice(0, 1_000) || undefined };
}

export function validAiSelection(input: AiContextEnvelope): boolean {
  if (input.action === 'compare_selected_positions') {
    if (!input.secondaryTarget || input.secondaryTarget.targetId === input.targetId || !input.secondaryTarget.memory.length) return false;
  } else if (input.secondaryTarget) return false;
  if (input.action === 'synthesize_evolution_period') {
    if (!input.selectedRange) return false;
    const from = Date.parse(input.selectedRange.from);
    const to = Date.parse(input.selectedRange.to);
    return Number.isFinite(from) && Number.isFinite(to) && from <= to;
  }
  return !input.selectedRange;
}
