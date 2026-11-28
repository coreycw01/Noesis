import { validAiSelection, type AiContextEnvelope } from './contextual-ai';

export type MemoryGroup = 'itemMemory' | 'linkedMemory' | 'secondaryMemory';

export function aiExcerptKey(group: MemoryGroup, index: number, text: string) {
  return JSON.stringify([group, index, text]);
}

export function prepareReviewedAiContext(input: AiContextEnvelope, hidden: ReadonlySet<string>, deskRecordKeys?: readonly string[]) {
  const kept = (group: MemoryGroup, items: string[]) =>
    items.flatMap((text, index) => hidden.has(aiExcerptKey(group, index, text)) ? [] : [{ text, index }]);
  const primary = kept('itemMemory', input.itemMemory);
  const linked = kept('linkedMemory', input.linkedMemory);
  const itemMemory = primary.map(item => item.text);
  const linkedMemory = linked.map(item => item.text);
  const secondaryTarget = input.secondaryTarget ? {
    ...input.secondaryTarget,
    memory: kept('secondaryMemory', input.secondaryTarget.memory).map(item => item.text),
  } : undefined;
  // The Desk has no required primary record. Promote the first included record
  // if the first slip was hidden, without repopulating from behind the cut.
  if (input.targetType === 'context_desk' && !itemMemory.length && linkedMemory.length) itemMemory.push(linkedMemory.shift()!);
  const included = { item: new Set(primary.map(item => item.index)), linked: new Set(linked.map(item => item.index)) };
  const targetId = input.targetType === 'context_desk' && deskRecordKeys
    ? `selection:${includedDeskRecords(deskRecordKeys, included).sort().join('|')}`.slice(0, 256)
    : input.targetId;
  const envelope = { ...input, targetId, itemMemory, linkedMemory, secondaryTarget };
  return {
    envelope,
    isValid: itemMemory.length > 0 && validAiSelection(envelope),
    included,
  };
}

export function includedDeskRecords<T>(records: readonly T[], included: { item: ReadonlySet<number>; linked: ReadonlySet<number> }) {
  return records.filter((_, index) => index === 0 ? included.item.has(0) : included.linked.has(index - 1));
}

export const contextualPromptCopy: Record<AiContextEnvelope['targetType'], { action: string; question: string }> = {
  source: { action: 'What should Noesis examine in this source?', question: 'What do you want to understand about this source?' },
  annotation: { action: 'How should Noesis read this annotation?', question: 'What do you want to understand about this passage or note?' },
  concept: { action: 'What should Noesis examine about this concept?', question: 'What feels unclear about its definition or boundaries?' },
  inquiry: { action: 'Which part of this inquiry should Noesis examine?', question: 'What do you want to understand about this question, its answers, or evidence?' },
  position: { action: 'How should Noesis test this position?', question: 'What do you want to understand about this claim or what supports it?' },
  practice: { action: 'What should Noesis examine in this Praxis record?', question: 'What do you want to understand about what you tried or what happened?' },
  evolution: { action: 'What kind of change should Noesis examine?', question: 'What do you want to understand about this period?' },
  profile: { action: 'Which view of your philosophy should Noesis take?', question: 'What do you want to understand about the ideas you’ve recorded?' },
  context_desk: { action: 'How should Noesis use the selected records?', question: 'What do you want to understand across these records?' },
  thought_draft: { action: 'How could this thought develop?', question: 'What is one useful next step?' },
};
