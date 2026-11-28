"use client";

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, Flag, Lightbulb, Puzzle, RotateCcw, Settings2, Shuffle, type LucideIcon } from 'lucide-react';
import { deriveAtlasRegions } from '@/components/Atlas/atlas-diagnostics';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { ExerciseGame, QUICK_EXERCISES, type QuickExerciseId } from '@/components/Exercises/ExerciseGames';
import { Button, IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Concept, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import {
  buildThoughtGames,
  buildDefinitionRound,
  buildInquiryExercise,
  THOUGHT_GAME_KIND_LABELS,
  THOUGHT_GAME_TYPES,
  thoughtGameDayKey,
  thoughtGameFamily,
  type ThoughtGame,
  type ThoughtGameKind,
  type ThoughtGameType,
} from '@/lib/thought-games';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { readBrowserPreference, workspacePreferenceKey, writeBrowserPreference } from '@/lib/browser-preferences';

const GAME_ICONS = { inquiry: CircleHelp, definition: Lightbulb, position: Flag, source: BookOpen, reasoning: Puzzle };
const ROUND_TYPES = Object.keys(THOUGHT_GAME_TYPES) as ThoughtGameType[];
const selectClass = 'min-h-11 w-full min-w-0 rounded-[var(--button-radius)] border border-border bg-background px-3 text-foreground';

function readRotation(key: string | null) {
  try {
    const stored = key ? readBrowserPreference(key) : null;
    const values: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];
  } catch { return []; }
}

function ExerciseShuffle({ id, label, options, selected, onChange, onDeal, disabled }: {
  id: string;
  label: string;
  options: readonly { id: string; title: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onDeal: () => void;
  disabled?: boolean;
}) {
  return <div className="flex items-center gap-1">
    <Button type="button" id={id} variant="outline" size="sm" onClick={onDeal} disabled={disabled}><Shuffle aria-hidden="true" /> Surprise me</Button>
    <Popover>
      <PopoverTrigger asChild><IconButton type="button" label={`Filter ${label.toLowerCase()}`}><Settings2 aria-hidden="true" /></IconButton></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(19rem,calc(100vw-2rem))]">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">{label}</legend>
          {options.map(option => {
            const checked = selected.includes(option.id);
            return <label key={option.id} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} disabled={checked && selected.length === 1} onChange={() => {
                onChange(checked ? selected.filter(id => id !== option.id) : [...selected, option.id]);
              }} />
              {option.title}
            </label>;
          })}
        </fieldset>
      </PopoverContent>
    </Popover>
  </div>;
}

function ExerciseChoice({ id, title, hint, icon: Icon, onChoose }: { id: string; title: string; hint: string; icon: LucideIcon; onChoose: () => void }) {
  return (
    <button id={id} type="button" onClick={onChoose} className="group flex min-h-[72px] w-full min-w-0 items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card p-3 text-left hover:border-tone/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" data-tone="exercise">
      <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-panel)] bg-tone/10 text-tone"><Icon className="size-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block break-words text-sm text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-tone" aria-hidden="true" />
    </button>
  );
}

