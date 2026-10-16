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
  suggest_annotation_effect: { mode: 'sections', heading: 'Review what this note could change', guidance: 'Keep only the analysis that fits your thinking. The source\'s words are not automatically your belief.', destination: 'the annotation’s Contextual Review', itemName: 'section' },
  refine_concept_definition: { mode: 'single', heading: 'Review the definition', guidance: 'Make the definition precise and recognizably yours before saving.', destination: 'concept definition', itemName: 'definition' },
  clarify_concept_boundaries: { mode: 'sections', heading: 'Review the concept boundary', guidance: 'Edit each section before saving. This review informs your boundary fields but does not silently rewrite them.', destination: 'the concept’s saved Boundary Review', itemName: 'section' },
  socratic_inquiry_challenge: { mode: 'sections', heading: 'Review the challenge', guidance: 'Keep and edit each useful section. Approved sections become separate investigation notes on this inquiry.', destination: 'the inquiry’s investigation history', itemName: 'section' },
  find_position_assumptions: { mode: 'list', heading: 'Review each assumption', guidance: 'Keep only assumptions this position truly depends on. Edit their wording before saving.', destination: 'position assumptions', itemName: 'assumption' },
  generate_position_counterargument: { mode: 'sections', heading: 'Review the counterargument', guidance: 'Strengthen or remove parts until this is an argument you consider genuinely challenging.', destination: 'evidence against this position', itemName: 'section' },
  identify_missing_position_evidence: { mode: 'list', heading: 'Review each evidence gap', guidance: 'Keep only gaps that would materially affect your confidence in the position.', destination: 'Evidence Still Needed on this position', itemName: 'evidence gap' },
  compare_selected_positions: { mode: 'sections', heading: 'Review the comparison', guidance: 'Check that agreements, tensions, and tradeoffs fairly represent both positions.', destination: 'Saved Position Comparisons', itemName: 'section' },
  synthesize_practice_outcome: { mode: 'sections', heading: 'Review the practice analysis', guidance: 'Check each finding against your logs. Edit or remove anything that overstates what the practice established.', destination: 'the practice’s saved Outcome Review', itemName: 'finding' },
  synthesize_evolution_period: { mode: 'sections', heading: 'Review this period of change', guidance: 'Keep only conclusions supported by recorded events. Edit any interpretation that does not match how your thinking changed.', destination: 'the Evolution timeline as a reviewed synthesis', itemName: 'change' },
  synthesize_profile_philosophy: { mode: 'sections', heading: 'Review your philosophy draft', guidance: 'Edit each inference until it is recognizably yours. Only the approved Working statement updates your statement; the complete review remains available on Profile.', destination: 'the Profile philosophy review', itemName: 'section' },
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

export function profileStatementFromSynthesis(content: string): string | undefined {
  return parseAiReviewItems('synthesize_profile_philosophy', content)
    .find((section) => section.title.trim().toLowerCase() === 'working statement')
    ?.content.trim() || undefined;
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
