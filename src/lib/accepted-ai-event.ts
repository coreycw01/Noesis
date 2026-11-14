type ReviewedEntry = { id: string; action: string };

export function addedAiReviewEvent(previous: readonly ReviewedEntry[] | undefined, next: readonly ReviewedEntry[] | undefined) {
  const existingIds = new Set(previous?.map((entry) => entry.id));
  const added = next?.find((entry) => !existingIds.has(entry.id));
  if (!added) return null;
  return {
    origin: 'ai-assisted' as const,
    eventType: 'suggestion_accepted' as const,
    summary: `Reviewed contextual assistance: ${added.action.replace(/_/g, ' ')}`,
    importance: 'medium' as const,
    idempotencyKey: `ai-review-${added.id}`,
    metadata: { contextualAiAction: added.action, acceptedAfterReview: true, reviewEntryId: added.id },
  };
}
