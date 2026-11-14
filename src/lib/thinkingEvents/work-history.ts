import type { Draft } from '../types';

export function workContentLength(work: Partial<Draft> | null | undefined) {
  return [work?.body, work?.draftContent, work?.finalContent, ...(work?.documentPages || []).map((page) => page.content)]
    .reduce((total, text) => total + (text?.length ?? 0), 0);
}

export function workHistorySnapshot(work: Partial<Draft> | null | undefined) {
  if (!work) return null;
  return {
    title: work.title,
    status: work.status,
    type: work.type,
    revision: work.revision,
    pageCount: 1 + (work.documentPages?.length ?? 0),
    contentLength: workContentLength(work),
  };
}
