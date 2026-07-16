"use client";

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardCheck,
  Compass,
  HelpCircle,
  Lightbulb,
  PenTool,
  Repeat,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageEmptyState } from '@/components/shared/PageState';
import { allAnnotations } from '@/lib/readex';
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
}

function recentDate(value?: string) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firstName(profile: UserProfile) {
  const label = profile.displayName || profile.email || 'there';
  return label.split(/\s+/)[0] || 'there';
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
      .filter((item) => item.status === 'active' && !(item.logDates || []).includes(todayKey()))
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
      .filter((item) => item.status !== 'final' && ((item.beliefIds || []).length > 0 || (item.questionIds || []).length > 0))
      .forEach((item) => items.push({
          id: `work-${item.id}`,
          label: item.title,
          eyebrow: 'Work still forming',
          reason: 'This work is linked to live ideas but has not reached a final state.',
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
  }, [inquiries, positions, provocationAngle]);

  const pulse = useMemo(() => {
    if (positions.length > inquiries.length + 2) {
      return 'You have more stated positions than active inquiries. This may be a good moment to add opposition or reopen a question.';
    }
    if (annotations.filter((item) => !item.philosophyStatus || item.philosophyStatus === 'raw').length > 4) {
      return 'Your capture layer is growing faster than your interpretation layer. Several annotations are still waiting to become concepts, inquiries, or evidence.';
    }
    if (practices.length < Math.max(1, Math.floor(positions.length / 4))) {
      return 'Your belief layer is ahead of your testing layer. A position may be ready to become a practice.';
    }
    if (thinkingEvents.length) {
      return 'Recent activity shows meaningful movement. Evolution can now explain what changed instead of only listing what happened.';
    }
    return 'Noesis becomes more useful as sources, questions, positions, works, and practices begin to affect each other.';
  }, [annotations, inquiries.length, positions.length, practices.length, thinkingEvents.length]);

  const recentMovement = useMemo(() => {
    const events = thinkingEvents.length
      ? thinkingEvents
          .slice()
          .sort((a, b) => recentDate(b.createdAt) - recentDate(a.createdAt))
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            title: item.summary,
            meta: item.eventType.replace(/_/g, ' '),
            date: item.createdAt,
          }))
      : timeline
          .slice()
          .sort((a, b) => recentDate(b.date) - recentDate(a.date))
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            title: `${item.entityTitle}: ${item.reason || item.eventType}`,
            meta: item.eventType,
            date: item.date,
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
  ];

  const hasWorkspace = media.length + concepts.length + inquiries.length + positions.length + works.length + practices.length > 0;

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
    <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${firstName(profile)}.`}
        description={currentThemes.length
          ? `Your recent work is circling ${currentThemes.join(', ')}. Home shows the unfinished edges worth returning to.`
          : 'Home shows the unfinished edges of your thinking and routes you into the next useful act.'}
        actions={(
          <Button onClick={() => onNavigate({ view: 'library' })} className="rounded-full">
            <Sparkles className="mr-2 size-4" />
            Capture Something
          </Button>
        )}
        meta={currentThemes.map((theme) => (
          <Badge key={theme} variant="outline" className="rounded-full">{theme}</Badge>
        ))}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <section className="space-y-5">
          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Continue Thinking</div>
                <h2 className="mt-1 font-headline text-2xl font-semibold italic text-foreground/80">The next three edges</h2>
              </div>
              <Badge variant="secondary" className="rounded-full">{continueItems.length} active</Badge>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
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
            <div className="grid gap-3">
              {continueItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate({ view: item.view, targetId: item.targetId })}
                    className="group rounded-2xl border border-border bg-background/70 p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="flex gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-accent">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{item.eyebrow}</div>
                        <div className="mt-1 font-medium text-foreground">{item.label}</div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.reason}</p>
                      </div>
                      <div className="hidden items-center gap-1 text-xs font-medium text-accent sm:flex">
                        {item.action}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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
                      <Button size="sm" onClick={() => onNavigate(provocation.target)} className="rounded-full">Work on this</Button>
                      <Button size="sm" variant="outline" onClick={() => onNavigate({ view: 'questions' })} className="rounded-full">Turn into inquiry</Button>
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
                        Different angle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setProvocationDismissed(true)} className="rounded-full">Dismiss</Button>
                    </div>
                    <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
                      <div className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">If irrelevant, why?</div>
                      <Textarea
                        value={irrelevantReason}
                        onChange={(event) => setIrrelevantReason(event.target.value)}
                        placeholder="Explain why this prompt misses the mark. This stays local for now."
                        className="mt-2 min-h-[64px] rounded-xl border-border/70 bg-card"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Intellectual Pulse</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{pulse}</p>
            <Button variant="outline" size="sm" onClick={() => onNavigate({ view: 'evolution' })} className="mt-4 rounded-full">
              Open Evolution
            </Button>
          </Card>

          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="mb-3 font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quiet Signals</div>
            <div className="space-y-2">
              {quietSignals.map((signal) => (
                <button
                  key={signal.label}
                  onClick={() => onNavigate(signal.target)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <span className="text-sm text-muted-foreground">{signal.label}</span>
                  <Badge variant={signal.value ? 'secondary' : 'outline'} className="rounded-full">{signal.value}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-border bg-card p-5">
            <div className="mb-3 font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recent Movement</div>
            <div className="space-y-3">
              {recentMovement.length ? recentMovement.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="text-sm font-medium text-foreground/80">{item.title}</div>
                  <div className="mt-1 font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{item.meta}</div>
                </div>
              )) : (
                <p className="text-sm leading-6 text-muted-foreground">Meaningful changes will appear here after positions, inquiries, concepts, works, or practices move.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
