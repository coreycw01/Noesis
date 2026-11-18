import type { Media } from '@/lib/types';

export type SourceJourneyStep = 'overview' | 'capture' | 'annotations' | 'connections';

export interface SourceJourneyState {
  progress: number;
  meta: string;
  next: string;
}

const round = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * How far the reader has taken a source through Understand, Engage, Capture,
 * and Connect, with a plain next move for each. Progress is 0 to 1 and only
 * counts the reader's own work, never metadata a provider filled in.
 */
export function sourceJourney(source: Media, citations: number): Record<SourceJourneyStep, SourceJourneyState> {
  const before = source.capture?.before || {};
  const after = source.capture?.after || {};
  const sessions = source.capture?.sessions || [];
  const annotations = source.annotations || [];
  const developed = annotations.filter((note) => note.createdPositionId || note.createdInquiryId || (note.linkedPositionIds || []).length || note.consequenceNote?.trim() || note.answer?.trim()).length;
  const minutes = Math.round(sessions.reduce((total, session) => total + (session.durationSeconds || session.totalElapsedSeconds || 0), 0) / 60);
  // Same fields the source page reads as its purpose.
  const purpose = Boolean(before.reasonForAdding?.trim() || before.openQuestion?.trim() || before.expectation?.trim());
  const beforeCount = (['reasonForAdding', 'expectation', 'openQuestion'] as const).filter((key) => before[key]?.trim()).length;
  const afterCount = (['coreArgument', 'beliefChange', 'strongestArgument', 'weakestArgument', 'remainsUnanswered'] as const).filter((key) => after[key]?.trim()).length;
  // Concept ids and tag labels describe the same concepts, so take the larger count.
  const concepts = Math.max((source.conceptIds || []).length, (source.tags || []).length);

  const understand = Math.min(1, (purpose ? 0.5 : 0) + (source.sourceNotes?.trim() ? 0.25 : 0) + (after.coreArgument?.trim() ? 0.25 : 0));
  const engage = Math.min(1, (beforeCount / 3) * 0.3 + (Math.min(sessions.length, 2) / 2) * 0.35 + (afterCount / 5) * 0.35);
  const capture = annotations.length ? Math.min(1, (Math.min(annotations.length, 4) / 4) * 0.6 + (developed / annotations.length) * 0.4) : 0;
  const connect = Math.min(1, (Math.min(concepts, 2) / 2) * 0.5 + (Math.min(citations, 2) / 2) * 0.5);

  return {
    overview: {
      progress: round(understand),
      meta: purpose ? 'Purpose set' : 'No purpose yet',
      next: purpose ? (after.coreArgument?.trim() ? 'Revisit the central idea if your reading changed it.' : 'State the central idea in your own words.') : 'Name why this source is worth your time.',
    },
    capture: {
      progress: round(engage),
      meta: `${plural(sessions.length, 'session')} · ${minutes} min · ${afterCount ? 'reflected' : 'not reflected'}`,
      next: sessions.length ? (afterCount ? 'Add a session or deepen your reflection.' : 'You have spent time with it; reflect while it is fresh.') : 'Start a session, one sitting at a time.',
    },
    annotations: {
      progress: round(capture),
      meta: `${plural(annotations.length, 'note')} · ${developed} developed`,
      next: annotations.length ? (developed < annotations.length ? `${plural(annotations.length - developed, 'note')} waiting to be developed.` : 'Every note has gone somewhere.') : 'Capture the passages that matter.',
    },
    connections: {
      progress: round(connect),
      meta: `${plural(concepts, 'concept')} · ${plural(citations, 'record')} cite it`,
      next: citations ? 'See what this source changed.' : 'Link a concept or cite it from a position or inquiry.',
    },
  };
}

/** The first step still under three quarters done: where to go next. */
export function nextSourceJourneyStep(state: Record<SourceJourneyStep, SourceJourneyState>): SourceJourneyStep | null {
  return (['overview', 'capture', 'annotations', 'connections'] as const).find((step) => state[step].progress < 0.75) || null;
}
