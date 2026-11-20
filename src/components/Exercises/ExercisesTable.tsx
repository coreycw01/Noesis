"use client";

import { useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, Flag, Lightbulb, Puzzle, RotateCcw } from 'lucide-react';
import { deriveAtlasRegions } from '@/components/Atlas/atlas-diagnostics';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExerciseGames } from '@/components/Exercises/ExerciseGames';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Panel } from '@/components/ui/panel';
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
const selectClass = 'min-h-11 w-full min-w-0 rounded-[var(--button-radius)] border border-border bg-background px-3 text-foreground';

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
  const [gameType, setGameType] = useState<ThoughtGameType | null>(null);
  const [kind, setKind] = useState<ThoughtGameKind | null>(null);
  const [inquiryId, setInquiryId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [round, setRound] = useState<ThoughtGame[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const rotationKey = workspacePreferenceKey(workspaceKey, 'exercises:rotation');
  const [rotation, setRotation] = useState<string[]>([]);
  const category = gameType && THOUGHT_GAME_TYPES[gameType];
  const open = round[roundIndex];
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
    try {
      const stored = rotationKey ? readBrowserPreference(rotationKey) : null;
      const values: unknown = stored ? JSON.parse(stored) : [];
      setRotation(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []);
    } catch { setRotation([]); }
  }, [rotationKey]);

  const changeRotation = (ids: string[]) => {
    setRotation(ids);
    if (rotationKey) writeBrowserPreference(rotationKey, JSON.stringify(ids));
  };

  const markDone = (id: string) => {
    const next = Array.from(new Set([...done, id]));
    setDone(next);
    if (completionKey) writeBrowserPreference(completionKey, JSON.stringify(next));
  };

  const availableKinds = category ? category.kinds.filter(candidate => candidate === 'question_assumption' ? inquiryChoices.length > 0 : games.some(game => game.kind === candidate)) : [];
  const selectedKind = kind && availableKinds.includes(kind) ? kind : availableKinds[0];
  const region = definitionRegions.find(item => item.id === regionId);
  const chosenInquiry = inquiryChoices.find(item => item.id === inquiryId);
  // The round is built once and shown before you start it, so the setup page
  // says what you are about to play instead of asking you to trust it.
  const previewCards = useMemo(() => {
    if (!selectedKind) return [];
    if (gameType === 'inquiry' && chosenInquiry) return [buildInquiryExercise(chosenInquiry)];
    if (selectedKind === 'define_it') return buildDefinitionRound(concepts, dayKey, region ? new Set(region.conceptIds) : undefined);
    return games.filter(game => game.kind === selectedKind && (gameType !== 'inquiry' || inquiryChoices.some(item => item.id === game.target.targetId)));
  }, [selectedKind, gameType, chosenInquiry, concepts, dayKey, region, games, inquiryChoices]);
  const sourceNoun = gameType === 'inquiry' ? 'inquiries' : gameType === 'definition' ? 'concepts' : gameType === 'position' ? 'positions' : gameType === 'source' ? 'sources' : 'records';
  const sourceCount = new Set(previewCards.map(card => card.sourceLabel)).size;
  const sourceSummary = sourceCount ? `${sourceCount} of your ${sourceNoun}` : `your ${sourceNoun}`;
  const start = () => { setRound(previewCards); setRoundIndex(0); };
  const leaveRound = () => { setRound([]); setRoundIndex(0); };
  const next = () => { if (roundIndex + 1 < round.length) setRoundIndex(roundIndex + 1); else leaveRound(); };

  return (
    <div className="noesis-page noesis-exercises-page" data-noesis-identity="card-table">
      <PageHeader title={category ? category.label : 'Exercises'} description={category ? category.hint : 'Play with what you have recorded. Every answer is one your workspace already knows.'} />
      {!category && <ExerciseGames concepts={concepts} inquiries={inquiries} positions={positions} practices={practices} seed={dayKey} rotation={rotation} onRotationChange={changeRotation} />}
      {!category && <h2 className="mt-8 font-headline text-xl italic">More practice</h2>}
      {category && <Button type="button" variant="ghost" className="mb-4 min-h-11" onClick={() => { if (open) leaveRound(); else setGameType(null); }}>
        <ArrowLeft className="size-4" aria-hidden="true" />{open ? 'Back to setup' : 'All exercises'}
      </Button>}
      {open ? <div className="noesis-gtable">
        {round.length > 1 && <p className="mb-2 text-sm text-muted-foreground">Card {roundIndex + 1} of {round.length}</p>}
        <ExerciseCard key={open.id} game={open} completed={done.includes(open.id)} onComplete={() => markDone(open.id)}
          onFollow={() => onNavigate({ view: open.target.view, targetId: open.target.targetId || null })}
          onNext={next} nextLabel={roundIndex + 1 < round.length ? 'Next card' : 'Back to setup'} />
      </div> : category ? <div className="noesis-setup">
        <Panel size="lg" title={`Set up this round`} description={category.hint} headingLevel="h2">
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
              <p className="noesis-setup__count"><b>{previewCards.length}</b> {previewCards.length === 1 ? 'card' : 'cards'} ready, drawn from {sourceSummary}</p>
              <Button className="min-h-11" onClick={start} disabled={!previewCards.length}>Start round <ArrowRight className="size-4" aria-hidden="true" /></Button>
            </div>
          ) : <p className="text-sm text-muted-foreground">{gameType === 'inquiry' ? 'Add an open inquiry to play.' : gameType === 'definition' ? 'Save a concept definition to play.' : gameType === 'position' ? 'Add a position to play.' : 'Add a source and its main idea to unlock source recall.'}</p>}
        </Panel>
        {previewCards.length > 0 && (
          <section className="noesis-setup__deck" aria-label="What is in this round">
            <Eyebrow>In the deck</Eyebrow>
            <ul>
              {previewCards.slice(0, 6).map((card, index) => (
                <li key={card.id} className="noesis-setup__card" style={{ ['--i' as string]: index }}>
                  <span className="noesis-eyebrow noesis-eyebrow--sm">{card.label}</span>
                  <p>{card.title}</p>
                  <small>{card.sourceLabel}</small>
                </li>
              ))}
            </ul>
            {previewCards.length > 6 && <p className="noesis-setup__more">+ {previewCards.length - 6} more</p>}
          </section>
        )}
      </div> : <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Exercise types">
        {(Object.keys(THOUGHT_GAME_TYPES) as ThoughtGameType[]).map(type => {
          const definition = THOUGHT_GAME_TYPES[type];
          const Icon = GAME_ICONS[type];
          return <button key={type} type="button" onClick={() => { setGameType(type); setKind(null); setInquiryId(''); setRegionId(''); }}
            className="min-h-28 min-w-0 rounded-[var(--card-radius)] border border-border bg-card p-4 text-left hover:border-accent focus-visible:outline focus-visible:outline-ring">
            <span className="flex items-center gap-2 text-base font-semibold"><Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />{definition.label}<ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></span>
            <span className="mt-2 block text-sm text-muted-foreground">{definition.hint}</span>
          </button>;
        })}
      </section>}
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
  const canTurn = isBet || Boolean(choice || text.trim());
  const turn = () => { setRevealed(true); onComplete(); };
  const maskSource = ['define_it', 'whose_words'].includes(game.kind) && !revealed;
  const followLabel = game.target.targetId ? 'Open the record' : NOESIS_PAGE_BY_VIEW[game.target.view]?.title || 'Open';

  return (
    <article className="noesis-gcard noesis-gcard--big" data-family={family}>
      <span className="noesis-gcard__suit" aria-hidden="true">{family === 'records' ? '◆' : '♣'}</span>
      <div className="noesis-eyebrow text-[hsl(var(--deck))]">{game.label}{!maskSource && ` · ${game.sourceLabel}`}</div>
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
        <Textarea value={text} disabled={revealed} onChange={(event) => setText(event.target.value)} placeholder="Write before you turn the card." aria-label="Your answer" className="min-h-24" />
      )}

      {!revealed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={turn} disabled={!canTurn}>Turn the card</Button>
          <Button type="button" variant="ghost" onClick={onNext}>Skip</Button>
        </div>
      ) : (
        <div className="noesis-gcard__reveal" role="status">
          {game.answer && <p className="font-medium">{choice === game.answer ? 'Right.' : 'Not quite.'} <span className="text-muted-foreground">Answer: {game.answer}</span></p>}
          <p>{game.reveal}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onFollow}>What this changes → {followLabel}<ArrowRight className="ml-1 size-4" aria-hidden="true" /></Button>
            <Button type="button" onClick={onNext}>{nextLabel}</Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Play this card again" title="Play again" onClick={() => { setRevealed(false); setChoice(''); setText(''); }}><RotateCcw className="size-4" /></Button>
          </div>
          {completed && <p className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Private practice: nothing was saved to your records.</p>}
        </div>
      )}
    </article>
  );
}
