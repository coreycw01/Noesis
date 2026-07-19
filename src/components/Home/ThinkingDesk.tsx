"use client";

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  Brain,
  ClipboardCheck,
  Compass,
  GitBranch,
  HelpCircle,
  Lightbulb,
  PenTool,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageEmptyState } from '@/components/shared/PageState';
import { allAnnotations } from '@/lib/readex';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import type {
  Concept,
  Draft,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  ThinkingEvent,
  TimelineEvent,
  Unknown,
  UserProfile,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

type HomeTarget = {
  view: NoesisView;
  targetId?: string | null;
};

type DeskItem = HomeTarget & {
  id: string;
  label: string;
  eyebrow: string;
  reason: string;
  action: string;
  priority: number;
  icon: React.ComponentType<{ className?: string }>;
};

type HomeMode = 'continue' | 'challenge' | 'unfinished' | 'recent' | 'neglected' | 'rediscover';

type PulseObservation = HomeTarget & {
  id: string;
  title: string;
  observation: string;
  evidence: string;
  tone: 'pressure' | 'balance' | 'movement';
};

const HOME_MODES: Array<{ id: HomeMode; label: string; description: string }> = [
  { id: 'continue', label: 'Continue', description: 'Return to the strongest next action.' },
  { id: 'challenge', label: 'Challenge Me', description: 'Find claims that need opposition.' },
  { id: 'unfinished', label: 'Unfinished', description: 'Surface incomplete captures and open work.' },
  { id: 'recent', label: 'Recently Changed', description: 'Reopen what moved lately.' },
  { id: 'neglected', label: 'Neglected', description: 'Find important objects that have gone quiet.' },
  { id: 'rediscover', label: 'Random Rediscovery', description: 'Bring back something worth seeing again.' },
];

interface ThinkingDeskProps {
  profile: UserProfile;
  concepts: Concept[];
  media: Media[];
  inquiries: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  timeline: TimelineEvent[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  links: PhilosophicalLink[];
  onNavigate: (target: HomeTarget) => void;
  onCreateInquiry?: (data: Partial<Question>) => Question;
}

function recentDate(value?: string) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function practiceLogDates(practice: Practice) {
  const structured = (practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date.slice(0, 10));
  return Array.from(new Set([...(practice.logDates || []), ...structured])).sort();
}

function firstName(profile: UserProfile) {
  const label = profile.displayName || profile.email || 'there';
  return label.split(/\s+/)[0] || 'there';
}

function targetFromEvent(event: ThinkingEvent | TimelineEvent): HomeTarget | null {
  const entityType = 'entityType' in event ? event.entityType : '';
  const entityId = 'entityId' in event ? event.entityId : '';
  if (!entityId) return null;
  if (entityType === 'vault' || entityType === 'position') return { view: 'vault', targetId: entityId };
  if (entityType === 'question' || entityType === 'inquiry') return { view: 'questions', targetId: entityId };
  if (entityType === 'media' || entityType === 'source') return { view: 'library', targetId: entityId };
  if (entityType === 'draft' || entityType === 'work') return { view: 'writing', targetId: entityId };
  if (entityType === 'practice') return { view: 'practices', targetId: entityId };
  if (entityType === 'concept') return { view: 'concepts', targetId: entityId };
  return null;
}

export function ThinkingDesk({
  profile,
  concepts,
  media,
  inquiries,
  positions,
  works,
  practices,
  timeline,
  thinkingEvents,
  unknowns,
  links,
  onNavigate,
  onCreateInquiry,
}: ThinkingDeskProps) {
  const [mode, setMode] = useState<HomeMode>('continue');
  const [provocationAngle, setProvocationAngle] = useState(0);
  const [briefAnswer, setBriefAnswer] = useState('');
  const [irrelevantReason, setIrrelevantReason] = useState('');
  const [provocationDismissed, setProvocationDismissed] = useState(false);
  const annotations = useMemo(() => allAnnotations(media), [media]);
  const currentThemes = useMemo(() => {
    const terms = new Map<string, number>();
    [...positions.flatMap((item) => item.tags || []), ...media.flatMap((item) => item.tags || []), ...works.flatMap((item) => item.conceptTags || [])]
      .filter(Boolean)
      .forEach((term) => terms.set(term, (terms.get(term) || 0) + 1));
    return Array.from(terms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([term]) => term);
  }, [media, positions, works]);

  const continueItems = useMemo<DeskItem[]>(() => {
    const items: DeskItem[] = [];
    const addPositionPressure = (priority = 95) => positions
      .filter((item) => item.status !== 'abandoned' && item.status !== 'rejected' && ((item.evidenceAgainst || []).length === 0 || (item.sourceIds || []).length === 0))
      .forEach((item) => items.push({
          id: `position-${item.id}`,
          label: item.title || item.statement,
          eyebrow: (item.evidenceAgainst || []).length === 0 ? 'Position needs opposition' : 'Position needs evidence',
          reason: (item.evidenceAgainst || []).length === 0
            ? 'This position has not faced a serious recorded objection yet.'
            : 'This position needs clearer source evidence before it should feel stable.',
          action: 'Open position',
          priority,
          icon: ShieldCheck,
          view: 'vault',
          targetId: item.id,
        } as DeskItem));

    const addOpenInquiries = (priority = 88) => inquiries
      .filter((item) => !item.answer && !['answered', 'resolved', 'archived'].includes(item.status))
      .forEach((item) => items.push({
          id: `inquiry-${item.id}`,
          label: item.text,
          eyebrow: 'Inquiry awaiting development',
          reason: 'This question is still open and can collect evidence, assumptions, or a working answer.',
          action: 'Investigate',
          priority,
          icon: HelpCircle,
          view: 'questions',
          targetId: item.id,
        } as DeskItem));

    const addSourceReflection = (priority = 82) => media
      .filter((item) => item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange)
      .forEach((item) => items.push({
          id: `source-${item.id}`,
          label: item.title,
          eyebrow: 'Source awaiting reflection',
          reason: 'This source is finished, but its after-reading reflection is still thin.',
          action: 'Reflect on source',
          priority,
          icon: BookOpen,
          view: 'library',
          targetId: item.id,
        } as DeskItem));

    const addPracticeLogs = (priority = 76) => practices
      .filter((item) => item.status === 'active' && !practiceLogDates(item).includes(todayKey()))
      .forEach((item) => items.push({
          id: `practice-${item.id}`,
          label: item.title,
          eyebrow: 'Practice awaiting observation',
          reason: 'This active practice has no log for today, so its lived evidence may go missing.',
          action: 'Log practice',
          priority,
          icon: Repeat,
          view: 'practices',
          targetId: item.id,
        } as DeskItem));

    const addOpenWorks = (priority = 68) => works
      .filter((item) => item.status !== 'final' && ((item.beliefIds || []).length > 0 || (item.questionIds || []).length > 0 || (item.argumentSkeleton?.objections || []).length === 0))
      .forEach((item) => items.push({
          id: `work-${item.id}`,
          label: item.title,
          eyebrow: 'Work still forming',
          reason: (item.argumentSkeleton?.objections || []).length === 0
            ? 'This work has not recorded a serious objection or counter-pressure yet.'
            : 'This work is linked to live ideas but has not reached a final state.',
          action: 'Continue work',
          priority,
          icon: PenTool,
          view: 'writing',
          targetId: item.id,
        } as DeskItem));

    const addUndefinedConcepts = (priority = 62) => concepts
      .filter((item) => !item.description || item.philosophyStatus === 'undefined')
      .forEach((item) => items.push({
          id: `concept-${item.id}`,
          label: item.name,
          eyebrow: 'Concept needs definition',
          reason: 'This concept appears in the system without a working definition.',
          action: 'Clarify concept',
          priority,
          icon: Lightbulb,
          view: 'concepts',
          targetId: item.id,
        } as DeskItem));

    if (mode === 'challenge') {
      addPositionPressure(100);
      positions
        .filter((item) => item.status !== 'abandoned' && (item.confidence || 0) >= 4 && (item.evidenceAgainst || []).length < 2)
        .forEach((item) => items.push({
          id: `challenge-${item.id}`,
          label: item.title || item.statement,
          eyebrow: 'High confidence, low opposition',
          reason: 'This belief may need a stronger opposing case before it deserves confidence.',
          action: 'Stress test',
          priority: 92,
          icon: ShieldCheck,
          view: 'vault',
          targetId: item.id,
        } as DeskItem));
    } else if (mode === 'unfinished') {
      addOpenInquiries(96);
      addSourceReflection(90);
      addOpenWorks(84);
      addPracticeLogs(78);
    } else if (mode === 'recent') {
      [
        ...positions.map((item) => ({ id: item.id, label: item.title || item.statement, date: item.dateUpdated || item.dateCreated, view: 'vault' as NoesisView, icon: ShieldCheck, type: 'Position' })),
        ...inquiries.map((item) => ({ id: item.id, label: item.text, date: item.dateUpdated || item.dateCreated, view: 'questions' as NoesisView, icon: HelpCircle, type: 'Inquiry' })),
        ...works.map((item) => ({ id: item.id, label: item.title, date: item.dateUpdated || item.dateCreated, view: 'writing' as NoesisView, icon: PenTool, type: 'Work' })),
        ...media.map((item) => ({ id: item.id, label: item.title, date: item.dateUpdated || item.dateAdded, view: 'library' as NoesisView, icon: BookOpen, type: 'Source' })),
      ]
        .sort((a, b) => recentDate(b.date) - recentDate(a.date))
        .slice(0, 6)
        .forEach((item, index) => items.push({
          id: `recent-${item.view}-${item.id}`,
          label: item.label,
          eyebrow: `${item.type} recently changed`,
          reason: 'This object moved recently and may deserve a follow-up before the thread cools.',
          action: 'Reopen',
          priority: 90 - index,
          icon: item.icon,
          view: item.view,
          targetId: item.id,
        } as DeskItem));
    } else if (mode === 'neglected') {
      const staleCutoff = Date.now() - 1000 * 60 * 60 * 24 * 45;
      [
        ...positions.map((item) => ({ id: item.id, label: item.title || item.statement, date: item.dateUpdated || item.dateCreated, view: 'vault' as NoesisView, icon: ShieldCheck, type: 'Position' })),
        ...inquiries.map((item) => ({ id: item.id, label: item.text, date: item.dateUpdated || item.dateCreated, view: 'questions' as NoesisView, icon: HelpCircle, type: 'Inquiry' })),
        ...concepts.map((item) => ({ id: item.id, label: item.name, date: item.dateUpdated || item.dateCreated, view: 'concepts' as NoesisView, icon: Lightbulb, type: 'Concept' })),
      ]
        .filter((item) => (recentDate(item.date) || 0) < staleCutoff)
        .sort((a, b) => recentDate(a.date) - recentDate(b.date))
        .slice(0, 6)
        .forEach((item, index) => items.push({
          id: `neglected-${item.view}-${item.id}`,
          label: item.label,
          eyebrow: `${item.type} gone quiet`,
          reason: 'This object has not seen meaningful movement in a while.',
          action: 'Revisit',
          priority: 85 - index,
          icon: item.icon,
          view: item.view,
          targetId: item.id,
        } as DeskItem));
    } else if (mode === 'rediscover') {
      const pool = [
        ...concepts.map((item) => ({ id: item.id, label: item.name, view: 'concepts' as NoesisView, icon: Lightbulb, type: 'Concept' })),
        ...media.map((item) => ({ id: item.id, label: item.title, view: 'library' as NoesisView, icon: BookOpen, type: 'Source' })),
        ...works.map((item) => ({ id: item.id, label: item.title, view: 'writing' as NoesisView, icon: PenTool, type: 'Work' })),
      ];
      pool
        .filter((_, index) => index % 3 === new Date().getDate() % 3)
        .slice(0, 6)
        .forEach((item, index) => items.push({
          id: `rediscover-${item.view}-${item.id}`,
          label: item.label,
          eyebrow: `Rediscover ${item.type.toLowerCase()}`,
          reason: 'This is a low-pressure rediscovery path back into your older material.',
          action: 'Rediscover',
          priority: 70 - index,
          icon: item.icon,
          view: item.view,
          targetId: item.id,
        } as DeskItem));
    } else {
      addPositionPressure();
      addOpenInquiries();
      addSourceReflection();
      addPracticeLogs();
      addOpenWorks();
      addUndefinedConcepts();
    }

    return items
      .sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label))
      .slice(0, 3);
  }, [concepts, inquiries, media, mode, positions, practices, works]);

  const provocation = useMemo(() => {
    const untested = positions.find((position) => position.status !== 'abandoned' && !practices.some((practice) => (practice.positionIds || []).includes(position.id)));
    if (untested && provocationAngle === 0) {
      return {
        question: `What would it look like to test "${untested.title || untested.statement}" in behavior this week?`,
        target: { view: 'practices' as NoesisView },
        evidence: 'Based on a position with no linked practice or lived test.',
      };
    }
    const angles = [
      {
        question: 'Which idea in your system deserves to be tested in practice instead of only refined in thought?',
        target: { view: 'practices' as NoesisView },
        evidence: 'Based on the gap between positions and linked practices.',
      },
      {
        question: 'What belief would become weaker if you required one serious opposing source?',
        target: { view: 'vault' as NoesisView },
        evidence: 'Based on positions with limited recorded challenge.',
      },
      {
        question: 'Which open question is actually waiting for a definition, not more information?',
        target: { view: 'questions' as NoesisView },
        evidence: 'Based on open inquiries and undefined concepts.',
      },
    ];
    const unsupported = positions.find((item) => item.status !== 'abandoned' && (item.evidenceAgainst || []).length === 0);
    if (unsupported && provocationAngle === 0) {
      return {
        question: `What would make your position "${unsupported.title || unsupported.statement}" less convincing?`,
        target: { view: 'vault' as NoesisView, targetId: unsupported.id },
        evidence: 'Based on a position with no recorded challenging evidence.',
      };
    }
    const openInquiry = inquiries.find((item) => !item.answer && !['answered', 'resolved', 'archived'].includes(item.status));
    if (openInquiry && provocationAngle <= 1) {
      return {
        question: `What evidence would count as real progress on "${openInquiry.text}"?`,
        target: { view: 'questions' as NoesisView, targetId: openInquiry.id },
        evidence: 'Based on an open inquiry without a working answer.',
      };
    }
    return angles[provocationAngle % angles.length];
  }, [inquiries, positions, practices, provocationAngle]);

  const pulseObservations = useMemo<PulseObservation[]>(() => {
    const rawAnnotations = annotations.filter((item) => !item.philosophyStatus || item.philosophyStatus === 'raw');
    const unsupportedPositions = positions.filter((item) => item.status !== 'abandoned' && (item.sourceIds || []).length === 0 && (item.evidenceFor || []).length === 0);
    const untestedPositions = positions.filter((position) => position.status !== 'abandoned' && !practices.some((practice) => (practice.positionIds || []).includes(position.id)));
    const openInquiries = inquiries.filter((item) => !item.answer && !['answered', 'resolved', 'archived'].includes(item.status));
    const finishedUnreflectedSources = media.filter((item) => item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange);
    const observations: PulseObservation[] = [];

    if (positions.length > inquiries.length + 2) {
      observations.push({
        id: 'positions-ahead-of-inquiries',
        title: 'Judgment is ahead of questioning',
        observation: 'You have more stated positions than active inquiries. This may be a good moment to add opposition or reopen a question.',
        evidence: `${positions.length} positions vs ${inquiries.length} inquiries`,
        tone: 'pressure',
        view: 'vault',
      });
    }
    if (rawAnnotations.length > 4) {
      observations.push({
        id: 'raw-annotations',
        title: 'Capture is outrunning interpretation',
        observation: 'Several annotations are still waiting to become concepts, inquiries, positions, or evidence.',
        evidence: `${rawAnnotations.length} raw annotations across ${new Set(rawAnnotations.map((item) => item.source.id)).size} sources`,
        tone: 'pressure',
        view: 'annotations',
      });
    }
    if (practices.length < Math.max(1, Math.floor(positions.length / 4))) {
      observations.push({
        id: 'beliefs-ahead-of-tests',
        title: 'Belief is ahead of testing',
        observation: 'Your belief layer is ahead of your testing layer. A position may be ready to become a practice.',
        evidence: `${untestedPositions.length} positions have no linked practice`,
        tone: 'balance',
        view: 'practices',
      });
    }
    if (finishedUnreflectedSources.length) {
      observations.push({
        id: 'finished-sources',
        title: 'Sources need after-reading judgment',
        observation: 'Some finished sources still need reflection before they can change the rest of the system.',
        evidence: `${finishedUnreflectedSources.length} finished sources without a core argument or belief-change note`,
        tone: 'pressure',
        view: 'library',
        targetId: finishedUnreflectedSources[0]?.id,
      });
    }
    if (openInquiries.length) {
      observations.push({
        id: 'open-inquiries',
        title: 'Questions are still live',
        observation: 'Your inquiry layer has unresolved questions that could become evidence requests, definitions, or positions.',
        evidence: `${openInquiries.length} open inquiries without a working answer`,
        tone: 'movement',
        view: 'questions',
        targetId: openInquiries[0]?.id,
      });
    }
    if (thinkingEvents.length) {
      observations.push({
        id: 'meaningful-events',
        title: 'There is traceable movement',
        observation: 'Recent activity shows meaningful movement. Evolution can now explain what changed instead of only listing what happened.',
        evidence: `${thinkingEvents.length} thinking events recorded`,
        tone: 'movement',
        view: 'evolution',
      });
    }
    if (!observations.length) {
      observations.push({
        id: 'first-links',
        title: 'Build the chain',
        observation: 'Noesis becomes more useful as sources, questions, positions, works, and practices begin to affect each other.',
        evidence: `${links.length} relationships currently recorded`,
        tone: 'balance',
        view: 'atlas',
      });
    }
    return observations.slice(0, 3);
  }, [annotations, inquiries, links.length, media, positions, practices, thinkingEvents.length]);

  const recentMovement = useMemo(() => {
    const events = thinkingEvents.length
      ? thinkingEvents
          .slice()
          .sort((a, b) => recentDate(b.createdAt) - recentDate(a.createdAt))
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.summary,
            meta: item.eventType.replace(/_/g, ' '),
            date: item.createdAt,
            target: targetFromEvent(item),
          }))
      : timeline
          .slice()
          .sort((a, b) => recentDate(b.date) - recentDate(a.date))
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: `${item.entityTitle}: ${item.reason || item.eventType}`,
            meta: item.eventType,
            date: item.date,
            target: targetFromEvent(item),
          }));
    return events;
  }, [thinkingEvents, timeline]);

  const quietSignals = [
    {
      label: 'Unprocessed annotations',
      value: annotations.filter((item) => !item.philosophyStatus || item.philosophyStatus === 'raw').length,
      target: { view: 'annotations' as NoesisView },
    },
    {
      label: 'Unsupported positions',
      value: positions.filter((item) => item.status !== 'abandoned' && (item.sourceIds || []).length === 0 && (item.evidenceFor || []).length === 0).length,
      target: { view: 'vault' as NoesisView },
    },
    {
      label: 'Open unknowns',
      value: unknowns.filter((item) => item.status === 'active' || item.status === 'exploring').length,
      target: { view: 'profile' as NoesisView },
    },
    {
      label: 'Untested positions',
      value: positions.filter((position) => position.status !== 'abandoned' && !practices.some((practice) => (practice.positionIds || []).includes(position.id))).length,
      target: { view: 'practices' as NoesisView },
    },
    {
      label: 'Finished sources needing reflection',
      value: media.filter((item) => item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange).length,
      target: { view: 'library' as NoesisView },
    },
  ];
  const visibleQuietSignals = quietSignals.filter((signal) => signal.value > 0).slice(0, 3);
  const primaryEdge = continueItems[0] || null;
  const secondaryEdges = continueItems.slice(1, 3);

  const hasWorkspace = media.length + concepts.length + inquiries.length + positions.length + works.length + practices.length > 0;

  const previewOrNavigate = (
    target: HomeTarget,
    fallback?: {
      label?: string;
      description?: string;
      reason?: string;
      section?: string;
      state?: string;
      stage?: 'Encounter' | 'Capture' | 'Interpret' | 'Question' | 'Judge' | 'Express' | 'Test' | 'Revise' | 'Understand' | 'Navigate' | 'Configure';
    }
  ) => {
    if (!target.targetId) {
      onNavigate(target);
      return;
    }

    if (target.view === 'vault') {
      const position = positions.find((item) => item.id === target.targetId);
      if (position) {
        openNoesisObjectPreview({
          id: `home-position-${position.id}`,
          label: position.title || position.statement,
          section: 'Position',
          description: fallback?.description || position.status || 'Open position workbench.',
          view: 'vault',
          targetId: position.id,
          targetType: 'position',
          objectType: 'Judgment Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Judge',
          hierarchyLevel: 'Judgment',
          currentState: position.status,
          summary: position.statement || position.description || fallback?.reason || 'A position needing attention.',
          matchedBecause: fallback?.reason || 'Home selected this position as an unfinished intellectual edge.',
          connectedConcepts: position.tags || [],
          relatedObjects: [
            `${position.sourceIds?.length || 0} sources`,
            `${(position.evidenceFor || []).length} supports`,
            `${(position.evidenceAgainst || []).length} challenges`,
            `${practices.filter((practice) => (practice.positionIds || []).includes(position.id)).length} practices`,
          ],
          lastChangedAt: position.dateUpdated || position.dateCreated,
          quickActionLabel: fallback?.label || 'Open Position',
          quickActions: [
            { label: 'Open Position Workbench', view: 'vault', targetId: position.id, targetType: 'position' },
            { label: 'View Evolution', view: 'evolution' },
          ],
          thinkingEventHint: 'Previewing a position is orientation. Support, challenge, confidence changes, stress tests, abandonment, and revision should create events.',
        });
        return;
      }
    }

    if (target.view === 'questions') {
      const inquiry = inquiries.find((item) => item.id === target.targetId);
      if (inquiry) {
        openNoesisObjectPreview({
          id: `home-inquiry-${inquiry.id}`,
          label: inquiry.text,
          section: 'Inquiry',
          description: fallback?.description || inquiry.status || 'Open inquiry workspace.',
          view: 'questions',
          targetId: inquiry.id,
          targetType: 'inquiry',
          objectType: 'Interpretive Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Question',
          hierarchyLevel: 'Interpretive',
          currentState: inquiry.status,
          summary: inquiry.answer || fallback?.reason || 'An inquiry needing development.',
          matchedBecause: fallback?.reason || 'Home selected this inquiry as an open investigation.',
          connectedConcepts: concepts.filter((concept) => inquiry.conceptIds?.includes(concept.id)).map((concept) => concept.name),
          relatedObjects: [
            `${inquiry.sourceIds?.length || 0} sources`,
            `${inquiry.beliefIds?.length || 0} positions`,
            `${inquiry.draftIds?.length || 0} works`,
          ],
          lastChangedAt: inquiry.dateUpdated || inquiry.dateCreated,
          quickActionLabel: fallback?.label || 'Open Inquiry',
          quickActions: [
            { label: 'Open Investigation', view: 'questions', targetId: inquiry.id, targetType: 'inquiry' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing an inquiry is orientation. Reformulating, adding assumptions, resolving, or promoting it should create history.',
        });
        return;
      }
    }

    if (target.view === 'library') {
      const source = media.find((item) => item.id === target.targetId);
      if (source) {
        openNoesisObjectPreview({
          id: `home-source-${source.id}`,
          label: source.title,
          section: 'Source',
          description: fallback?.description || source.creator || source.type || 'Open source workspace.',
          view: 'library',
          targetId: source.id,
          targetType: 'source',
          objectType: 'Raw Input',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Encounter',
          hierarchyLevel: 'Raw',
          currentState: source.status,
          summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.openQuestion || fallback?.reason || 'A source needing reflection.',
          matchedBecause: fallback?.reason || 'Home selected this source as a source-work item.',
          connectedConcepts: source.tags || [],
          relatedObjects: [
            `${source.annotations?.length || 0} annotations`,
            `${positions.filter((position) => (position.sourceIds || []).includes(source.id)).length} positions influenced`,
            `${works.filter((work) => (work.sourceIds || []).includes(source.id)).length} works linked`,
          ],
          lastChangedAt: source.dateUpdated || source.dateAdded,
          quickActionLabel: fallback?.label || 'Open Source',
          quickActions: [
            { label: 'Open Source Workspace', view: 'library', targetId: source.id, targetType: 'source' },
            { label: 'Process Annotations', view: 'annotations' },
          ],
          thinkingEventHint: 'Previewing a source is orientation. Completing reflection, distilling a claim, or creating annotations should record intellectual development.',
        });
        return;
      }
    }

    if (target.view === 'writing') {
      const work = works.find((item) => item.id === target.targetId);
      if (work) {
        openNoesisObjectPreview({
          id: `home-work-${work.id}`,
          label: work.title,
          section: 'Work',
          description: fallback?.description || `${work.type.replace(/_/g, ' ')} - ${work.status}`,
          view: 'writing',
          targetId: work.id,
          targetType: 'work',
          objectType: 'Expression Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Express',
          hierarchyLevel: 'Expression',
          currentState: work.status,
          summary: work.body || work.draftContent || fallback?.reason || 'A work needing continuation.',
          matchedBecause: fallback?.reason || 'Home selected this work as unfinished expression.',
          connectedConcepts: work.conceptTags || [],
          relatedObjects: [
            `${work.sourceIds?.length || 0} sources`,
            `${work.questionIds?.length || 0} inquiries`,
            `${work.beliefIds?.length || 0} positions`,
          ],
          lastChangedAt: work.dateUpdated || work.dateCreated,
          quickActionLabel: fallback?.label || 'Open Work',
          quickActions: [
            { label: 'Open Work Studio', view: 'writing', targetId: work.id, targetType: 'work' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing a work is orientation. Completing, substantially revising, or synthesizing linked ideas should record a thinking event.',
        });
        return;
      }
    }

    if (target.view === 'practices') {
      const practice = practices.find((item) => item.id === target.targetId);
      if (practice) {
        openNoesisObjectPreview({
          id: `home-practice-${practice.id}`,
          label: practice.title,
          section: 'Practice',
          description: fallback?.description || `${practice.type.replace(/_/g, ' ')} - ${practice.status}`,
          view: 'practices',
          targetId: practice.id,
          targetType: 'practice',
          objectType: 'Experiment Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Test',
          hierarchyLevel: 'Expression',
          currentState: practice.status,
          summary: practice.description || practice.notes || fallback?.reason || 'A practice needing observation.',
          matchedBecause: fallback?.reason || 'Home selected this practice as lived evidence that needs attention.',
          connectedConcepts: practice.conceptTags || [],
          relatedObjects: [
            `${practice.positionIds?.length || 0} positions tested`,
            `${practice.questionIds?.length || 0} inquiries`,
            `${practice.logDates?.length || 0} logs`,
          ],
          lastChangedAt: practice.dateUpdated || practice.dateCreated,
          quickActionLabel: fallback?.label || 'Open Practice',
          quickActions: [
            { label: 'Open Practice Field', view: 'practices', targetId: practice.id, targetType: 'practice' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing a practice is orientation. Starting, concluding, or logging an outcome that affects a belief should create history.',
        });
        return;
      }
    }

    onNavigate(target);
  };

  const turnProvocationIntoInquiry = () => {
    const created = onCreateInquiry?.({
      text: provocation.question,
      whyItMatters: provocation.evidence,
      currentIntuition: [
        briefAnswer.trim(),
        irrelevantReason.trim() ? `This prompt may miss because: ${irrelevantReason.trim()}` : '',
      ].filter(Boolean).join('\n\n'),
      status: 'open',
      type: 'manual',
      sourceDocumentId: provocation.target.targetId || '',
    });
    setBriefAnswer('');
    setIrrelevantReason('');
    onNavigate({ view: 'questions', targetId: created?.id });
  };

  if (!hasWorkspace) {
    return (
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <PageHeader
          title="Home"
          description="Noesis becomes useful when it has something real to think with."
        />
        <PageEmptyState
          icon={Compass}
          title="Start with one real thought"
          description="Add a source, ask a question, or state something you currently believe. Home will begin prioritizing the next intellectual action after that."
          belongsHere="Unfinished sources, inquiries, positions, works, practices, and changes that deserve attention now."
          whyItMatters="Home is the thinking desk. It cannot prioritize your philosophy until the system has at least one real object to work from."
          firstAction="Add one source, ask one inquiry, or state one position. The rest of the workspace can grow from that."
          action={(
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => onNavigate({ view: 'library' })}>Add Source</Button>
              <Button variant="outline" onClick={() => onNavigate({ view: 'questions' })}>Ask Inquiry</Button>
              <Button variant="outline" onClick={() => onNavigate({ view: 'vault' })}>State Position</Button>
            </div>
          )}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        <PageHeader
          title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${firstName(profile)}.`}
          description={currentThemes.length
            ? `Your recent thinking is converging around ${currentThemes.join(', ')}.`
            : 'Home chooses the next useful act from your unfinished thinking.'}
          actions={(
            <Button onClick={() => onNavigate({ view: 'library' })} className="rounded-full">
              <Sparkles className="mr-2 size-4" />
              Capture
            </Button>
          )}
          meta={currentThemes.length ? [
            <span key="focus-label" className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Current focus</span>,
            ...currentThemes.map((theme) => (
              <Badge key={theme} variant="outline" className="rounded-full">{theme}</Badge>
            )),
          ] : undefined}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <section className="space-y-5">
            <Card className="rounded-2xl border-border bg-card p-5 md:p-6">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Primary Focus</div>
                  <h2 className="mt-1 font-headline text-3xl font-semibold italic text-foreground/85">Continue this thought</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HOME_MODES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMode(item.id)}
                      title={item.description}
                      className={`rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-[0.14em] transition-colors ${
                        mode === item.id
                          ? 'border-accent bg-accent text-accent-foreground'
                          : 'border-border bg-background/60 text-muted-foreground hover:border-accent/40 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {primaryEdge ? (() => {
                const Icon = primaryEdge.icon;
                return (
                  <button
                    onClick={() => previewOrNavigate({ view: primaryEdge.view, targetId: primaryEdge.targetId }, { label: primaryEdge.action, description: primaryEdge.eyebrow, reason: primaryEdge.reason })}
                    className="group w-full rounded-3xl border border-accent/20 bg-accent/5 p-5 text-left transition-colors hover:border-accent/50 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-ring md:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-card text-accent">
                        <Icon className="size-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-code text-[9px] uppercase tracking-[0.18em] text-accent">{primaryEdge.eyebrow}</div>
                        <div className="mt-2 max-w-3xl font-headline text-2xl font-semibold leading-tight text-foreground">{primaryEdge.label}</div>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                          <span className="font-medium text-foreground/75">Why now:</span> {primaryEdge.reason}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                          {primaryEdge.action}
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })() : (
                <div className="rounded-2xl border border-dashed border-border bg-background/60 p-5">
                  <div className="flex gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-accent">
                      <Compass className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">No active edge in this mode</div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        This filter has nothing urgent right now. Capture a source, open an inquiry, or switch modes to rediscover older material.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {secondaryEdges.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {secondaryEdges.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => previewOrNavigate({ view: item.view, targetId: item.targetId }, { label: item.action, description: item.eyebrow, reason: item.reason })}
                        className="group rounded-2xl border border-border bg-background/70 p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <div className="flex gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-accent">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{item.eyebrow}</div>
                            <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{item.label}</div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Brain className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Today's Provocation</div>
                {provocationDismissed ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/60 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Provocation dismissed for now. Home will keep prioritizing unfinished work without treating this as intellectual progress.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProvocationDismissed(false)}
                      className="mt-3 rounded-full"
                    >
                      Restore Provocation
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 font-headline text-2xl italic leading-snug text-foreground/85">{provocation.question}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground/70">Why this surfaced:</span> {provocation.evidence}
                    </p>
                    <Textarea
                      value={briefAnswer}
                      onChange={(event) => setBriefAnswer(event.target.value)}
                      placeholder="Answer briefly without turning it into a full inquiry yet..."
                      className="mt-4 min-h-[88px] rounded-2xl"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={turnProvocationIntoInquiry} className="rounded-full">Respond</Button>
                      <Button size="sm" variant="outline" onClick={() => previewOrNavigate(provocation.target, { label: 'Explore further', description: 'Today provocation', reason: provocation.evidence })} className="rounded-full">Explore further</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProvocationAngle((angle) => angle + 1);
                          setBriefAnswer('');
                          setIrrelevantReason('');
                        }}
                        className="rounded-full"
                      >
                        Replace prompt
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setProvocationDismissed(true)} className="rounded-full">Not relevant</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Thinking Health</div>
                <p className="mt-1 text-xs text-muted-foreground">Three signals that deserve attention now.</p>
              </div>
              <Target className="size-4 text-accent" />
            </div>
            <div className="space-y-3">
              {pulseObservations.map((item) => (
                <button
                  key={item.id}
                  onClick={() => previewOrNavigate({ view: item.view, targetId: item.targetId }, { label: 'Open from pulse', description: item.title, reason: item.evidence })}
                  className="w-full rounded-2xl border border-border bg-background/60 p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${
                      item.tone === 'pressure' ? 'bg-destructive/10 text-destructive' : item.tone === 'movement' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.tone === 'pressure' ? <AlertTriangle className="size-4" /> : item.tone === 'movement' ? <GitBranch className="size-4" /> : <ClipboardCheck className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground/85">{item.title}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.observation}</p>
                      <div className="mt-2 font-code text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{item.evidence}</div>
                    </div>
                  </div>
                </button>
              ))}
              {visibleQuietSignals.map((signal) => (
                <button
                  key={signal.label}
                  onClick={() => previewOrNavigate(signal.target, { label: signal.label, description: 'Thinking gap', reason: `${signal.value} item(s) need attention` })}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <span className="text-sm text-muted-foreground">{signal.label}</span>
                  <Badge variant={signal.value ? 'secondary' : 'outline'} className="rounded-full">{signal.value}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recent Change</div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate({ view: 'evolution' })} className="rounded-full">View full evolution</Button>
            </div>
            <div className="space-y-3">
              {recentMovement.length ? recentMovement.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.target}
                  onClick={() => item.target && previewOrNavigate(item.target, { label: 'Open recent movement', description: item.meta, reason: item.title })}
                  className="w-full rounded-xl border border-border bg-background/60 p-3 text-left transition-colors enabled:hover:border-accent/40 enabled:hover:bg-accent/5 disabled:cursor-default"
                >
                  <div className="text-sm font-medium text-foreground/80">{item.title}</div>
                  <div className="mt-1 font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{item.meta}</div>
                </button>
              )) : (
                <p className="text-sm leading-6 text-muted-foreground">Meaningful changes will appear here after positions, inquiries, concepts, works, or practices move.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
      </div>
    </main>
  );
}

