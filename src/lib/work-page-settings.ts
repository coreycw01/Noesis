import type { DocumentPageSettings, DocumentSettings } from '@/lib/types';

export type ResolvedDocumentPageSettings = Pick<DocumentSettings, 'pageSize' | 'paperColor' | 'paperPattern'>;

export function resolveDocumentPageSettings(
  documentSettings: ResolvedDocumentPageSettings,
  pageSettings: Record<string, DocumentPageSettings> | undefined,
  pageId: string,
): ResolvedDocumentPageSettings {
  return { ...documentSettings, ...(pageSettings?.[pageId] || {}) };
}

export function updateDocumentPageSettings(
  pageSettings: Record<string, DocumentPageSettings> | undefined,
  pageId: string,
  patch: DocumentPageSettings,
) {
  return {
    ...(pageSettings || {}),
    [pageId]: { ...(pageSettings?.[pageId] || {}), ...patch },
  };
}

export function removeDocumentPageSettings(
  pageSettings: Record<string, DocumentPageSettings> | undefined,
  pageId: string,
) {
  const next = { ...(pageSettings || {}) };
  delete next[pageId];
  return next;
}
