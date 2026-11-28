import type { ReadingSession } from './types';

export const SOURCE_SESSION_REFLECTION_PROMPTS = [
  { key: 'takeaway', label: 'What stood out in this session?', contextLabel: 'Takeaway' },
  { key: 'effect', label: 'What did it confirm, challenge, or clarify?', contextLabel: 'Effect on thinking' },
  { key: 'openQuestion', label: 'What question will you carry into the next session?', contextLabel: 'Open question' },
] as const;

export function sourceSessionReflectionEntries(reflection?: ReadingSession['reflection']) {
  return SOURCE_SESSION_REFLECTION_PROMPTS.flatMap(({ key, contextLabel }) => {
    const value = reflection?.[key]?.trim();
    return value ? [{ key, label: contextLabel, value }] : [];
  });
}

export function sourceSessionDate(session: ReadingSession) {
  return session.endedAt || session.date || session.startedAt || '';
}

export function sourceSessionSeconds(session: ReadingSession | null, now = Date.now()) {
  if (!session?.startedAt) return 0;
  const start = Date.parse(session.startedAt);
  const end = session.status === 'paused' && session.pauseStartedAt ? Date.parse(session.pauseStartedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1_000) - (session.totalPausedSeconds || 0));
}

export function stopSourceSession(session: ReadingSession, now = new Date()): ReadingSession {
  const stopped = now.toISOString();
  const start = Date.parse(session.startedAt || '');
  return {
    ...session,
    endedAt: stopped,
    date: stopped,
    durationSeconds: sourceSessionSeconds(session, now.getTime()),
    totalElapsedSeconds: Number.isFinite(start) ? Math.max(0, Math.floor((now.getTime() - start) / 1_000)) : 0,
    status: 'completed',
    updatedAt: stopped,
  };
}

export function sourceSessionExcerpt(session: ReadingSession) {
  const context = [
    session.intent?.trim() && `Preparation: ${session.intent.trim()}`,
    ...sourceSessionReflectionEntries(session.reflection).map(({ label, value }) => `${label}: ${value}`),
    session.notes?.trim() && `Reflection: ${session.notes.trim()}`,
  ].filter(Boolean);
  return context.length ? `Source session (${session.section?.trim() || 'whole source'}): ${context.join(' | ')}` : '';
}

export function recentSourceSessionExcerpts(sessions: readonly ReadingSession[] = []) {
  return [...sessions]
    .sort((a, b) => (Date.parse(sourceSessionDate(b)) || 0) - (Date.parse(sourceSessionDate(a)) || 0))
    .map(sourceSessionExcerpt).filter(Boolean).slice(0, 4);
}
