import type { AiDepthPage, AiSettings } from '@/lib/types';

export const AI_DEPTH_PAGES: Array<{ page: AiDepthPage; label: string }> = [
  { page: 'library', label: 'Library' },
  { page: 'annotations', label: 'Annotations' },
  { page: 'concepts', label: 'Concepts' },
  { page: 'inquiries', label: 'Inquiries' },
  { page: 'positions', label: 'Positions' },
  { page: 'praxis', label: 'Praxis' },
  { page: 'evolution', label: 'Evolution' },
  { page: 'profile', label: 'Profile' },
  { page: 'context-desk', label: 'Noesis AI desk' },
];

/** The reasoning depth a page starts with: its own default, else the workspace default. */
export function aiDepthFor(settings: Pick<AiSettings, 'defaultReasoningDepth' | 'depthByPage'> | null | undefined, page: AiDepthPage): AiSettings['defaultReasoningDepth'] {
  return settings?.depthByPage?.[page] || settings?.defaultReasoningDepth || 'standard';
}