export function ExercisesTable({ concepts, inquiries, positions, media, practices, links, onNavigate }: {
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  media: Media[];
  practices: Practice[];
  links: PhilosophicalLink[];
  onNavigate: (target: { view: NoesisView; targetId?: string | null }) => void;
}) {
  const dayKey = thoughtGameDayKey();
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  const completionKey = workspacePreferenceKey(workspaceKey, `thought-games:${dayKey}`);
  const games = useMemo(() => buildThoughtGames({ concepts, inquiries, positions, media, links, dayKey }), [concepts, dayKey, inquiries, links, media, positions]);
  const [quickId, setQuickId] = useState<QuickExerciseId | null>(null);
  const [shelf, setShelf] = useState<'games' | 'rounds'>('games');
  const [gameType, setGameType] = useState<ThoughtGameType | null>(null);
  const [kind, setKind] = useState<ThoughtGameKind | null>(null);
  const [inquiryId, setInquiryId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [round, setRound] = useState<ThoughtGame[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const rotationKey = workspacePreferenceKey(workspaceKey, 'exercises:rotation');
  const roundRotationKey = workspacePreferenceKey(workspaceKey, 'exercises:round-rotation');
  const [rotation, setRotation] = useState<string[]>([]);
  const [roundRotation, setRoundRotation] = useState<string[]>([]);
  const category = gameType && THOUGHT_GAME_TYPES[gameType];
  const quick = QUICK_EXERCISES.find(game => game.id === quickId);
  const matchingQuickGames = QUICK_EXERCISES.filter(game => rotation.includes(game.id));
  const rotationPool = matchingQuickGames.length ? matchingQuickGames : QUICK_EXERCISES;
  const matchingRoundTypes = ROUND_TYPES.filter(type => roundRotation.includes(type));
  const roundTypesInShuffle = matchingRoundTypes.length ? matchingRoundTypes : ROUND_TYPES;
  const open = round[roundIndex];
  const backButton = useRef<HTMLButtonElement>(null);
  const roundFocus = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<string | null>(null);
  const inquiryChoices = useMemo(() => inquiries.filter(item => !['resolved', 'archived', 'abandoned'].includes(item.status)), [inquiries]);

  const definitionRegions = useMemo(() => gameType === 'definition'
    ? deriveAtlasRegions({ concepts, media, vault: positions, questions: inquiries, links, drafts: [], practices, timeline: [], thinkingEvents: [] })
      .filter(region => region.status === 'active' && region.conceptIds.some(id => concepts.some(item => item.id === id && item.description.trim())))
    : [], [gameType, concepts, media, positions, inquiries, practices, links]);

  useEffect(() => {
    try {
      const stored = completionKey ? readBrowserPreference(completionKey) : null;
      const values: unknown = stored ? JSON.parse(stored) : [];
      setDone(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []);
    } catch { setDone([]); }
  }, [completionKey]);

  useEffect(() => {
    setRotation(readRotation(rotationKey));
    setRoundRotation(readRotation(roundRotationKey));
  }, [rotationKey, roundRotationKey]);

  const changeRotation = (ids: string[]) => {
    setRotation(ids);
    if (rotationKey) writeBrowserPreference(rotationKey, JSON.stringify(ids));
  };
  const changeRoundRotation = (ids: string[]) => {
    setRoundRotation(ids);
    if (roundRotationKey) writeBrowserPreference(roundRotationKey, JSON.stringify(ids));
  };

  useEffect(() => {
    if (open) roundFocus.current?.focus();
    else if (quick || category) backButton.current?.focus();
    else if (returnFocus.current) {
      document.getElementById(returnFocus.current)?.focus();
      returnFocus.current = null;
    }
  }, [open?.id, quick, category]);

  const chooseQuick = (id: QuickExerciseId, opener = `quick-exercise-${id}`) => {
    returnFocus.current = opener;
    setQuickId(id);
  };
  const dealQuick = () => {
    const pick = rotationPool[Math.floor(Math.random() * rotationPool.length)];
    chooseQuick(pick.id, 'exercise-shuffle');
  };
  const chooseCategory = (type: ThoughtGameType) => {
    returnFocus.current = `exercise-round-${type}`;
    setGameType(type); setKind(null); setInquiryId(''); setRegionId('');
  };

  const markDone = (id: string) => {
    const next = Array.from(new Set([...done, id]));
    setDone(next);
    if (completionKey) writeBrowserPreference(completionKey, JSON.stringify(next));
  };

  const defaultCardsByKind = useMemo(() => {
    const byKind = new Map<ThoughtGameKind, ThoughtGame[]>();
    const eligibleInquiries = new Set(inquiryChoices.map(item => item.id));
    for (const game of games) {
      if (game.kind === 'question_assumption' && !eligibleInquiries.has(game.target.targetId ?? '')) continue;
      const cards = byKind.get(game.kind);
      if (cards) cards.push(game);
      else byKind.set(game.kind, [game]);
    }
    byKind.set('define_it', buildDefinitionRound(concepts, dayKey));
    return byKind;
  }, [concepts, dayKey, games, inquiryChoices]);
  const roundPool = roundTypesInShuffle.map(type => ({ type, kinds: THOUGHT_GAME_TYPES[type].kinds.filter(value => defaultCardsByKind.get(value)?.length) })).filter(item => item.kinds.length);
  const dealRound = () => {
    const pick = roundPool[Math.floor(Math.random() * roundPool.length)];
    if (!pick) return;
    const nextKind = pick.kinds[Math.floor(Math.random() * pick.kinds.length)];
    chooseCategory(pick.type);
    returnFocus.current = 'round-shuffle';
    setKind(nextKind);
    setRound(defaultCardsByKind.get(nextKind) ?? []);
    setRoundIndex(0);
  };

  const availableKinds = category ? category.kinds.filter(candidate => candidate === 'question_assumption' ? inquiryChoices.length > 0 : defaultCardsByKind.get(candidate)?.length) : [];
  const selectedKind = kind && availableKinds.includes(kind) ? kind : availableKinds[0];
  const region = definitionRegions.find(item => item.id === regionId);
  const chosenInquiry = inquiryChoices.find(item => item.id === inquiryId);
  // Freeze these cards when play starts, including the selected scope.
  const previewCards = useMemo(() => {
    if (!selectedKind) return [];
    if (gameType === 'inquiry' && chosenInquiry) return [buildInquiryExercise(chosenInquiry)];
    if (selectedKind === 'define_it' && region) return buildDefinitionRound(concepts, dayKey, new Set(region.conceptIds));
    return defaultCardsByKind.get(selectedKind) ?? [];
  }, [selectedKind, gameType, chosenInquiry, concepts, dayKey, region, defaultCardsByKind]);
  const start = () => { setRound(previewCards); setRoundIndex(0); };
  const leaveRound = () => { setRound([]); setRoundIndex(0); };
  const next = () => { if (roundIndex + 1 < round.length) setRoundIndex(roundIndex + 1); else leaveRound(); };

  return (
    <div className="noesis-page noesis-exercises-page" data-noesis-identity="exercises">
      {(quick || category) && <Button ref={backButton} type="button" variant="ghost" className="mb-2 min-h-11" onClick={() => { if (open) leaveRound(); else { setGameType(null); setQuickId(null); } }}>
        <ArrowLeft className="size-4" aria-hidden="true" />{open ? 'Round setup' : 'All exercises'}
      </Button>}
      <PageHeader title={quick?.title || category?.label || 'Exercises'} description={quick?.hint || category?.hint || 'Quick games and card rounds for practicing how you think.'} />
      {quick ? <ExerciseGame key={quick.id} game={quick.id} concepts={concepts} inquiries={inquiries} positions={positions} practices={practices} seed={dayKey} />
      : open ? <div ref={roundFocus} tabIndex={-1} className="noesis-gtable">
        <p className="mb-2 text-sm text-muted-foreground">Card {roundIndex + 1} of {round.length}</p>
        <ExerciseCard key={open.id} game={open} completed={done.includes(open.id)} onComplete={() => markDone(open.id)}
          onFollow={() => onNavigate({ view: open.target.view, targetId: open.target.targetId || null })}
          onNext={next} nextLabel={roundIndex + 1 < round.length ? 'Next card' : 'Finish round'} />
      </div> : category ? <div className="max-w-2xl">
        <Panel size="lg" title="Round setup" headingLevel="h2">
          <div className="noesis-setup__grid">
            {availableKinds.length > 1 && <label className="grid gap-1.5 text-sm font-medium">Round
              <select className={selectClass} value={selectedKind} onChange={event => setKind(event.target.value as ThoughtGameKind)}>
                {availableKinds.map(value => <option key={value} value={value}>{THOUGHT_GAME_KIND_LABELS[value]}</option>)}
              </select>
            </label>}
            {gameType === 'inquiry' && inquiryChoices.length > 0 && <label className="grid gap-1.5 text-sm font-medium">Inquiry
              <select className={selectClass} value={chosenInquiry?.id || ''} onChange={event => setInquiryId(event.target.value)}>
                <option value="">Suggested inquiries</option>
                {inquiryChoices.map(item => <option key={item.id} value={item.id}>{item.text}</option>)}
              </select>
            </label>}
            {selectedKind === 'define_it' && definitionRegions.length > 0 && <label className="grid gap-1.5 text-sm font-medium">Atlas region
              <select className={selectClass} value={region?.id || ''} onChange={event => setRegionId(event.target.value)}>
                <option value="">All regions and unmapped concepts</option>
                {definitionRegions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
          </div>
          {selectedKind ? (
            <div className="noesis-setup__go">
              <p className="noesis-setup__count" aria-live="polite"><b>{previewCards.length}</b> {previewCards.length === 1 ? 'card' : 'cards'} ready</p>
              <Button className="min-h-11" onClick={start} disabled={!previewCards.length}>Start round <ArrowRight className="size-4" aria-hidden="true" /></Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">{gameType === 'inquiry' ? 'Add an open inquiry to play.' : gameType === 'definition' ? 'Save a concept definition to play.' : gameType === 'position' ? 'Add a position to play.' : 'Add a source and its main idea to unlock source recall.'}</p>}
        </Panel>
      </div> : <div className="grid gap-3">
        <WorkspaceTabs value={shelf} onChange={value => setShelf(value === 'rounds' ? 'rounds' : 'games')} label="Exercise formats" variant="segmented"
          items={[{ id: 'games', label: 'Quick games' }, { id: 'rounds', label: 'Guided rounds' }]} />
        {shelf === 'games' ? <section className="min-w-0" aria-labelledby="quick-exercises-heading">
          <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2">
            <h2 id="quick-exercises-heading" className="font-headline text-xl font-semibold">Quick games</h2>
            <ExerciseShuffle id="exercise-shuffle" label="Games in shuffle" options={QUICK_EXERCISES} selected={rotationPool.map(game => game.id)} onChange={changeRotation} onDeal={dealQuick} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 [&>li>button]:h-full">
            {QUICK_EXERCISES.map(game => <li key={game.id}><ExerciseChoice id={`quick-exercise-${game.id}`} title={game.title} hint={game.hint} icon={game.icon} onChoose={() => chooseQuick(game.id)} /></li>)}
          </ul>
        </section> :
        <section className="min-w-0" aria-labelledby="round-exercises-heading">
          <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2">
            <h2 id="round-exercises-heading" className="font-headline text-xl font-semibold">Guided rounds</h2>
            <ExerciseShuffle id="round-shuffle" label="Rounds in shuffle" options={ROUND_TYPES.map(type => ({ id: type, title: THOUGHT_GAME_TYPES[type].label }))} selected={roundTypesInShuffle} onChange={changeRoundRotation} onDeal={dealRound} disabled={!roundPool.length} />
          </div>
          {!roundPool.length && <p className="mb-3 text-sm text-muted-foreground">No cards are ready in the selected round types.</p>}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 [&>li>button]:h-full">
            {ROUND_TYPES.map(type => {
              const definition = THOUGHT_GAME_TYPES[type];
              return <li key={type}><ExerciseChoice id={`exercise-round-${type}`} title={definition.label} hint={definition.hint} icon={GAME_ICONS[type]} onChoose={() => chooseCategory(type)} /></li>;
            })}
          </ul>
        </section>}
      </div>}
    </div>
  );
}

function ExerciseCard({ game, completed, onComplete, onFollow, onNext, nextLabel }: {
  game: ThoughtGame;
  completed: boolean;
  onComplete: () => void;
  onFollow: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const [bet, setBet] = useState(70);
  const [revealed, setRevealed] = useState(false);
  const family = thoughtGameFamily(game.kind);
  const isBet = game.kind === 'confidence_calibration' && !game.options?.length;
  const isInquiryRewrite = game.kind === 'question_assumption';
  const canTurn = isBet || Boolean(choice || text.trim());
  const turn = () => { setRevealed(true); onComplete(); };
  const maskSource = ['define_it', 'whose_words'].includes(game.kind) && !revealed;
  const followLabel = game.target.targetId ? 'Open the record' : `Open ${NOESIS_PAGE_BY_VIEW[game.target.view]?.title || 'page'}`;

  return (
    <article className="noesis-gcard noesis-gcard--big" data-family={family}>
      <span className="noesis-gcard__suit" aria-hidden="true">{family === 'records' ? '◆' : '♣'}</span>
      <div className="noesis-eyebrow text-[hsl(var(--deck))]">{game.label}{!maskSource && !isInquiryRewrite && ` · ${game.sourceLabel}`}</div>
      <h2 className="mt-2 font-headline text-2xl font-semibold italic leading-tight">{game.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{game.instruction}</p>
      <blockquote className="noesis-gcard__prompt">{game.prompt}</blockquote>

      {game.options?.length ? (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer choices">
          {game.options.map((option) => {
            const right = revealed && option === game.answer;
            const wrong = Boolean(game.answer && revealed && option === choice && option !== game.answer);
            return (
              <button key={option} type="button" disabled={revealed} aria-pressed={choice === option} onClick={() => setChoice(option)} className={cn('noesis-gopt', right && 'noesis-gopt--right', wrong && 'noesis-gopt--wrong')}>
                {option}
              </button>
            );
          })}
        </div>
      ) : isBet ? (
        <label className="flex items-center gap-3 text-sm">Your bet
          <input type="range" min={0} max={100} value={bet} disabled={revealed} onChange={(event) => setBet(Number(event.target.value))} className="flex-1 accent-[hsl(var(--deck))]" />
          <span className="w-10 font-code">{bet}%</span>
        </label>
      ) : (
        <Textarea value={text} disabled={revealed} onChange={(event) => setText(event.target.value)} placeholder={isInquiryRewrite ? 'Rewrite the question or say what makes it open.' : 'Write before you turn the card.'} aria-label="Your answer" className="min-h-24" />
      )}

      {!revealed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={turn} disabled={!canTurn}>{isInquiryRewrite ? 'See an example' : 'Turn the card'}</Button>
          <Button type="button" variant="ghost" onClick={onNext}>Skip</Button>
        </div>
      ) : (
        <div className="noesis-gcard__reveal" role="status">
          {game.answer && <p className="font-medium">{choice === game.answer ? 'Right.' : 'Not quite.'} <span className="text-muted-foreground">Answer: {game.answer}</span></p>}
          <p className="whitespace-pre-line">{game.reveal}</p>
          {!!game.savedNotes?.length && (
            <div>
              <p className="font-medium">Assumptions you previously recorded</p>
              <ul className="list-disc space-y-1 pl-5">{game.savedNotes.map(note => <li key={note}>{note}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onNext}>{nextLabel}</Button>
            <Button type="button" variant="outline" onClick={onFollow}>{followLabel}<ArrowRight className="ml-1 size-4" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Play this card again" title="Play again" onClick={() => { setRevealed(false); setChoice(''); setText(''); }}><RotateCcw className="size-4" /></Button>
          </div>
          {completed && <p className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Private practice: nothing was saved to your records.</p>}
        </div>
      )}
    </article>
  );
}
