"use client";

import React, { useMemo, useRef, useState } from 'react';
import { Check, MoreHorizontal, Pencil, Scale, Swords, Trash2, X } from 'lucide-react';
import { aiDepthFor } from '@/lib/ai-depth';
import { Button, IconButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchField } from '@/components/shared/SearchField';
import { Dictation } from '@/components/shared/Dictation';
import { SectionEmpty } from '@/components/shared/SectionEmpty';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { EntityMeta } from '@/components/shared/IntellectualStructures';
import { FooterSection, RecordFooter, RecordHeader, RecordPage, RecordPath, RecordSection, Row, SuggestionCards, type Suggestion } from '@/components/shared/record/RecordPage';
import { BenchBand, Connections, History, Tool, ToolsBand } from '@/components/shared/record/RecordParts';
import { InquiryScale, answerWeight, inquiryLead, letter } from '@/components/Questions/InquiryScale';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { PromotedAnnotationOrigins } from '@/components/ai/AiProvenanceBadge';
import type { AiContextEnvelope } from '@/lib/contextual-ai';
import type { InquiryAiReview } from '@/lib/inquiry-ai-review';
import type { AiSettings, Concept, Draft, InquiryEvidence, Media, Practice, Question, VaultEntry } from '@/lib/types';
import { conceptKey, today, uid } from '@/lib/readex';
import { assignInquiryEvidence, inquiryAiItemMemory, inquiryHasRecordedObjection, inquiryNeedsEvidence, isInquiryClosed, MAX_INQUIRY_EVIDENCE } from '@/lib/inquiry-state';

