import type { AiAssistedHistoryEntry, Question } from './types';
import type { DeskFinding } from './context-desk-handoff';

/** A read-only projection of material already accepted on this record. */
export function itemAiHistory(item: {
  aiReviewHistory?: AiAssistedHistoryEntry[];
  contextDeskFindings?: DeskFinding[];
  investigationNotes?: Question['investigationNotes'];
}): AiAssistedHistoryEntry[] {
  const entries = [
    ...(item.aiReviewHistory || []),
    ...(item.investigationNotes || []).filter(n => n.origin === 'ai-assisted').map(n => ({
      id: n.id, title: n.title || 'Socratic challenge', action: 'socratic_inquiry_challenge', content: n.text, date: n.date,
    })),
    ...(item.contextDeskFindings || []).map(f => ({ ...f, title: 'Context Desk finding', action: 'review_selected_context' })),
  ];
  return Array.from(new Map(entries.map(entry => [entry.id, entry])).values())
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