const EMPTY_EVIDENCE: Omit<InquiryEvidence, 'id' | 'date'> = { claim: '', type: 'personal observation', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' };

const RESOLUTION_OPTIONS: Array<{ status: Question['status']; label: string; description: string }> = [
  { status: 'provisionally_answered', label: 'Provisionally answered', description: 'The answer is useful, but still open to revision.' },
  { status: 'suspended', label: 'Suspend', description: 'Not enough evidence or attention to proceed right now.' },
  { status: 'enduring', label: 'Enduring question', description: 'Keep this alive as a long-term question rather than closing it.' },
  { status: 'no_longer_meaningful', label: 'No longer meaningful', description: 'The question no longer frames the issue well.' },
  { status: 'resolved', label: 'Resolved', description: 'A resolution summary exists and the current investigation can close.' },
];

type PullSource = 'annotation' | 'practice' | 'position';
type PullScope = 'same' | 'near';
interface PullRecord { key: string; text: string; origin: string; source: PullSource; scope: PullScope; conceptName: string; direction: InquiryEvidence['direction']; strength: InquiryEvidence['strength']; type: InquiryEvidence['type'] }

const STOPS = [
  { id: 'inq-frame', label: 'Frame' },
  { id: 'inq-answers', label: 'Answers' },
  { id: 'inq-weigh', label: 'Weigh' },
  { id: 'inq-conclude', label: 'Conclude' },
];

export interface InquiryDetailProps {
  aiSettings: AiSettings;
  question: Question;
  sources: Media[];
  concepts: string[];
  beliefs: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  availableDrafts: Draft[];
  availablePractices: Practice[];
  /** The whole workspace, for "Pull from your workspace". */
  allMedia: Media[];
  allPositions: VaultEntry[];
  allConcepts: Concept[];
  onBack: () => void;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onSaveAiReview: (inquiryId: string, review: InquiryAiReview, content: string) => Promise<void>;
  onDeleteQuestion: (id: string) => void | Promise<void>;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onLinkItem: (inquiryId: string, type: 'work' | 'practice', itemId: string) => Promise<void>;
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onOpenWork: (id: string) => void;
  onOpenPractice: (id: string) => void;
  onOpenPosition: (id: string) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => Promise<VaultEntry>;
  onAiFeedback: (title: string, description: string, variant?: 'default' | 'destructive') => void;
  initialSection?: 'investigation' | 'answer';
}

/**
 * The inquiry page as one flow: Frame → Answers → Weigh → Conclude. The path
 * at the top says where you are, from the record itself; every tool sits in
 * the section it acts on; suggestions appear only when there is something
 * specific to suggest.
 */
export function InquiryDetail({ aiSettings, question, sources, concepts, beliefs, drafts, practices, availableDrafts, availablePractices, allMedia, allPositions, allConcepts, onBack, onUpdateQuestion: persistQuestion, onSaveAiReview, onDeleteQuestion, onAddDraft, onLinkItem, onAddPractice, onOpenWork, onOpenPractice, onOpenPosition, onFormPositionFromInquiry, onAiFeedback, initialSection = 'investigation' }: InquiryDetailProps) {
  const saveLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const onUpdateQuestion = async (next: Question, baseline = { version: question.dateUpdated }) => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    try {
      await persistQuestion({ ...next, dateUpdated: baseline.version });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.name : '';
      const description = reason === 'WorkspaceRecordChangedError'
        ? 'This inquiry changed in another session. Your input is still here; review the latest inquiry before saving again.'
        : reason === 'WorkspaceOfflineError'
          ? 'You are offline. Your input is still here; reconnect and try again.'
          : 'Your input is still here. Check your connection and try saving again.';
      onAiFeedback('Inquiry not saved', description, 'destructive');
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  // ----- state -----
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(question.text);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFrame, setEditingFrame] = useState(false);
  const [frameDraft, setFrameDraft] = useState({ whyItMatters: question.whyItMatters || '', currentIntuition: question.currentIntuition || '', uncertainty: question.uncertainty || '' });
  const [frameBase, setFrameBase] = useState<string | undefined>(undefined);
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');
  const [answerDetail, setAnswerDetail] = useState({ support: '', objection: '', confidence: 3 });
  const [evidenceDraft, setEvidenceDraft] = useState(EMPTY_EVIDENCE);
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [saveAsNote, setSaveAsNote] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  // Thinking tools: written by you, for you. They write into the record the
  // same way the workbench does — a note, or support on an answer.
  const [changeMind, setChangeMind] = useState('');
  const [steelman, setSteelman] = useState('');
  const [steelmanId, setSteelmanId] = useState('');
  const [pullQuery, setPullQuery] = useState('');
  const [pullSource, setPullSource] = useState<PullSource | 'all'>('all');
  const [pullScope, setPullScope] = useState<PullScope | 'all'>('all');
  const [pullDirection, setPullDirection] = useState<InquiryEvidence['direction'] | 'all'>('all');
  const [workingDraft, setWorkingDraft] = useState<{ value: string; base: string } | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState(question.resolutionSummary || '');
  const [checkpointSkipReason, setCheckpointSkipReason] = useState('');
  const [positionConfidence, setPositionConfidence] = useState(50);
  const [existingPracticeId, setExistingPracticeId] = useState('');
  const [existingWorkId, setExistingWorkId] = useState('');
  const [testDraft, setTestDraft] = useState({ tested: '', method: '' });
  const evidenceInput = useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setEditingQuestion(false); setQuestionDraft(question.text); setEditingFrame(false); setFrameBase(undefined);
    setFrameDraft({ whyItMatters: question.whyItMatters || '', currentIntuition: question.currentIntuition || '', uncertainty: question.uncertainty || '' });
    setClarificationDraft(''); setAnswerDraft(''); setAnswerDetail({ support: '', objection: '', confidence: 3 });
    setEvidenceDraft(EMPTY_EVIDENCE); setEditingEvidenceId(null); setSaveAsNote(false); setWriteOpen(false); setPullOpen(false);
    setWorkingDraft(null); setResolutionSummary(question.resolutionSummary || ''); setCheckpointSkipReason(''); setPositionConfidence(50);
    setExistingPracticeId(''); setExistingWorkId(''); setTestDraft({ tested: '', method: '' });
    if (initialSection === 'answer') window.requestAnimationFrame(() => document.getElementById('inq-conclude')?.scrollIntoView({ block: 'start' }));
    // Reset local drafts only when the record changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection, question.id]);

  // ----- derived -----
  const answers = question.candidateAnswers || [];
  const evidence = question.evidenceRecords || [];
  const savedAnswer = question.answer || '';
  const working = workingDraft?.value ?? savedAnswer;
  const workingConflict = workingDraft !== null && workingDraft.base !== savedAnswer;
  const lead = inquiryLead(answers, evidence);
  const unplaced = evidence.some((item) => !item.candidateId && item.direction !== 'contextualizes');
  const closed = isInquiryClosed(question);
  const answered = Boolean(savedAnswer.trim()) && question.status !== 'open' && question.status !== 'comparing_answers' && question.status !== 'gathering_evidence';
  const frameFilled = [question.whyItMatters, question.currentIntuition, question.uncertainty].some((value) => value?.trim());

  let hereId: string; let guide: string;
  if (answers.length < 2) { hereId = 'inq-answers'; guide = answers.length ? 'Add a second possible answer.' : 'Add two possible answers to compare.'; }
  else if (!evidence.length || unplaced) { hereId = 'inq-weigh'; guide = !evidence.length ? 'Add evidence, then place it on an answer.' : 'Place your remaining evidence on an answer.'; }
  else if (!working.trim()) { hereId = 'inq-conclude'; guide = `The scale leans ${lead && lead.margin >= 2 ? `toward ${letter(lead.index)}. ` : 'nowhere clear yet. '}Write your working answer.`; }
  else { hereId = 'inq-conclude'; guide = closed ? 'Decided. Reopen it any time, or take an optional next step.' : answered ? 'Answered. Decide the outcome when you are ready, or keep investigating.' : 'Mark it answered, or keep investigating.'; }

  const conceptNames = useMemo(() => {
    const ids = new Set(question.conceptIds || []);
    return allConcepts.filter((concept) => ids.has(concept.id) || ids.has(concept.name) || [...ids].some((id) => conceptKey(id) === conceptKey(concept.name))).map((concept) => concept.name);
  }, [allConcepts, question.conceptIds]);
  const nearNames = useMemo(() => {
    const same = new Set(conceptNames.map(conceptKey));
    return new Set(allConcepts.filter((concept) => same.has(conceptKey(concept.name))).flatMap((concept) => concept.links || []).map(conceptKey).filter((key) => !same.has(key)));
  }, [allConcepts, conceptNames]);
  const scopeOf = (tags?: string[]): PullScope | null => {
    const keys = (tags || []).map(conceptKey);
    if (keys.some((key) => conceptNames.some((name) => conceptKey(name) === key))) return 'same';
    if (keys.some((key) => nearNames.has(key))) return 'near';
    return null;
  };
  const pullRecords = useMemo<PullRecord[]>(() => {
    const out: PullRecord[] = [];
    for (const source of allMedia) {
      for (const note of source.annotations || []) {
        const scope = scopeOf(note.conceptTags); if (!scope) continue;
        const direction: InquiryEvidence['direction'] = note.consequenceKind === 'objection' ? 'challenges' : note.consequenceKind === 'question' || note.consequenceKind === 'reaction' ? 'contextualizes' : 'supports';
        out.push({ key: `a:${source.id}:${note.id}`, text: note.text, origin: `Annotation · ${source.title}`, source: 'annotation', scope, conceptName: (note.conceptTags || [])[0] || '', direction, strength: 'moderate', type: 'source excerpt' });
      }
    }
    for (const practice of availablePractices) {
      const scope = scopeOf(practice.conceptTags) || (practice.questionIds?.includes(question.id) ? 'same' : null); if (!scope) continue;
      const result = practice.observedOutcome?.trim() || [...(practice.logs || [])].reverse().find((log) => (log.outcome || log.observations)?.trim())?.outcome;
      if (!result) continue;
      out.push({ key: `p:${practice.id}`, text: `${practice.title}: ${result}`, origin: 'Praxis · result', source: 'practice', scope, conceptName: (practice.conceptTags || [])[0] || '', direction: 'supports', strength: 'moderate', type: 'personal observation' });
    }
    for (const position of allPositions) {
      const scope = scopeOf(position.tags) || (question.beliefIds?.includes(position.id) ? 'same' : null); if (!scope) continue;
      for (const item of position.evidenceFor || []) out.push({ key: `pf:${position.id}:${item}`, text: item, origin: `Evidence for · ${position.title}`, source: 'position', scope, conceptName: (position.tags || [])[0] || '', direction: 'supports', strength: 'moderate', type: 'source excerpt' });
      for (const item of position.evidenceAgainst || []) out.push({ key: `pa:${position.id}:${item}`, text: item, origin: `Evidence against · ${position.title}`, source: 'position', scope, conceptName: (position.tags || [])[0] || '', direction: 'challenges', strength: 'moderate', type: 'counterexample' });
    }
    const already = new Set(evidence.map((item) => item.claim.trim().toLowerCase()));
    return out.filter((record) => record.text.trim() && !already.has(record.text.trim().toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMedia, availablePractices, allPositions, evidence, conceptNames, nearNames, question.id]);
  const pullVisible = pullRecords.filter((record) => (pullSource === 'all' || record.source === pullSource) && (pullScope === 'all' || record.scope === pullScope) && (pullDirection === 'all' || record.direction === pullDirection) && (!pullQuery.trim() || `${record.text} ${record.origin} ${record.conceptName}`.toLowerCase().includes(pullQuery.trim().toLowerCase()))).slice(0, 60);

  // ----- actions -----
  const saveFrame = async () => {
    if (frameBase !== undefined && frameBase !== question.dateUpdated) { onAiFeedback('Inquiry changed', 'This inquiry changed while you were editing. Copy what you want to keep, then reload the saved frame.', 'destructive'); return; }
    if (!await onUpdateQuestion({ ...question, whyItMatters: frameDraft.whyItMatters.trim(), currentIntuition: frameDraft.currentIntuition.trim(), uncertainty: frameDraft.uncertainty.trim(), dateUpdated: today() })) return;
    setEditingFrame(false); setFrameBase(undefined);
  };
  const addClarification = async () => {
    const text = clarificationDraft.trim(); if (!text) return;
    if (!await onUpdateQuestion({ ...question, assumptions: Array.from(new Set([...(question.assumptions || []), text])), dateUpdated: today() })) return;
    setClarificationDraft('');
  };
  const removeClarification = (text: string) => onUpdateQuestion({ ...question, assumptions: (question.assumptions || []).filter((item) => item !== text), dateUpdated: today() });
  const addAnswer = async () => {
    const statement = answerDraft.trim(); if (!statement) return;
    const next = { id: crypto.randomUUID(), statement, confidence: answerDetail.confidence, support: answerDetail.support.trim(), objection: answerDetail.objection.trim(), consequence: '' };
    if (!await onUpdateQuestion({ ...question, candidateAnswers: [...answers, next], status: question.status === 'open' ? 'comparing_answers' as Question['status'] : question.status, dateUpdated: today() })) return;
    setAnswerDraft(''); setAnswerDetail({ support: '', objection: '', confidence: 3 });
  };
  const removeAnswer = async (id: string) => {
    if (!await onUpdateQuestion({ ...question, candidateAnswers: answers.filter((item) => item.id !== id), evidenceRecords: evidence.map((item) => item.candidateId === id ? { ...item, candidateId: '' } : item), dateUpdated: today() })) return;
    onAiFeedback('Answer removed', 'Its evidence is unplaced, not deleted.');
  };
  const placeEvidence = (evidenceId: string, candidateId: string) => void onUpdateQuestion({ ...question, evidenceRecords: evidence.map((item) => item.id === evidenceId ? { ...item, candidateId } : item), dateUpdated: today() });
  const removeEvidence = async (id: string) => {
    if (!await onUpdateQuestion({ ...question, evidenceRecords: evidence.filter((item) => item.id !== id), dateUpdated: today() })) return;
    if (editingEvidenceId === id) { setEditingEvidenceId(null); setEvidenceDraft(EMPTY_EVIDENCE); }
    onAiFeedback('Evidence removed', 'Linked sources and answers are untouched.');
  };
  const addEvidence = async (draft: Omit<InquiryEvidence, 'id' | 'date'>, editingId: string | null = null) => {
    if (!draft.claim.trim()) { onAiFeedback('Write what the evidence says first', '', 'destructive'); return false; }
    const previous = evidence.find((item) => item.id === editingId);
    if (!previous && evidence.length >= MAX_INQUIRY_EVIDENCE) { onAiFeedback('Evidence limit reached', 'Edit or remove a saved evidence record before adding another.', 'destructive'); return false; }
    if (draft.candidateId && !answers.some((item) => item.id === draft.candidateId)) { onAiFeedback('Answer no longer available', 'Choose another answer or leave the evidence unplaced.', 'destructive'); return false; }
    const next = assignInquiryEvidence(question, { ...draft, id: previous?.id || uid(), date: previous?.date || today(), claim: draft.claim.trim(), origin: draft.origin.trim(), notes: draft.notes.trim() }, draft.candidateId);
    return onUpdateQuestion({ ...question, evidenceRecords: previous ? evidence.map((item) => item.id === previous.id ? next : item) : [next, ...evidence], status: !closed && inquiryNeedsEvidence(question) ? 'gathering_evidence' : question.status, dateUpdated: today() });
  };
  const saveChangeMind = async () => {
    if (!changeMind.trim() || saving) return;
    const note = { id: uid(), title: 'What would change my mind', text: changeMind.trim(), origin: 'user' as const, date: today() };
    if (await onUpdateQuestion({ ...question, investigationNotes: [note, ...(question.investigationNotes || [])], dateUpdated: today() })) {
      setChangeMind('');
      onAiFeedback('Saved to this inquiry', 'It is in the record, under Noesis notes.');
    }
  };
  const saveSteelman = async () => {
    if (!steelman.trim() || !steelmanId || saving) return;
    if (await addEvidence({ ...EMPTY_EVIDENCE, claim: steelman.trim(), direction: 'supports', strength: 'moderate', type: 'personal observation', origin: 'Steelman', candidateId: steelmanId })) {
      setSteelman(''); setSteelmanId('');
      onAiFeedback('Added as support', 'The scale has taken it into account.');
    }
  };
  const saveWritten = async () => {
    if (!await addEvidence(evidenceDraft, editingEvidenceId)) return;
    if (saveAsNote && !editingEvidenceId) {
      try { await onAddDraft({ title: evidenceDraft.claim.trim().slice(0, 72), type: 'text_note', status: 'seed', body: evidenceDraft.claim.trim(), questionIds: [question.id], conceptTags: conceptNames }); onAiFeedback('Evidence added and saved as a note in Works', ''); }
      catch { onAiFeedback('Evidence added; the note was not saved', 'Please try creating the note again from Works.', 'destructive'); }
    } else onAiFeedback(editingEvidenceId ? 'Evidence updated' : 'Evidence added', '');
    setEvidenceDraft(EMPTY_EVIDENCE); setEditingEvidenceId(null); setSaveAsNote(false); setWriteOpen(false);
  };
  const pullIn = async (record: PullRecord, candidateId: string) => {
    if (!await addEvidence({ claim: record.text, origin: record.origin, candidateId, direction: record.direction, strength: record.strength, reliability: 'moderate', type: record.type, notes: '' })) return;
    onAiFeedback(candidateId ? 'Pulled in and placed on an answer' : 'Pulled in, not yet placed', '');
  };
  const saveWorking = async (status: Question['status']) => {
    if (workingConflict) return;
    if (!working.trim()) { onAiFeedback('Answer required', 'Write a working answer before saving this inquiry.', 'destructive'); return; }
    const requiresSummary = ['resolved', 'suspended', 'converted', 'no_longer_meaningful'].includes(status);
    if (requiresSummary && !resolutionSummary.trim()) { onAiFeedback('Resolution summary required', 'Say what led you here before choosing this outcome.', 'destructive'); return; }
    const hasSteelman = inquiryHasRecordedObjection(question);
    if (requiresSummary && !hasSteelman && !checkpointSkipReason.trim()) { onAiFeedback('Steelman checkpoint', 'Record the strongest objection on an answer, or say why you are skipping this.', 'destructive'); return; }
    const checkpointSkips = requiresSummary && !hasSteelman && checkpointSkipReason.trim() ? [...(question.checkpointSkips || []), { id: uid(), transition: 'question_to_resolution', reason: checkpointSkipReason.trim(), date: today() }] : question.checkpointSkips;
    const next: Question = { ...question, answer: working.trim(), status, resolutionSummary: requiresSummary ? resolutionSummary.trim() : question.resolutionSummary || '', checkpointSkips, dateUpdated: today() };
    if (status === 'converted') {
      if (saveLock.current) return;
      saveLock.current = true; setSaving(true);
      try {
        const title = working.trim().replace(/\s+/g, ' ');
        const formed = await onFormPositionFromInquiry({ ...next, dateUpdated: question.dateUpdated }, { title: title.length > 100 ? `${title.slice(0, 97).trimEnd()}...` : title, statement: working.trim(), description: resolutionSummary.trim(), confidence: positionConfidence }, working);
        onAiFeedback('Position formed', 'The position and inquiry are linked.');
        onOpenPosition(formed.id);
      } catch (error) {
        onAiFeedback('Position not saved', error instanceof Error && error.name === 'WorkspaceRecordChangedError' ? 'The inquiry changed before the position could be formed. Your draft is still here.' : 'Your answer and decision are still here. Check your connection and try again.', 'destructive');
      } finally { saveLock.current = false; setSaving(false); }
      return;
    }
    if (!await onUpdateQuestion(next)) return;
    setWorkingDraft(null);
    onAiFeedback(status === 'provisionally_answered' ? 'Marked as answered' : status === 'resolved' ? 'Inquiry resolved' : 'Outcome saved', '');
  };
  const keepInvestigating = () => onUpdateQuestion({ ...question, status: answers.length >= 2 ? 'comparing_answers' : 'open', dateUpdated: today() });
  const draftPractice = async (hypothesis: string, action: string, title: string) => {
    if (saving) return; setSaving(true);
    try {
      const created = await onAddPractice({ title, description: `A test created from the inquiry: ${question.text}`, type: 'experiment', status: 'proposed', hypothesis, action, durationMode: 'repeated', durationDays: 7, questionIds: [question.id], conceptTags: concepts, sourceIds: sources.map((source) => source.id), positionIds: beliefs.map((belief) => belief.id), notes: '' });
      if (!created.id) throw new Error('not saved');
      onAiFeedback('Practice drafted', 'Open it in Praxis to finish its setup.');
      onOpenPractice(created.id);
    } catch { onAiFeedback('Practice not saved', 'Your inquiry is unchanged. Please try again.', 'destructive'); }
    finally { setSaving(false); }
  };
  const createWork = async () => {
    if (saving) return; setSaving(true);
    try {
      const created = await onAddDraft({ title: `Exploring: ${question.text.slice(0, 72)}`, type: 'essay', status: 'seed', body: savedAnswer.trim() || question.currentIntuition?.trim() || question.text, questionIds: [question.id], sourceIds: sources.map((source) => source.id), beliefIds: beliefs.map((belief) => belief.id), conceptTags: concepts });
      onOpenWork(created.id);
    } catch { onAiFeedback('Work not created', 'Please try again. Your inquiry is unchanged.', 'destructive'); }
    finally { setSaving(false); }
  };
  const link = async (type: 'work' | 'practice', id: string) => {
    if (!id || saving) return; setSaving(true);
    try { await onLinkItem(question.id, type, id); if (type === 'work') setExistingWorkId(''); else setExistingPracticeId(''); onAiFeedback(type === 'work' ? 'Work linked' : 'Practice linked', ''); }
    catch { onAiFeedback('Link not saved', 'Neither record was updated. Please try again.', 'destructive'); }
    finally { setSaving(false); }
  };

  const buildAiEnvelope = (_action?: unknown, userPrompt?: string): AiContextEnvelope => ({
    action: 'socratic_inquiry_challenge', scope: 'linked_items', targetType: 'inquiry', targetId: question.id, itemMemory: inquiryAiItemMemory(question),
    linkedMemory: [
      ...sources.slice(0, 6).map((source) => `Source: ${source.title}; main idea: ${source.capture?.after?.coreArgument || source.description || 'not recorded'}; relevant notes: ${(source.annotations || []).slice(0, 3).map((item) => item.text).join(' | ') || 'none'}`),
      ...beliefs.slice(0, 6).map((position) => `Position (${position.confidence}% confidence): ${position.statement || position.title}; support: ${(position.evidenceFor || []).length}; challenges: ${(position.evidenceAgainst || []).length}`),
      ...practices.slice(0, 4).map((practice) => `Practice: ${practice.title}; hypothesis: ${practice.hypothesis || 'not recorded'}; outcome: ${practice.observedOutcome || practice.status}`),
      ...drafts.slice(0, 3).map((draft) => `Linked work: ${draft.title}; excerpt: ${(draft.body || '').slice(0, 240) || 'empty'}`),
    ],
    userPrompt,
  });

  // ----- suggestions (only when specific) -----
  const suggestions: Suggestion[] = [];
  if (!closed && lead && lead.margin >= 2 && working.trim()) {
    suggestions.push({ id: 'form-position', tone: 'position', title: 'Form a position', quote: working.trim(), because: 'Proposed statement, from your working answer. The scale leans its way.', actionLabel: 'Draft the position', disabled: saving || workingConflict, onAction: () => { setResolutionSummary((value) => value || `Formed from the inquiry: ${question.text}`); void saveWorking('converted'); } });
  }
  const strongest = lead ? evidence.filter((item) => item.candidateId === lead.answer.id && item.direction === 'supports').sort((a, b) => (b.strength === 'strong' ? 3 : b.strength === 'moderate' ? 2 : 1) - (a.strength === 'strong' ? 3 : a.strength === 'moderate' ? 2 : 1))[0] : null;
  if (strongest && lead) {
    const action = `For seven days, act on “${strongest.claim.slice(0, 80)}” and log whether it held.`;
    suggestions.push({ id: 'test-practice', tone: 'practice', title: 'Put it to the test', quote: action, because: `Your strongest support for ${letter(lead.index)} is “${strongest.claim.slice(0, 90)}”. A week-long practice could check it.`, actionLabel: 'Draft the practice', disabled: saving, onAction: () => void draftPractice(strongest.claim, action, `Test: ${lead.answer.statement.slice(0, 60)}`) });
  }

  const trailing = (
    <>
      <ContextualAiPanel enabled={aiSettings.aiAssistanceEnabled} showContextBeforeSending={aiSettings.showContextBeforeSending} reasoningDepth={aiDepthFor(aiSettings, 'inquiries')} actions={['socratic_inquiry_challenge']} buildEnvelope={buildAiEnvelope} buttonLabel="Ask Noesis" promptLabel="What part of this inquiry should Noesis pressure?" promptPlaceholder="For example: Test whether my working answer actually follows from the evidence." onAccept={(result, content) => onSaveAiReview(question.id, result, content)} />
      {!question.id.startsWith('open:') && !question.id.startsWith('annotation:') && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton label="Inquiry actions" variant="outline"><MoreHorizontal className="size-4" /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditingQuestion(true)}><Pencil className="mr-2 size-4" /> Edit the question</DropdownMenuItem>
            {closed && <DropdownMenuItem onSelect={() => void onUpdateQuestion({ ...question, status: 'reopened', dateUpdated: today() })}>Reopen inquiry</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-problem focus:text-problem"><Trash2 className="mr-2 size-4" /> Delete inquiry</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );

  const placePicker = (item: { id: string; candidateId: string; claim: string }) => (
    <span className="noesis-pick" role="group" aria-label={`Place “${item.claim}” on an answer`}>
      {answers.map((answer, index) => <button key={answer.id} type="button" disabled={saving} aria-pressed={item.candidateId === answer.id} title={answer.statement} onClick={() => placeEvidence(item.id, item.candidateId === answer.id ? '' : answer.id)}>{letter(index)}</button>)}
    </span>
  );

  return (
    <RecordPage tone="examine" identity="investigation">
      <RecordHeader backLabel="Inquiries" onBack={onBack} view="questions" kind="Inquiry" status={question.status.replace(/_/g, ' ')} extra={sources.length ? `From ${sources[0].title}` : undefined} trailing={trailing}
        title={editingQuestion ? (
          <span className="block max-w-4xl space-y-3 not-italic">
            <Textarea id={`question-title-${question.id}`} aria-label="Inquiry question" value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} className="min-h-[96px] font-headline text-xl italic leading-snug sm:text-2xl" autoFocus />
            <span className="flex gap-2">
              <Button size="sm" disabled={saving || !questionDraft.trim()} onClick={async () => { if (!await onUpdateQuestion({ ...question, text: questionDraft.trim(), dateUpdated: today() })) return; setEditingQuestion(false); }}><Check /> Save question</Button>
              <Button size="sm" variant="ghost" onClick={() => { setQuestionDraft(question.text); setEditingQuestion(false); }}><X /> Cancel</Button>
            </span>
          </span>
        ) : question.text}
        tags={conceptNames}>
        <PromotedAnnotationOrigins origins={question.annotationOrigins} />
      </RecordHeader>

      <RecordPath label="Where you are in this inquiry" stops={STOPS} hereId={hereId} guide={guide} />

      {/* ---------- Thinking tools: you, alone, with the record ---------- */}
      <ToolsBand note="For you, not for Noesis. Nothing here is sent anywhere; what you write is saved to this inquiry.">
        <Tool label="What would change my mind" icon={Scale}>
          <p className="noesis-fold__hint">{lead && lead.margin > 0 ? `You lean to ${letter(lead.index)}. What would you have to see to stop leaning that way?` : 'The scale is level. What would have to be true for one answer to win?'}</p>
          <Dictation label="Dictate what would change your mind">
            <Textarea value={changeMind} onChange={(event) => setChangeMind(event.target.value)} placeholder="One observation, result, or argument that would move you" className="min-h-[72px]" aria-label="What would change your mind" maxLength={600} />
          </Dictation>
          <Button variant="primary" size="sm" disabled={saving || !changeMind.trim()} onClick={() => void saveChangeMind()}>Save to this inquiry</Button>
        </Tool>
        <Tool label="Steelman another answer" icon={Swords} disabled={answers.length < 2}>
          <p className="noesis-fold__hint">Write the strongest case for an answer you do not hold. It is saved as support on that answer, so the scale feels it.</p>
          <div className="noesis-fieldrow">
            <label><span>Answer</span><select value={steelmanId} onChange={(event) => setSteelmanId(event.target.value)} aria-label="Answer to steelman">
              <option value="">Choose an answer</option>
              {answers.map((answer, index) => <option key={answer.id} value={answer.id}>{letter(index)} · {answer.statement.slice(0, 48)}</option>)}
            </select></label>
          </div>
          <Dictation label="Dictate the strongest case">
            <Textarea value={steelman} onChange={(event) => setSteelman(event.target.value)} placeholder="The best case for that answer, stated fairly" className="min-h-[72px]" aria-label="The strongest case for that answer" maxLength={600} />
          </Dictation>
          <Button variant="primary" size="sm" disabled={saving || !steelman.trim() || !steelmanId} onClick={() => void saveSteelman()}>Add as support</Button>
        </Tool>
      </ToolsBand>

      <BenchBand note="Where you write the inquiry out, and where Noesis can read over your shoulder if you ask it to." />

      {/* ---------- Frame ---------- */}
      <RecordSection id="inq-frame" title="Frame" description="Why the question matters, before any answer." here={hereId === 'inq-frame'}
        aside={!editingFrame && <Button variant="tertiary" size="sm" onClick={() => { setEditingFrame(true); setFrameBase(question.dateUpdated); setFrameDraft({ whyItMatters: question.whyItMatters || '', currentIntuition: question.currentIntuition || '', uncertainty: question.uncertainty || '' }); }}>{frameFilled ? 'Edit starting thinking' : 'Write starting thinking'}</Button>}>
        {editingFrame ? (
          <div className="grid gap-3 md:grid-cols-3">
            {([['whyItMatters', 'Why does this matter?', 'Name the stakes, if useful.'], ['currentIntuition', 'What do you currently think?', 'Your present view can be tentative.'], ['uncertainty', 'What remains uncertain?', 'Name the part you cannot settle yet.']] as const).map(([field, label, placeholder]) => (
              <div key={field} className="grid gap-1.5">
                <Label htmlFor={`${field}-${question.id}`}>{label}</Label>
                <Textarea id={`${field}-${question.id}`} value={frameDraft[field]} onChange={(event) => setFrameDraft((prev) => ({ ...prev, [field]: event.target.value }))} placeholder={placeholder} className="min-h-[96px]" disabled={saving} />
              </div>
            ))}
            <div className="flex gap-2 md:col-span-3">
              <Button variant="secondary" onClick={saveFrame} disabled={saving}>Save</Button>
              <Button variant="ghost" onClick={() => { setEditingFrame(false); setFrameBase(undefined); }}>Cancel</Button>
            </div>
          </div>
        ) : frameFilled ? (
          <dl className="grid gap-3 md:grid-cols-3">
            {([['Why it matters', question.whyItMatters], ['Current view', question.currentIntuition], ['Still uncertain', question.uncertainty]] as const).map(([label, value]) => value?.trim() ? <div key={label}><dt><Eyebrow>{label}</Eyebrow></dt><dd className="mt-1 text-[.95rem] leading-6">{value}</dd></div> : null)}
          </dl>
        ) : (
          <SectionEmpty title="No starting thinking yet." hint="Optional. Ask Noesis can start from the question alone." />
        )}
        <div className="mt-4">
          <Eyebrow as="h3">Terms and assumptions</Eyebrow>
          {(question.assumptions || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{question.assumptions?.map((item) => <Badge key={item} tone="inquiry" className="whitespace-normal text-left normal-case tracking-normal font-body text-sm">{item}<button type="button" className="ml-1 opacity-70 hover:opacity-100" aria-label={`Remove “${item}”`} onClick={() => void removeClarification(item)}>×</button></Badge>)}</div>
          )}
          <form className="noesis-add" onSubmit={(event) => { event.preventDefault(); void addClarification(); }}>
            <Input value={clarificationDraft} onChange={(event) => setClarificationDraft(event.target.value)} placeholder="Clarify a term or name an assumption" aria-label="Term or assumption to clarify" className="h-9" />
            <Button type="submit" variant="secondary" disabled={!clarificationDraft.trim() || saving}>Add</Button>
          </form>
        </div>
      </RecordSection>

      {/* ---------- Answers ---------- */}
      <RecordSection id="inq-answers" title="Possible answers" description="Write two or more answers worth comparing. None is final." here={hereId === 'inq-answers'}>
        {answers.length ? answers.map((answer, index) => (
          <Row key={answer.id} lead={<span className="noesis-letter">{letter(index)}</span>} meta={[answer.support ? `For: ${answer.support}` : '', answer.objection ? `Against: ${answer.objection}` : ''].filter(Boolean).join(' · ') || undefined} tools={<Eyebrow size="sm">net {answerWeight(evidence, answer.id) > 0 ? '+' : ''}{answerWeight(evidence, answer.id)}</Eyebrow>} onRemove={() => void removeAnswer(answer.id)} removeLabel={`Remove answer ${letter(index)}`} disabled={saving}>
            {answer.statement}
          </Row>
        )) : <SectionEmpty title="No answers yet." />}
        <form className="noesis-add" onSubmit={(event) => { event.preventDefault(); void addAnswer(); }}>
          <Input id={`add-answer-${question.id}`} value={answerDraft} disabled={saving} onChange={(event) => setAnswerDraft(event.target.value)} placeholder="Add a possible answer" aria-label="Add a possible answer" className="h-9" />
          <Button type="submit" variant="secondary" disabled={saving || !answerDraft.trim()}>Add</Button>
        </form>
        <details className="noesis-fold">
          <summary><Button asChild variant="link" size="sm"><span>More about this answer (optional)</span></Button></summary>
          <div className="noesis-fold__body">
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={answerDetail.support} onChange={(event) => setAnswerDetail((prev) => ({ ...prev, support: event.target.value }))} placeholder="Why might it be true?" aria-label="Why might it be true" className="h-9" />
              <Input value={answerDetail.objection} onChange={(event) => setAnswerDetail((prev) => ({ ...prev, objection: event.target.value }))} placeholder="What could be wrong with it?" aria-label="What could be wrong with it" className="h-9" />
            </div>
            <label className="grid gap-1 text-sm"><span className="flex justify-between"><span>How likely does it seem?</span><b>{answerDetail.confidence * 20}%</b></span><input type="range" min={1} max={5} value={answerDetail.confidence} onChange={(event) => setAnswerDetail((prev) => ({ ...prev, confidence: Number(event.target.value) }))} className="noesis-range" aria-label="How likely the answer seems" /></label>
          </div>
        </details>
      </RecordSection>

      {/* ---------- Weigh ---------- */}
      <RecordSection id="inq-weigh" title="Weigh the evidence" description="Add what you have found, then place each piece on the answer it bears on." here={hereId === 'inq-weigh'}>
        <div className="noesis-step__cols">
          <div>
            {evidence.length ? evidence.map((item) => (
              <Row key={item.id} top className={item.direction === 'challenges' ? 'noesis-row--lead' : undefined} meta={`${item.direction} · ${item.strength}${item.origin ? ` · ${item.origin}` : ''}`}
                tools={<>{answers.length > 0 && placePicker(item)}<IconButton label={`Edit evidence: ${item.claim}`} size="sm" onClick={() => { setEditingEvidenceId(item.id); const { id: _id, date: _date, ...rest } = item; setEvidenceDraft(rest); setWriteOpen(true); window.requestAnimationFrame(() => evidenceInput.current?.focus()); }}><Pencil className="size-3.5" /></IconButton></>}
                onRemove={() => void removeEvidence(item.id)} removeLabel="Remove evidence" disabled={saving}>
                {item.claim}
              </Row>
            )) : <SectionEmpty title="No evidence yet." hint="Pull something from your workspace, or write what you have found." />}

            <details className="noesis-fold" open={pullOpen} onToggle={(event) => setPullOpen((event.target as HTMLDetailsElement).open)}>
              <summary><Button asChild variant="secondary" size="sm"><span>⇣ Pull from your workspace · {pullRecords.length}</span></Button></summary>
              <div className="noesis-fold__body">
                <p className="noesis-fold__hint">Records tagged with this question&apos;s concept come first, then linked concepts. Objections come in as challenges.</p>
                <SearchField value={pullQuery} onChange={setPullQuery} placeholder="Search your records…" label="Search your records" />
                <div className="noesis-fieldrow">
                  <label><span>From</span><select value={pullSource} onChange={(event) => setPullSource(event.target.value as PullSource | 'all')}><option value="all">Everything</option><option value="annotation">Annotations</option><option value="practice">Praxis results</option><option value="position">Position evidence</option></select></label>
                  <label><span>Concept</span><select value={pullScope} onChange={(event) => setPullScope(event.target.value as PullScope | 'all')}><option value="all">Same and linked</option><option value="same">Same concept</option><option value="near">Linked concepts</option></select></label>
                  <label><span>Comes in as</span><select value={pullDirection} onChange={(event) => setPullDirection(event.target.value as InquiryEvidence['direction'] | 'all')}><option value="all">Any</option><option value="supports">Supports</option><option value="challenges">Challenges</option><option value="contextualizes">Context</option></select></label>
                </div>
                <div className="noesis-pull-list">
                  {pullVisible.map((record) => (
                    <div key={record.key} className={`noesis-pull-item${record.direction === 'challenges' ? ' noesis-pull-item--challenge' : ''}`}>
                      <span className="noesis-pull-item__text">{record.text}<small className="noesis-row__meta">{record.scope === 'near' && record.conceptName ? `via ${record.conceptName} · ` : ''}{record.origin} · comes in as {record.direction}</small></span>
                      {answers.length ? answers.map((answer, index) => <button key={answer.id} type="button" className="noesis-mini" aria-label={`Place on answer ${letter(index)}`} disabled={saving} onClick={() => void pullIn(record, answer.id)}>→{letter(index)}</button>) : <button type="button" className="noesis-mini" disabled={saving} onClick={() => void pullIn(record, '')}>Add</button>}
                    </div>
                  ))}
                  {!pullVisible.length && <p className="noesis-fold__hint">Nothing matches. Try clearing a filter, or write new evidence.</p>}
                </div>
              </div>
            </details>

            <details className="noesis-fold" open={writeOpen} onToggle={(event) => setWriteOpen((event.target as HTMLDetailsElement).open)}>
              <summary><Button asChild variant="secondary" size="sm"><span>＋ {editingEvidenceId ? 'Edit evidence' : 'Write new evidence'}</span></Button></summary>
              <Dictation className="noesis-fold__body" label="Dictate the evidence">
                <p className="noesis-fold__hint">Not in your workspace yet? Write it here, tag it, and choose whether to keep it as a note.</p>
                <Textarea ref={evidenceInput} value={evidenceDraft.claim} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, claim: event.target.value }))} placeholder="What does it say? (a claim, an observation, an excerpt)" aria-label="What does the evidence say?" maxLength={1000} className="min-h-[64px]" />
                <div className="noesis-fieldrow">
                  <label><span>Comes in as</span><select value={evidenceDraft.direction} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, direction: event.target.value as InquiryEvidence['direction'] }))}><option value="supports">Supports</option><option value="challenges">Challenges</option><option value="contextualizes">Context only</option></select></label>
                  <label><span>Strength</span><select value={evidenceDraft.strength} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, strength: event.target.value as InquiryEvidence['strength'] }))}><option value="weak">Weak</option><option value="moderate">Moderate</option><option value="strong">Strong</option></select></label>
                  <label><span>Type</span><select value={evidenceDraft.type} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, type: event.target.value as InquiryEvidence['type'] }))}><option value="personal observation">Personal observation</option><option value="source excerpt">Source excerpt</option><option value="counterexample">Counterexample</option><option value="unknown">Unknown</option></select></label>
                  <label><span>Reliability</span><select value={evidenceDraft.reliability} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, reliability: event.target.value as InquiryEvidence['reliability'] }))}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
                  <label><span>Place on</span><select value={evidenceDraft.candidateId} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, candidateId: event.target.value }))}><option value="">Leave unplaced for now</option>{answers.map((answer, index) => <option key={answer.id} value={answer.id}>{letter(index)} · {answer.statement.slice(0, 40)}</option>)}</select></label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={evidenceDraft.origin} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, origin: event.target.value }))} placeholder="Where is it from? (optional)" aria-label="Where is it from" maxLength={200} className="h-9" />
                  <Input value={evidenceDraft.notes} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes (optional)" aria-label="Notes" maxLength={300} className="h-9" />
                </div>
                {!editingEvidenceId && <label className="noesis-check"><input type="checkbox" checked={saveAsNote} onChange={(event) => setSaveAsNote(event.target.checked)} /> Also save as a new note in Works</label>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void saveWritten()} disabled={saving || !evidenceDraft.claim.trim()}>{editingEvidenceId ? 'Save changes' : 'Add evidence'}</Button>
                  {editingEvidenceId && <Button variant="ghost" onClick={() => { setEditingEvidenceId(null); setEvidenceDraft(EMPTY_EVIDENCE); }}>Cancel edit</Button>}
                </div>
              </Dictation>
            </details>
          </div>
          <div><InquiryScale answers={answers} evidence={evidence} /></div>
        </div>
      </RecordSection>

      {/* ---------- Conclude ---------- */}
      <RecordSection id="inq-conclude" title="Conclude" description="Your best answer for now. You can reopen it any time." here={hereId === 'inq-conclude'}>
        {answers.length >= 2 && (
          <div className="noesis-decide" data-tone={lead && lead.margin >= 2 ? 'ok' : 'caution'}>
            <Eyebrow>What the scale says</Eyebrow>
            {lead && lead.margin > 0 ? (
              <p className="noesis-decide__line">
                The evidence leans to <b>{letter(lead.index)}</b> — “{lead.answer.statement}” — {lead.margin >= 2 ? 'by a clear margin' : 'only slightly'}.
              </p>
            ) : (
              <p className="noesis-decide__line">The scale is level: no answer carries more weight than another yet. Weigh more evidence, or say why you are deciding without it.</p>
            )}
            {lead && lead.margin > 0 && !working.trim() && !closed && (
              <Button variant="secondary" size="sm" onClick={() => setWorkingDraft({ value: lead.answer.statement, base: savedAnswer })}>Start from {letter(lead.index)}</Button>
            )}
          </div>
        )}
        <Dictation label="Dictate your answer">
        <Textarea aria-label="Working answer" value={working} disabled={saving || closed} onChange={(event) => { const value = event.target.value; setWorkingDraft((draft) => ({ value, base: draft?.base ?? savedAnswer })); }} className="min-h-[120px] text-base leading-7" placeholder="Write your working answer in your own words" />
        {workingConflict && <p role="status" className="mt-2 text-sm text-muted-foreground">The saved answer changed while you were writing. <Button variant="link" size="sm" onClick={() => setWorkingDraft(null)}>Load the saved answer</Button></p>}
        {!closed && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void saveWorking('provisionally_answered')} disabled={saving || workingConflict || !working.trim()}>Mark as answered</Button>
            {answered && <Button variant="outline" onClick={() => void keepInvestigating()} disabled={saving}>Keep investigating</Button>}
          </div>
        )}
        </Dictation>
        {closed && <p className="mt-3 text-sm text-muted-foreground">This inquiry is {question.status.replace(/_/g, ' ')}. <Button variant="link" size="sm" onClick={() => void onUpdateQuestion({ ...question, status: 'reopened', dateUpdated: today() })}>Reopen it</Button></p>}

        {!closed && working.trim() && (
          <details className="noesis-fold">
            <summary><Button asChild variant="tertiary" size="sm"><span>Decide the outcome</span></Button></summary>
            <div className="noesis-fold__body">
              <Label htmlFor={`resolution-${question.id}`}>What led you here?</Label>
              <Textarea id={`resolution-${question.id}`} value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} placeholder="What mattered most, and what remains open?" className="min-h-[80px]" />
              {!inquiryHasRecordedObjection(question) && (
                <div className="grid gap-1.5">
                  <Eyebrow>Checkpoint: steelman before you settle</Eyebrow>
                  <p className="text-sm text-muted-foreground">Record the strongest objection as a challenge on an answer. If that would not help here, say why you are skipping it.</p>
                  <Input value={checkpointSkipReason} onChange={(event) => setCheckpointSkipReason(event.target.value)} aria-label="Reason for skipping the steelman checkpoint" placeholder="Why is this checkpoint not useful here?" className="h-9" />
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {RESOLUTION_OPTIONS.map((option) => (
                  <button key={option.status} type="button" onClick={() => void saveWorking(option.status)} disabled={saving || workingConflict} className="noesis-panel noesis-panel--tight noesis-panel--interactive text-left" aria-pressed={question.status === option.status}>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <label className="grid gap-1 text-sm"><span>Position confidence (%)</span><Input type="number" min={0} max={100} value={positionConfidence} onChange={(event) => setPositionConfidence(Math.min(100, Math.max(0, Number(event.target.value))))} className="h-9 w-24" aria-label="Position confidence" /></label>
                <Button variant="secondary" tone="position" onClick={() => void saveWorking('converted')} disabled={saving || workingConflict}>Form a position from this answer</Button>
              </div>
            </div>
          </details>
        )}
        {beliefs.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Bears on: {beliefs.map((belief, index) => <span key={belief.id}>{index ? ' · ' : ''}<Button variant="link" size="sm" onClick={() => onOpenPosition(belief.id)}>{belief.title}</Button></span>)}</p>}
        <SuggestionCards suggestions={suggestions} />
      </RecordSection>

      <RecordFooter>
        <FooterSection title="Connections" count={sources.length + beliefs.length + drafts.length + practices.length} defaultOpen>
          <Connections groups={[
            { type: 'Sources', tone: 'source', items: sources.map((source) => ({ id: source.id, label: source.title, meta: source.creator || undefined })) },
            { type: 'Positions', tone: 'position', items: beliefs.map((belief) => ({ id: belief.id, label: belief.title, meta: `${belief.confidence}% confidence`, onOpen: () => onOpenPosition(belief.id) })) },
            { type: 'Works', tone: 'work', items: drafts.map((work) => ({ id: work.id, label: work.title || 'Untitled', onOpen: () => onOpenWork(work.id) })),
              action: (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" size="sm" onClick={() => void createWork()} disabled={saving}>Write about it in Works</Button>
                  <Select value={existingWorkId} onValueChange={setExistingWorkId} disabled={saving}><SelectTrigger aria-label="Choose an existing work to link" className="flex-1"><SelectValue placeholder="Or choose a work to link" /></SelectTrigger><SelectContent>{availableDrafts.filter((item) => !(question.draftIds?.includes(item.id) && item.questionIds?.includes(question.id))).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select>
                  <Button variant="outline" size="sm" onClick={() => void link('work', existingWorkId)} disabled={saving || !existingWorkId}>Link</Button>
                </div>
              ) },
            { type: 'Praxis', tone: 'practice', items: practices.map((practice) => ({ id: practice.id, label: practice.title, meta: practice.status.replace(/_/g, ' '), onOpen: () => onOpenPractice(practice.id) })),
              action: (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <Textarea value={testDraft.tested} onChange={(event) => setTestDraft((prev) => ({ ...prev, tested: event.target.value }))} placeholder="What are you trying to learn?" aria-label="What are you trying to learn" className="min-h-[72px]" />
                  <Textarea value={testDraft.method} onChange={(event) => setTestDraft((prev) => ({ ...prev, method: event.target.value }))} placeholder="What will you do or observe?" aria-label="What will you do or observe" className="min-h-[72px]" />
                  <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
                    <Button variant="secondary" size="sm" disabled={saving || !testDraft.tested.trim() || !testDraft.method.trim()} onClick={() => void draftPractice(testDraft.tested.trim(), testDraft.method.trim(), `Test for: ${question.text.slice(0, 60)}`)}>Design a test</Button>
                    <Select value={existingPracticeId} onValueChange={setExistingPracticeId} disabled={saving}><SelectTrigger aria-label="Choose a practice to link" className="flex-1"><SelectValue placeholder="Or choose a practice to link" /></SelectTrigger><SelectContent>{availablePractices.filter((item) => !(question.practiceIds?.includes(item.id) && item.questionIds?.includes(question.id))).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select>
                    <Button variant="outline" size="sm" onClick={() => void link('practice', existingPracticeId)} disabled={saving || !existingPracticeId}>Link</Button>
                  </div>
                </div>
              ) },
            { type: 'Concepts', tone: 'concept', items: conceptNames.map((name) => ({ id: name, label: name })) },
          ]} />
        </FooterSection>

        <FooterSection title="History" count={(question.investigationNotes || []).length}>
          <History entries={(question.investigationNotes || []).map((note) => ({ id: note.id, date: note.date, title: note.title || (note.origin === 'ai-assisted' ? 'Noesis note' : 'Note'), text: note.text }))}
            empty="Nothing recorded yet. Notes you write with a thinking tool land here." />
          {!!question.investigationNotes?.some((note) => note.origin === 'ai-assisted') && (
            <AiAssistedHistory title="Reviewed challenge notes" entries={(question.investigationNotes || []).filter((note) => note.origin === 'ai-assisted').map((note) => ({ id: note.id, action: 'socratic_inquiry_challenge', title: note.title || 'Socratic challenge', content: note.text, date: note.date, originDetails: note.provenance ? { provenance: note.provenance, target: { type: 'inquiry', id: question.id, fieldPath: 'investigationNotes.text', subrecordId: note.id } } : undefined }))}
              onChange={async (entries) => {
                const userNotes = (question.investigationNotes || []).filter((note) => note.origin !== 'ai-assisted');
                if (!await onUpdateQuestion({ ...question, investigationNotes: [...userNotes, ...entries.map((entry) => ({ ...question.investigationNotes?.find((note) => note.id === entry.id && note.origin === 'ai-assisted'), id: entry.id, title: entry.title, text: entry.content, origin: 'ai-assisted' as const, date: entry.date }))], dateUpdated: today() })) throw new Error('The challenge-note history was not saved.');
              }} />
          )}
        </FooterSection>

        <FooterSection title="Record">
          <EntityMeta items={[{ label: 'Status', value: question.status.replace(/_/g, ' ') }, { label: 'Created', value: question.dateCreated?.slice(0, 10) || '—' }, { label: 'Sources', value: sources.length }, { label: 'Evidence', value: evidence.length }]} />
        </FooterSection>

        <FooterSection title="Danger zone">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 /> Delete this inquiry</Button>
        </FooterSection>
      </RecordFooter>

      <ConfirmActionDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete inquiry?" description={`This removes "${question.text}" from Inquiries. Linked sources, positions, works, and Evolution history will remain.`} confirmLabel="Delete inquiry" alternateLabel="Archive instead" destructive
        onAlternate={async () => { if (!await onUpdateQuestion({ ...question, status: 'archived', dateUpdated: new Date().toISOString() })) throw new Error('The inquiry could not be archived. Please retry.'); }}
        onConfirm={async () => { await onDeleteQuestion(question.id); onBack(); }} />
    </RecordPage>
  );
}
