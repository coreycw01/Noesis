
"use client";

import { aiDepthFor } from '@/lib/ai-depth';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Flag, Footprints, Lightbulb, MinusCircle, PlusCircle, ExternalLink, GitBranch, Highlighter, Layers3, MoreHorizontal, Pencil, Plus, Quote, Trash2 , X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { writeBrowserPreference } from '@/lib/browser-preferences';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AiProvenanceBadge } from '@/components/ai/AiProvenanceBadge';
import { annotationEffectTarget, type AnnotationReviewApproval } from '@/lib/annotation-ai-review';
import { sourceAnnotationReviewTarget } from '@/lib/ai-provenance';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import type { AiSettings, Annotation, AnnotationPhilosophyStatus, AnnotationType, Concept, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import { allAnnotations, conceptKey, MEDIA_LABELS, normalizeConceptTags, today, uid } from '@/lib/readex';
import { MarkupSurface, markKind, shapeMarkText } from '@/components/shared/MarkupSurface';
import { Dictation } from '@/components/shared/Dictation';
import { RecordHeader, RecordPage, RecordSection } from '@/components/shared/record/RecordPage';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SectionEmpty } from '@/components/shared/SectionEmpty';
import type { AnnotationMark, AnnotationMarkKind } from '@/lib/types';
import type { BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { StageBadge } from '@/components/shared/StageBadge';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { noesisUserError } from '@/lib/user-facing-errors';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import { searchMatches } from '@/lib/search';
import { indexAnnotationInquiries } from '@/lib/inquiry-state';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { resolvedAiHistory } from '@/lib/contextual-ai';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AnnotationsIndexProps {
  media: Media[];
  concepts: Concept[];
  positions?: VaultEntry[];
  inquiries?: Question[];
  onUpdateAnnotation: (sourceId: string, annotation: Annotation, approval?: AnnotationReviewApproval) => void | Promise<Annotation | void>;
  onDeleteAnnotation: (sourceId: string, annotationId: string) => Promise<void>;
  onOpenSource: (sourceId: string) => void;
  onCreatePosition: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; sourceAnnotationId?: string; annotationRefs?: Array<{ sourceId: string; annotationId: string }>; position?: { title: string; statement: string; description: string; confidence: number } }) => Promise<{ positionId: string; insightId: string; title: string }>;
  onCreateInquiry: (data: Partial<Question> & { text: string; conceptIds: string[]; sourceIds: string[]; evidenceIds: string[]; type: 'annotation'; sourceAnnotationId?: string; annotationRefs?: Array<{ sourceId: string; annotationId: string }> }) => Promise<Question>;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onAddPractice?: (data: Partial<Practice>) => unknown;
  onNavigate?: (view: string, targetId?: string) => void;
  aiSettings?: AiSettings;
  focusedAnnotationSourceId?: string | null;
  focusedAnnotationId?: string | null;
  onOpenAnnotation?: (sourceId: string, annotationId: string) => void;
  onCloseAnnotation?: () => void;
}

type FlatAnnotation = Annotation & { source: Media };
type AnnotationFilter = AnnotationType | AnnotationPhilosophyStatus | 'all' | 'has_relationships' | 'unanswered';
type PreflightMode = 'position' | 'inquiry';
type ConsequenceAction = 'clarifies' | 'raises_question' | 'supports_claim' | 'challenges_claim' | 'reference' | 'practice' | 'form_position';
type AnnotationSort = 'newest' | 'oldest' | 'source' | 'type' | 'status';

const ANNOTATION_TYPES: Array<{ id: AnnotationType; label: string }> = [
  { id: 'excerpt', label: 'Excerpt' },
  { id: 'thought', label: 'Thought' },
  { id: 'question', label: 'Question' },
  { id: 'claim', label: 'Claim' },
  { id: 'objection', label: 'Objection' },
  { id: 'definition', label: 'Definition' },
];

const ANNOTATION_STATUSES: Array<{ id: AnnotationPhilosophyStatus; label: string }> = [
  { id: 'raw', label: 'Unreviewed' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'used_in_position', label: 'Connected' },
  { id: 'reference_only', label: 'Reference' },
  { id: 'archived', label: 'Archived' },
];

const normalizedAnnotationType = (value: AnnotationType): AnnotationType => {
  if (value === 'highlight' || value === 'excerpt' || value === 'example') return 'excerpt';
  if (value === 'personal_reflection' || value === 'observation' || value === 'connection') return 'thought';
  if (value === 'voice_note' || value === 'drawing' || value === 'image') return 'thought';
  return value;
};

const normalizedProcessingStatus = (value?: AnnotationPhilosophyStatus): AnnotationPhilosophyStatus => {
  if (!value || value === 'raw') return 'raw';
  if (value === 'connected' || value === 'questioned' || value === 'promoted' || value === 'used_in_position') return 'used_in_position';
  if (value === 'dismissed' || value === 'archived') return 'archived';
  if (value === 'reference_only') return 'reference_only';
  return 'reviewed';
};

const annotationLabel = (value: string) => ANNOTATION_TYPES.find((type) => type.id === value)?.label
  || ANNOTATION_STATUSES.find((status) => status.id === value)?.label
  || value.replace(/_/g, ' ');

interface PreflightDraft {
  mode: PreflightMode;
  annotation: FlatAnnotation;
  title: string;
  body: string;
  question: string;
  context: string;
  whyItMatters: string;
  currentIntuition: string;
  description: string;
  supportNote: string;
  challengeNote: string;
  confidence: number;
  tags: string[];
}

export function AnnotationsIndex({
  media,
  concepts,
  positions = [],
  inquiries = [],
  onUpdateAnnotation,
  onDeleteAnnotation,
  onOpenSource,
  onCreatePosition,
  onCreateInquiry,
  onAddConcept,
  onCreateLink,
  onAddPractice,
  onNavigate,
  aiSettings,
  focusedAnnotationSourceId,
  focusedAnnotationId,
  onOpenAnnotation,
  onCloseAnnotation,
}: AnnotationsIndexProps) {
  const [search, setSearch] = useState('');
  const [newAnnotationOpen, setNewAnnotationOpen] = useState(false);
  const [newAnnotationSearch, setNewAnnotationSearch] = useState('');
  const [filterType, setFilterType] = usePersistentView<AnnotationFilter>('noesis:annotations-filter', 'all', [
    'all',
    'has_relationships',
    'unanswered',
    ...ANNOTATION_TYPES.map((item) => item.id),
    ...ANNOTATION_STATUSES.map((item) => item.id),
  ]);
  const [filterConcept, setFilterConcept] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortBy, setSortBy] = usePersistentView<AnnotationSort>('noesis:annotations-sort', 'newest', ['newest', 'oldest', 'source', 'type', 'status']);
  const [viewMode, setViewMode] = useEntityViewPreference('annotations');
  const [editing, setEditing] = useState<FlatAnnotation | null>(null);
  const savedReviews = resolvedAiHistory(editing?.aiReviewHistory, editing ? {
    id: 'legacy-effect-review', action: 'suggest_annotation_effect', title: 'Effect review',
    content: editing.aiEffectReview || '', date: editing.date,
  } : undefined);
  const [editDraft, setEditDraft] = useState<FlatAnnotation | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editSaveLock = useRef(false);
  const annotationMenuTrigger = useRef<HTMLButtonElement>(null);
  const [practiceAction, setPracticeAction] = useState('');
  const creatingPractice = useRef(false);
  const [detailEffect, setDetailEffect] = useState<ConsequenceAction>('reference');
  const [preflight, setPreflight] = useState<PreflightDraft | null>(null);
  const [movingMark, setMovingMark] = useState<string | null>(null);
  const [moveText, setMoveText] = useState('');
  const markSendLock = useRef(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const positionCreationLock = useRef(false);
  const inquiryCreationLock = useRef(false);
  const [linkDialog, setLinkDialog] = useState<{ annotation: FlatAnnotation; linkType: 'supports' | 'challenges' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlatAnnotation | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const pendingDetailDeleteRef = useRef<FlatAnnotation | null>(null);
  const { toast } = useToast();

  const previewSource = (source: Media, annotation?: FlatAnnotation) => {
    openNoesisObjectPreview({
      id: `annotation-source-${source.id}`,
      label: source.title,
      section: 'Source',
      description: source.creator || source.type || 'Open source workspace.',
      view: 'library',
      targetId: source.id,
      targetType: 'source',
      objectType: 'Raw Input',
      kind: 'object',
      intellectualStage: 'Encounter',
      hierarchyLevel: 'Raw',
      currentState: source.status,
      summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.openQuestion || annotation?.context || 'The parent source for this annotation.',
      matchedBecause: annotation
        ? `This is the parent source for the annotation: "${annotation.text.slice(0, 110)}${annotation.text.length > 110 ? '...' : ''}".`
        : 'This source appears in the annotation processing inbox.',
      connectedConcepts: annotation?.conceptTags || source.tags || [],
      relatedObjects: [
        `${source.annotations?.length || 0} annotations`,
        annotation ? `Annotation type: ${annotation.type}` : 'Open source context',
        annotation?.philosophyStatus ? `Processing state: ${annotation.philosophyStatus.replace(/_/g, ' ')}` : 'Processing state unknown',
      ],
      lastChangedAt: source.dateUpdated || source.dateAdded || annotation?.date,
      quickActionLabel: 'Open Source',
      quickActions: [
        { label: 'Open Source Workspace', view: 'library', targetId: source.id, targetType: 'source' },
        { label: 'Return to Annotations', view: 'annotations' },
      ],
      thinkingEventHint: 'Previewing a source is orientation. Completing reflection, distilling a claim, or creating annotations should record intellectual development.',
    });
  };

  const annotations = useMemo(() => allAnnotations(media) as FlatAnnotation[], [media]);
  const isFullPageDetail = Boolean(focusedAnnotationSourceId && focusedAnnotationId);
  const focusedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.source.id === focusedAnnotationSourceId && annotation.id === focusedAnnotationId) || null,
    [annotations, focusedAnnotationId, focusedAnnotationSourceId]
  );
  const annotationKey = (annotation: FlatAnnotation) => `${annotation.source.id}:${annotation.id}`;
  const inquiryLookup = useMemo(() => indexAnnotationInquiries(inquiries), [inquiries]);
  const linkedInquiriesFor = React.useCallback((annotation: FlatAnnotation) =>
    inquiryLookup(annotation.id, annotation.source.id, annotation.createdInquiryId), [inquiryLookup]);
  const annotationStatus = (annotation: Annotation): AnnotationPhilosophyStatus => normalizedProcessingStatus(annotation.philosophyStatus);
  const annotationType = (annotation: Annotation): AnnotationType => normalizedAnnotationType(annotation.type);
  const annotationTags = (annotation: FlatAnnotation) => normalizeConceptTags(annotation.conceptTags || annotation.source.tags || []);
  const needsContext = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed', 'promoted', 'used_in_position'].includes(status)
      && !annotationTags(annotation).length;
  };
  const isPotentiallyImportant = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    if (['archived', 'dismissed', 'reference_only'].includes(status)) return false;
    return Boolean(
      ['claim', 'objection', 'definition', 'question'].includes(annotationType(annotation))
      || annotation.createdInquiryId
      || annotation.createdPositionId
    );
  };
  const missingSourceContext = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed'].includes(status) && !annotation.context?.trim();
  };
  const needsSupportDirection = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    if (['archived', 'reference_only', 'used_in_position'].includes(status)) return false;
    const isEvidenceLike = ['claim', 'objection'].includes(annotationType(annotation));
    return isEvidenceLike && !(annotation.linkedPositionIds || []).length && !annotation.createdPositionId;
  };
  const isEvidenceReady = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed', 'reference_only'].includes(status)
      && annotationTags(annotation).length > 0
      && ['claim', 'objection', 'definition'].includes(annotationType(annotation));
  };
  const isRecentlyPromoted = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return Boolean(annotation.createdInquiryId || annotation.createdPositionId || status === 'used_in_position');
  };
  const annotationProcessingQuality = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    const tags = annotationTags(annotation);
    const missing: string[] = [];
    let score = 0;

    if (tags.length) score += 1;
    else missing.push('concept tag');

    if (annotation.context?.trim()) score += 1;
    else missing.push('source context');

    if (
      ['reviewed', 'used_in_position', 'reference_only', 'archived'].includes(status)
      || annotation.createdInquiryId
      || annotation.createdPositionId
    ) score += 1;
    else missing.push('effect');

    if (needsSupportDirection(annotation)) {
      missing.push('support/challenge direction');
    } else {
      score += 1;
    }

    const label = score >= 4
      ? 'processed'
      : score >= 3
        ? 'needs refinement'
      : score >= 2
        ? 'needs processing'
          : 'raw capture';

    const nextStep = missing[0]
      ? `Add ${missing[0]}`
      : annotation.createdPositionId || annotation.createdInquiryId
        ? 'Review destination object'
        : 'Ready for synthesis';

    return { score, missing, label, nextStep };
  };

  const filtered = useMemo(() => {
    return annotations
      .filter((annotation) => {
        let typeOk = true;
        if (filterType === 'unanswered') {
          typeOk = annotationType(annotation) === 'question' && !linkedInquiriesFor(annotation).length;
        } else if (filterType === 'has_relationships') {
          typeOk = Boolean(linkedInquiriesFor(annotation).length || annotation.createdPositionId || (annotation.linkedPositionIds || []).length);
        } else if (filterType !== 'all') {
          typeOk = ANNOTATION_TYPES.some((option) => option.id === filterType)
            ? annotationType(annotation) === filterType
            : annotationStatus(annotation) === filterType;
        }
        const conceptOk = filterConcept === 'all' || annotationTags(annotation).map(conceptKey).includes(filterConcept);
        const sourceOk = filterSource === 'all' || annotation.source.id === filterSource;
        const relatedPositions = (positions || []).filter((position) => (annotation.linkedPositionIds || []).includes(position.id) || annotation.createdPositionId === position.id);
        const relatedInquiries = linkedInquiriesFor(annotation);
        const searchOk = searchMatches(search, [
          { value: annotation.text, label: 'annotation' },
          { value: annotation.context, label: 'context' },
          { value: annotation.answer, label: 'answer' },
          { value: annotationType(annotation), label: 'type' },
          { value: annotationStatus(annotation), label: 'processing state' },
          { value: annotation.source.title, label: 'source' },
          { value: annotation.source.creator, label: 'source creator' },
          ...annotationTags(annotation).map((tag) => ({ value: tag, label: 'concept' })),
          ...relatedPositions.map((position) => ({ value: position.title, label: 'position' })),
          ...relatedInquiries.map((inquiry) => ({ value: inquiry.text, label: 'inquiry' })),
        ]);
        return typeOk && conceptOk && sourceOk && searchOk;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'source') return a.source.title.localeCompare(b.source.title) || new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'type') return annotationLabel(annotationType(a)).localeCompare(annotationLabel(annotationType(b))) || new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'status') return annotationLabel(annotationStatus(a)).localeCompare(annotationLabel(annotationStatus(b))) || new Date(b.date).getTime() - new Date(a.date).getTime();
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [annotations, linkedInquiriesFor, positions, search, filterType, filterConcept, filterSource, sortBy]);

  const selectedAnnotations = useMemo(
    () => annotations.filter((annotation) => selectedKeys.includes(annotationKey(annotation))),
    [annotations, selectedKeys]
  );

  const allConcepts = useMemo(() => {
    const tags = new Set<string>();
    annotations.forEach((annotation) => {
      (annotation.conceptTags || annotation.source.tags || []).forEach((tag) => tags.add(conceptKey(tag)));
    });
    return Array.from(tags).sort();
  }, [annotations]);
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      total: annotations.length,
      unanswered: annotations.filter((annotation) => annotationType(annotation) === 'question' && !linkedInquiriesFor(annotation).length).length,
      has_relationships: annotations.filter((annotation) => linkedInquiriesFor(annotation).length || annotation.createdPositionId || (annotation.linkedPositionIds || []).length).length,
    };
    ANNOTATION_TYPES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotationType(annotation) === option.id).length;
    });
    ANNOTATION_STATUSES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotationStatus(annotation) === option.id).length;
    });
    return counts;
  }, [annotations, linkedInquiriesFor]);

  const persistAnnotation = async (sourceId: string, annotation: Annotation) => {
    try {
      await onUpdateAnnotation(sourceId, annotation);
      return true;
    } catch (error) {
      toast({ title: 'Annotation not saved', description: noesisUserError(error, 'save this annotation'), variant: 'destructive' });
      return false;
    }
  };

  const updateAnnotationConsequence = (annotation: FlatAnnotation, patch: Partial<Annotation>) => {
    const { source, ...annotationData } = annotation;
    void persistAnnotation(source.id, {
      ...annotationData,
      ...patch,
      philosophyStatus: patch.philosophyStatus || annotationData.philosophyStatus || 'reviewed',
    });
  };

  const saveEditing = async (candidate: FlatAnnotation) => {
    if (!candidate.text.trim() || editSaveLock.current) return false;
    const { source, ...annotation } = candidate;
    const next = {
      ...annotation,
      text: annotation.text.trim(),
      conceptTags: normalizeConceptTags(annotation.conceptTags || source.tags),
      philosophyStatus: annotation.philosophyStatus || 'reviewed',
      date: annotation.date || today(),
    };
    editSaveLock.current = true;
    setSavingEdit(true);
    try {
      if (!await persistAnnotation(source.id, next)) return false;
      setEditing(current => current?.id === next.id && current.source.id === source.id ? { ...next, source } : current);
      toast({ title: 'Annotation saved' });
      return true;
    } finally { editSaveLock.current = false; setSavingEdit(false); }
  };

  const openPreflight = (annotation: FlatAnnotation, mode: PreflightMode) => {
    const tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags);
    const sourceLabel = `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}`;
    const context = [
      `Source: ${sourceLabel}`,
      annotation.context ? `Context: ${annotation.context}` : '',
      annotation.answer ? `Existing answer/interpretation: ${annotation.answer}` : '',
    ].filter(Boolean).join('\n');
    const conceptPhrase = tags.length ? ` It is connected to ${tags.join(', ')}.` : '';
    setPreflight({
      mode,
      annotation,
      title: annotation.text.slice(0, 90),
      body: annotation.answer ? annotation.answer : annotation.text,
      question: annotation.type === 'question' ? annotation.text : `What does this imply: ${annotation.text}`,
      context,
      whyItMatters: `This annotation from ${sourceLabel} may change how I understand the related concept or position.${conceptPhrase}`,
      currentIntuition: annotation.answer || annotation.context || annotation.text,
      description: `Formed from an annotation in ${sourceLabel}.\n\nAnnotation:\n${annotation.text}${annotation.context ? `\n\nContext:\n${annotation.context}` : ''}`,
      supportNote: annotation.type === 'objection' || annotation.consequenceKind === 'objection' ? '' : annotation.text,
      challengeNote: annotation.type === 'objection' || annotation.consequenceKind === 'objection' ? annotation.text : '',
      confidence: 60,
      tags,
    });
  };

  const submitPreflight = async () => {
    if (!preflight) return;
    const createdId = preflight.mode === 'position'
      ? await createPosition(preflight.annotation, preflight.title, preflight.body, preflight.tags, true, preflight)
      : await createInquiry(preflight.annotation, preflight.question, preflight.tags, true, preflight);
    if (createdId) setPreflight(null);
  };

  const createPosition = async (
    annotation: FlatAnnotation,
    title = annotation.text.slice(0, 90),
    body = annotation.answer ? `${annotation.text}\n\nAnswer: ${annotation.answer}` : annotation.text,
    tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags),
    navigateOnCreate = false,
    shaped?: PreflightDraft
  ) => {
    if (annotation.createdPositionId) {
      toast({ title: 'Position already exists', description: 'This annotation already has a position draft.' });
      if (navigateOnCreate) onNavigate?.('vault', annotation.createdPositionId);
      return annotation.createdPositionId;
    }
    if (positionCreationLock.current) return;
    positionCreationLock.current = true;
    setPendingAction(`position:${annotation.id}`);
    try {
      const created = await onCreatePosition({
        title,
        body: [
          body,
          shaped?.context ? `\n\nSource context:\n${shaped.context}` : '',
          shaped?.supportNote ? `\n\nSupporting evidence:\n${shaped.supportNote}` : '',
          shaped?.challengeNote ? `\n\nChallenge pressure:\n${shaped.challengeNote}` : '',
        ].filter(Boolean).join(''),
        tags,
        sourceIds: [annotation.source.id],
        sourceAnnotationId: annotation.id,
        annotationRefs: [{ sourceId: annotation.source.id, annotationId: annotation.id }],
        position: {
          title,
          statement: body,
          description: shaped?.description || `Formed from annotation: ${annotation.text}`,
          confidence: shaped?.confidence ?? 60,
        },
      });
      toast({ title: 'Position draft created from annotation.', description: `Saved as "${created.title}".` });
      if (navigateOnCreate) onNavigate?.('vault', created.positionId);
      return created.positionId;
    } catch {
      toast({ title: 'Position not saved', description: 'Your annotation is unchanged. Please retry.', variant: 'destructive' });
      return;
    } finally { positionCreationLock.current = false; setPendingAction(null); }
  };

  const createInquiry = async (
    annotation: FlatAnnotation,
    text = annotation.type === 'question' ? annotation.text : `What does this imply: ${annotation.text}`,
    tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags),
    navigateOnCreate = false,
    shaped?: PreflightDraft
  ) => {
    if (annotation.createdInquiryId) {
      toast({ title: 'Inquiry already exists', description: 'This annotation already has an inquiry.' });
      if (navigateOnCreate) onNavigate?.('questions', annotation.createdInquiryId);
      return annotation.createdInquiryId;
    }
    if (inquiryCreationLock.current) return;
    inquiryCreationLock.current = true;
    setPendingAction(`inquiry:${annotation.id}`);
    try {
    const created = await onCreateInquiry({
      text,
      whyItMatters: shaped?.whyItMatters || `This inquiry was opened from an annotation in ${annotation.source.title}.`,
      currentIntuition: shaped?.currentIntuition || annotation.answer || annotation.context || '',
      assumptions: [
        `The annotation is relevant evidence from ${annotation.source.title}.`,
        ...(tags.length ? [`The key concepts are ${tags.join(', ')}.`] : []),
      ],
      conceptIds: concepts.filter((concept) => tags.map(conceptKey).includes(conceptKey(concept.name))).map((concept) => concept.id),
      sourceIds: [annotation.source.id],
      evidenceIds: [annotation.id],
      type: 'annotation',
      sourceAnnotationId: annotation.id,
      annotationRefs: [{ sourceId: annotation.source.id, annotationId: annotation.id }],
    });
    toast({ title: 'Inquiry draft created from annotation.', description: 'You can keep working it in Inquiries.' });
    if (navigateOnCreate) onNavigate?.('questions', created.id);
    return created.id;
    } catch (error) {
      toast({ title: 'Inquiry not saved', description: error instanceof Error ? error.message : 'Your annotation is unchanged. Please retry.', variant: 'destructive' });
      return;
    } finally { inquiryCreationLock.current = false; setPendingAction(null); }
  };

  const toggleSelected = (annotation: FlatAnnotation) => {
    const key = annotationKey(annotation);
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const toggleVisibleSelection = () => {
    const visibleKeys = filtered.map(annotationKey);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.includes(key));
    setSelectedKeys((current) => {
      if (allVisibleSelected) return current.filter((key) => !visibleKeys.includes(key));
      return Array.from(new Set([...current, ...visibleKeys]));
    });
  };

  const updateSelectedStatus = (status: AnnotationPhilosophyStatus) => {
    selectedAnnotations.forEach((selectedAnnotation) => {
      const { source, ...annotationData } = selectedAnnotation;
      void persistAnnotation(source.id, { ...annotationData, philosophyStatus: status });
    });
    toast({ title: 'Annotations updated', description: `${selectedAnnotations.length} annotations marked ${status.replace(/_/g, ' ')}.` });
    setSelectedKeys([]);
  };

  const runConsequenceAction = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    const { source, ...annotationData } = annotation;
    if (action === 'form_position') { openPreflight(annotation, 'position'); return; }
    if (action === 'practice' && onAddPractice) {
      if (creatingPractice.current || !practiceAction.trim()) return;
      creatingPractice.current = true;
      void Promise.resolve().then(() => onAddPractice({ title: practiceAction.trim(), action: practiceAction.trim(), description: `From ${annotation.source.title}: “${annotation.text}”`, type: 'habit', status: 'planned', sourceIds: [annotation.source.id], conceptTags: annotation.conceptTags || [] })).then(() => toast({ title: 'Practice created' })).catch(() => toast({ title: 'Practice could not be saved', variant: 'destructive' })).finally(() => { creatingPractice.current = false; });
      return;
    }
    if (action === 'clarifies') {
      void persistAnnotation(source.id, { ...annotationData, philosophyStatus: 'connected' });
      toast({ title: 'Annotation applied as conceptual clarification.', description: 'It remains discoverable through its source and concept tags.' });
      return;
    }
    if (action === 'raises_question') {
      const inquiry = linkedInquiriesFor(annotation)[0];
      if (inquiry) {
        onNavigate?.('questions', inquiry.id);
        return;
      }
      openPreflight(annotation, 'inquiry');
      return;
    }
    if (action === 'supports_claim') {
      if (positions.length) {
        setLinkDialog({ annotation, linkType: 'supports' });
      } else {
        openPreflight(annotation, 'position');
      }
      return;
    }
    if (action === 'challenges_claim') {
      if (positions.length) {
        setLinkDialog({ annotation, linkType: 'challenges' });
      } else {
        openPreflight(annotation, 'position');
      }
      return;
    }
    void persistAnnotation(source.id, { ...annotationData, philosophyStatus: 'reference_only' });
    toast({ title: 'Saved as reference.', description: 'This note remains searchable without becoming a position, inquiry, or concept change.' });
  };

  const consequenceQuestion = (annotation: FlatAnnotation) => {
    if (annotation.type === 'question') return 'What question does this raise?';
    if (annotation.type === 'connection') return 'What relationship does this reveal?';
    if (annotation.type === 'highlight') return 'What claim or concept does this clarify?';
    return 'What does this thought affect?';
  };

  const selectedEffectForAnnotation = (annotation: FlatAnnotation): ConsequenceAction => {
    if (linkedInquiriesFor(annotation).length || annotation.type === 'question' || annotation.consequenceKind === 'question') return 'raises_question';
    if ((annotation.linkedPositionIds || []).length || annotation.createdPositionId || ['evidence', 'claim'].includes(annotation.consequenceKind || '')) return 'supports_claim';
    if (annotation.type === 'objection' || annotation.consequenceKind === 'objection') return 'challenges_claim';
    if (annotation.philosophyStatus === 'reference_only') return 'reference';
    if (annotation.type === 'definition' || annotation.consequenceKind === 'definition') return 'clarifies';
    return 'reference';
  };

  const openAnnotationDetail = (annotation: FlatAnnotation) => {
    if (onOpenAnnotation) {
      onOpenAnnotation(annotation.source.id, annotation.id);
      return;
    }
    setPracticeAction('');
    setDetailEffect(selectedEffectForAnnotation(annotation));
    setEditDraft(null);
    setEditing(annotation);
  };

  useEffect(() => {
    if (!isFullPageDetail) return;
    if (!focusedAnnotation) {
      setEditing(null);
      return;
    }
    setPracticeAction('');
    setDetailEffect(selectedEffectForAnnotation(focusedAnnotation));
    setEditDraft(null);
    setEditing(focusedAnnotation);
  }, [focusedAnnotation, isFullPageDetail]);

  const closeAnnotationDetail = () => {
    if (isFullPageDetail) onCloseAnnotation?.();
    else setEditing(null);
  };

  const nextActionLabelForEffect = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    if (action === 'raises_question') return linkedInquiriesFor(annotation).length ? 'Open inquiry' : 'Start inquiry';
    if (action === 'supports_claim') return positions.length ? 'Choose a position' : 'Create position draft';
    if (action === 'challenges_claim') return positions.length ? 'Choose a position' : 'Create position draft';
    if (action === 'form_position') return 'Draft position';
    if (action === 'practice') return 'Create planned practice';
    if (action === 'clarifies') return 'Apply concept';
    return 'Finish';
  };

  const connectionsForAnnotation = (annotation: FlatAnnotation) => {
    const linkedPositionIds = Array.from(new Set([...(annotation.linkedPositionIds || []), annotation.createdPositionId].filter(Boolean) as string[]));
    const linkedPositions = positions.filter((position) => linkedPositionIds.includes(position.id));
    const linkedInquiries = linkedInquiriesFor(annotation);
    const linkedConcepts = annotationTags(annotation);
    return [
      {
        label: 'Positions',
        items: linkedPositions.map((position) => ({ id: position.id, label: position.title, open: onNavigate ? () => onNavigate('vault', position.id) : undefined })),
      },
      {
        label: 'Inquiries',
        items: linkedInquiries.map((inquiry) => ({ id: inquiry.id, label: inquiry.text, open: onNavigate ? () => onNavigate('questions', inquiry.id) : undefined })),
      },
      {
        label: 'Concepts',
        items: linkedConcepts.map((label) => ({ id: label, label, open: undefined })),
      },
      {
        label: 'Source',
        items: [{ id: annotation.source.id, label: annotation.source.title, open: onNavigate ? () => onNavigate('library', annotation.source.id) : undefined }],
      },
    ].filter((group) => group.items.length > 0);
  };

  // A mark's kind is its destination, so marking is the whole decision: the
  // list below only shapes the words and confirms. The annotation never moves.
  const addMark = async (annotation: FlatAnnotation, kind: AnnotationMarkKind, start: number, end: number, marked: string) => {
    const { source, ...data } = annotation;
    const mark: AnnotationMark = { id: uid(), start, end, kind, text: marked, date: today() };
    const marks = [...(annotation.marks || []), mark];
    if (!await persistAnnotation(source.id, { ...data, marks })) return;
    setEditing((current) => current && current.id === annotation.id ? { ...current, marks } : current);
    toast({ title: `Marked as ${markKind(kind).label.toLowerCase()}`, description: kind === 'reference' ? 'It stays in this passage.' : `Send it to ${markKind(kind).destination} when you are ready.` });
  };
  const removeMark = async (annotation: FlatAnnotation, markId: string) => {
    const { source, ...data } = annotation;
    const marks = (annotation.marks || []).filter((mark) => mark.id !== markId);
    if (!await persistAnnotation(source.id, { ...data, marks })) return;
    setEditing((current) => current && current.id === annotation.id ? { ...current, marks } : current);
    if (movingMark === markId) setMovingMark(null);
  };
  const recordMoved = async (annotation: FlatAnnotation, markId: string, movedTo: NonNullable<AnnotationMark['movedTo']>, movedId: string, movedText: string) => {
    const { source, ...data } = annotation;
    const marks = (annotation.marks || []).map((mark) => mark.id === markId ? { ...mark, movedTo, movedId, movedText } : mark);
    await persistAnnotation(source.id, { ...data, marks });
    setEditing((current) => current && current.id === annotation.id ? { ...current, marks } : current);
    setMovingMark(null);
  };
  const sendMark = async (annotation: FlatAnnotation, mark: AnnotationMark) => {
    const text = moveText.trim();
    if (!text || markSendLock.current) return;
    markSendLock.current = true;
    const tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags);
    const sourceLabel = `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}`;
    const provenance = `Marked as a ${mark.kind} in an annotation from ${sourceLabel}:\n“${mark.text}”`;
    try {
      if (mark.kind === 'claim') {
        const created = await onCreatePosition({
          title: text.slice(0, 90), body: `${text}\n\n${provenance}`, tags, sourceIds: [annotation.source.id], sourceAnnotationId: annotation.id,
          annotationRefs: [{ sourceId: annotation.source.id, annotationId: annotation.id }],
          position: { title: text.slice(0, 90), statement: text, description: provenance, confidence: 55 },
        });
        await recordMoved(annotation, mark.id, 'position', created.positionId, text);
        toast({ title: 'Claim sent to Positions', description: created.title });
        onNavigate?.('vault', created.positionId);
      } else if (mark.kind === 'question') {
        const created = await onCreateInquiry({
          text, whyItMatters: provenance, currentIntuition: annotation.answer || annotation.context || '',
          conceptIds: concepts.filter((concept) => tags.map(conceptKey).includes(conceptKey(concept.name))).map((concept) => concept.id),
          sourceIds: [annotation.source.id], evidenceIds: [annotation.id], type: 'annotation', sourceAnnotationId: annotation.id,
          annotationRefs: [{ sourceId: annotation.source.id, annotationId: annotation.id }],
        });
        await recordMoved(annotation, mark.id, 'inquiry', created.id, text);
        toast({ title: 'Question sent to Inquiries' });
        onNavigate?.('questions', created.id);
      } else if (mark.kind === 'action' && onAddPractice) {
        await Promise.resolve(onAddPractice({
          title: text.slice(0, 90), action: text, description: provenance, type: 'experiment', status: 'proposed',
          conceptTags: tags, sourceIds: [annotation.source.id], durationMode: 'repeated', durationDays: 7,
        }));
        await recordMoved(annotation, mark.id, 'practice', '', text);
        toast({ title: 'Action sent to Praxis', description: 'Open Praxis to finish its setup.' });
      } else if (mark.kind === 'definition') {
        const { source, ...data } = annotation;
        await persistAnnotation(source.id, { ...data, conceptTags: normalizeConceptTags(annotation.conceptTags || annotation.source.tags), philosophyStatus: 'connected' });
        await recordMoved(annotation, mark.id, 'concept', tags[0] || '', text);
        toast({ title: 'Definition tied to the concept', description: tags[0] ? `Attached to ${tags[0]}.` : 'Attached to this annotation’s concepts.' });
      }
    } catch {
      toast({ title: 'Not sent', description: 'The mark is still here. Please try again.', variant: 'destructive' });
    } finally { markSendLock.current = false; }
  };

  const runDetailAction = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    if (!isFullPageDetail) setEditing(null);
    runConsequenceAction(annotation, action);
  };

  const createPositionFromSelection = async () => {
    if (!selectedAnnotations.length || positionCreationLock.current) return;
    positionCreationLock.current = true;
    setPendingAction('selected-positions');
    const sourceIds = Array.from(new Set(selectedAnnotations.map((annotation) => annotation.source.id)));
    const tags = normalizeConceptTags(selectedAnnotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []));
    const first = selectedAnnotations[0];
    const body = selectedAnnotations.map((annotation) => `- ${annotation.text}${annotation.answer ? `\n  Answer: ${annotation.answer}` : ''}`).join('\n\n');
    const sourceContext = selectedAnnotations
      .map((annotation) => `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}: ${annotation.context || annotation.text}`)
      .join('\n');
    try {
      const created = await onCreatePosition({
        title: first.text.slice(0, 90),
        body: `${body}\n\nSource context:\n${sourceContext}`,
        tags,
        sourceIds,
        sourceAnnotationId: first.id,
        annotationRefs: selectedAnnotations.map((annotation) => ({ sourceId: annotation.source.id, annotationId: annotation.id })),
        position: {
          title: first.text.slice(0, 90),
          statement: first.answer || first.text,
          description: `Formed from ${selectedAnnotations.length} annotation${selectedAnnotations.length === 1 ? '' : 's'} across ${sourceIds.length} source${sourceIds.length === 1 ? '' : 's'}.\n\n${sourceContext}`,
          confidence: 60,
        },
      });
      toast({ title: 'Position created from selected annotations.', description: created.title });
      setSelectedKeys([]);
      onNavigate?.('vault', created.positionId);
    } catch {
      toast({ title: 'Position not saved', description: 'Your selected annotations are still here. Please retry.', variant: 'destructive' });
    } finally { positionCreationLock.current = false; setPendingAction(null); }
  };

  const createInquiryFromSelection = async () => {
    if (!selectedAnnotations.length || inquiryCreationLock.current) return;
    inquiryCreationLock.current = true;
    setPendingAction('selected-inquiries');
    const sourceIds = Array.from(new Set(selectedAnnotations.map((annotation) => annotation.source.id)));
    const evidenceIds = selectedAnnotations.map((annotation) => annotation.id);
    const tags = normalizeConceptTags(selectedAnnotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []));
    const sourceContext = selectedAnnotations
      .map((annotation) => `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}: ${annotation.context || annotation.text}`)
      .join('\n');
    try {
    const created = await onCreateInquiry({
      text: selectedAnnotations.find((annotation) => annotation.type === 'question')?.text || `What follows from these annotations?\n\n${selectedAnnotations.map((annotation) => `- ${annotation.text}`).join('\n')}`,
      whyItMatters: `This inquiry was formed from ${selectedAnnotations.length} related annotation${selectedAnnotations.length === 1 ? '' : 's'} and should preserve their shared evidence context.`,
      currentIntuition: sourceContext,
      assumptions: [
        'The selected annotations are related enough to investigate together.',
        ...(tags.length ? [`The relevant concepts are ${tags.join(', ')}.`] : []),
      ],
      conceptIds: concepts.filter((concept) => tags.map(conceptKey).includes(conceptKey(concept.name))).map((concept) => concept.id),
      sourceIds,
      evidenceIds,
      type: 'annotation',
      sourceAnnotationId: selectedAnnotations[0].id,
      annotationRefs: selectedAnnotations.map((annotation) => ({ sourceId: annotation.source.id, annotationId: annotation.id })),
    });
    toast({ title: 'Inquiry created from selected annotations.', description: created.text.slice(0, 90) });
    setSelectedKeys([]);
    onNavigate?.('questions', created.id);
    } catch (error) {
      toast({ title: 'Inquiry not saved', description: error instanceof Error ? error.message : 'Your selected annotations are still here. Please retry.', variant: 'destructive' });
    } finally { inquiryCreationLock.current = false; setPendingAction(null); }
  };

  const rawFilterButtons: { id: AnnotationFilter; label: string; count: number; always?: boolean }[] = [
    { id: 'all', label: 'All', count: typeCounts.total },
    { id: 'raw', label: 'Unreviewed', count: typeCounts.raw || 0, always: true },
    { id: 'reviewed', label: 'Reviewed', count: typeCounts.reviewed || 0 },
    { id: 'used_in_position', label: 'Applied', count: typeCounts.used_in_position || 0 },
    { id: 'reference_only', label: 'Reference', count: typeCounts.reference_only || 0 },
    { id: 'archived', label: 'Archived', count: typeCounts.archived || 0 },
    { id: 'has_relationships', label: 'Linked', count: typeCounts.has_relationships || 0 },
  ];
  const filterButtons = rawFilterButtons.filter((button) => button.id === 'all' || button.always || button.count > 0 || filterType === button.id);

  const clearFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterConcept('all');
    setFilterSource('all');
  };

  const filtersActive = Boolean(search || filterType !== 'all' || filterConcept !== 'all' || filterSource !== 'all');

  return (
    <div className="noesis-page noesis-annotations-index" data-noesis-identity="marginalia">
      <div className={cn(isFullPageDetail && 'hidden')}>
      <PageHeader
        title="Annotations"
        description="Review and refine captured highlights, thoughts, questions, and connections across all sources."
        meta={<span>{typeCounts.total} {typeCounts.total === 1 ? 'excerpt' : 'excerpts'}</span>}
        actions={media.length ? (
          <Button type="button" onClick={() => setNewAnnotationOpen(true)} className="rounded-full">
            <Plus className="size-4" aria-hidden="true" /> New annotation
          </Button>
        ) : undefined}
      />
      <Dialog open={newAnnotationOpen} onOpenChange={(open) => { setNewAnnotationOpen(open); if (!open) setNewAnnotationSearch(''); }}>
        <DialogContent className="max-h-[min(84dvh,40rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>New annotation</DialogTitle>
            <DialogDescription>Every note belongs to a source. Choose one and it opens at Capture.</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={newAnnotationSearch} onChange={(event) => setNewAnnotationSearch(event.target.value)} placeholder="Search sources" aria-label="Search sources" />
          <ul className="-mx-1 max-h-[22rem] space-y-1 overflow-y-auto px-1">
            {media.filter((source) => !newAnnotationSearch.trim() || `${source.title} ${source.creator || ''}`.toLowerCase().includes(newAnnotationSearch.trim().toLowerCase())).slice(0, 40).map((source) => (
              <li key={source.id}>
                <button
                  type="button"
                  className="grid w-full gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    writeBrowserPreference('noesis:source-open-step', 'annotations', 'sessionStorage');
                    setNewAnnotationOpen(false);
                    onOpenSource(source.id);
                  }}
                >
                  <span className="text-sm font-medium">{source.title}</span>
                  <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{[source.creator, source.type, `${(source.annotations || []).length} notes`].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search notes, sources, concepts, linked positions..."
        resultCount={filtered.length}
        resultLabel="annotations"
        onClear={clearFilters}
        clearDisabled={!filtersActive}
        sortLabel={sortBy.replace(/_/g, ' ')}
        relatedLookups={[
          {
            id: 'sources',
            label: 'Sources',
            value: filterSource,
            onSelect: setFilterSource,
            options: media.map((source) => ({
              value: source.id,
              label: source.title,
              description: source.creator || MEDIA_LABELS[source.type],
            })),
          },
          {
            id: 'concepts',
            label: 'Concepts',
            value: filterConcept,
            onSelect: setFilterConcept,
            options: allConcepts.map((concept) => ({
              value: concept,
              label: concept,
              description: 'Concept tag',
            })),
          },
        ]}
        viewControl={
          <ViewModeToggle
            value={viewMode === 'table' ? 'table' : 'grid'}
            modes={['grid', 'table']}
            onChange={(value) => setViewMode(value === 'table' ? 'table' : 'cards')}
            label="Annotation view"
          />
        }
        className="mb-5"
      >
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as AnnotationSort)}>
          <SelectTrigger aria-label="Sort annotations" className="w-44 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest" className="noesis-eyebrow">Recently added</SelectItem>
            <SelectItem value="status" className="noesis-eyebrow">Recently updated</SelectItem>
            <SelectItem value="source" className="noesis-eyebrow">Source order</SelectItem>
            <SelectItem value="oldest" className="noesis-eyebrow">Oldest</SelectItem>
            <SelectItem value="type" className="noesis-eyebrow">A-Z by type</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ANNOTATION_TYPES.some((option) => option.id === filterType) ? filterType : 'all'} onValueChange={(value) => setFilterType(value as AnnotationFilter)}>
          <SelectTrigger aria-label="Filter by annotation type" className="w-44 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow">All types</SelectItem>
            {ANNOTATION_TYPES.map((type) => <SelectItem key={type.id} value={type.id} className="noesis-eyebrow">{type.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-1.5">
          {filterButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              aria-pressed={filterType === button.id}
              onClick={() => setFilterType(button.id)}
              className={cn(
                "min-h-10 px-3 py-2 rounded-full text-[9px] font-code font-bold uppercase tracking-[0.14em] transition-all shadow-sm",
                filterType === button.id ? "border border-ring bg-muted text-foreground" : "bg-card text-muted-foreground border border-border/60 hover:text-foreground"
              )}
            >
              {button.label} {button.count}
            </button>
          ))}
        </div>

      </FilterToolbar>

      {annotations.length > 0 && (() => {
        const stages: Array<{ id: AnnotationPhilosophyStatus; label: string; tone: string }> = [
          { id: 'raw', label: 'Captured', tone: 'encounter' },
          { id: 'reviewed', label: 'Reviewed', tone: 'examine' },
          { id: 'used_in_position', label: 'Developed', tone: 'claim' },
          { id: 'reference_only', label: 'Reference', tone: 'more' },
          { id: 'archived', label: 'Set aside', tone: 'integrate' },
        ];
        const counts = stages.map((stage) => annotations.filter((annotation) => annotationStatus(annotation) === stage.id).length);
        const total = counts.reduce((sum, count) => sum + count, 0) || 1;
        return (
          <section className="noesis-flowbar mb-6" aria-label="Where your notes are">
            <div className="noesis-instrument__label">Where your notes are · {annotations.length}</div>
            <div className="noesis-flowbar__bar" role="img" aria-label={stages.map((stage, index) => `${stage.label} ${counts[index]}`).join(', ')}>
              {stages.map((stage, index) => counts[index] ? <span key={stage.id} data-stage-tone={stage.tone} style={{ flexGrow: counts[index] / total }} title={`${stage.label}: ${counts[index]}`} /> : null)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {stages.map((stage, index) => (
                <button key={stage.id} type="button" data-stage-tone={stage.tone} className="noesis-flowbar__key" aria-pressed={filterType === stage.id} onClick={() => setFilterType(filterType === stage.id ? 'all' : stage.id as AnnotationFilter)}>
                  <i />{stage.label} <b>{counts[index]}</b>
                </button>
              ))}
            </div>
          </section>
        );
      })()}
      {(() => {
        const unsorted = annotations.filter((annotation) => !annotation.consequenceKind && !annotation.createdInquiryId && !annotation.createdPositionId && !(annotation.linkedPositionIds || []).length && !linkedInquiriesFor(annotation).length && annotationStatus(annotation) !== 'archived' && annotationStatus(annotation) !== 'reference_only');
        if (!unsorted.length) return null;
        const kinds: Array<[NonNullable<Annotation['consequenceKind']>, string, string]> = [['evidence', 'Evidence', 'act'], ['objection', 'Objection', 'claim'], ['question', 'Question', 'examine'], ['definition', 'Definition', 'outline'], ['claim', 'Claim', 'integrate']];
        return (
          <details className="noesis-tray mb-6">
            <summary className="cursor-pointer py-2 text-sm font-medium">Sorting tray · {unsorted.length} to mark</summary>
            {unsorted.slice(0, 4).map((annotation) => (
              <div key={`${annotation.source.id}:${annotation.id}`} className="noesis-tray__row">
                <p className="noesis-tray__text">{annotation.text}</p>
                <p className="noesis-tray__src">{annotation.source.title}{annotation.date && Number.isFinite(Date.parse(annotation.date)) ? ` · ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(annotation.date))}` : ''}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`What does “${annotation.text.slice(0, 40)}” do?`}>
                  {kinds.map(([kind, label, tone]) => (
                    <Pill key={kind} look="mono" tone="stage" data-stage-tone={tone} onClick={() => {
                      const { source, ...annotationData } = annotation;
                      void persistAnnotation(source.id, { ...annotationData, consequenceKind: kind });
                    }}>{label}</Pill>
                  ))}
                </div>
              </div>
            ))}
          </details>
        );
      })()}
      <section className="mb-8 hidden rounded-2xl border border-border/50 bg-card p-4 shadow-sm md:block">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 text-left">
            <Checkbox
              checked={filtered.length > 0 && filtered.every((annotation) => selectedKeys.includes(annotationKey(annotation)))}
              onCheckedChange={toggleVisibleSelection}
              aria-label={filtered.length > 0 && filtered.every((annotation) => selectedKeys.includes(annotationKey(annotation))) ? 'Clear visible annotation selection' : 'Select all visible annotations'}
            />
            <div>
              <p className="noesis-eyebrow font-bold text-primary">Processing Inbox</p>
              <p className="text-xs text-muted-foreground">
                {selectedAnnotations.length ? `${selectedAnnotations.length} selected` : 'Select notes to tag, open as inquiries, or form a position together.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!selectedAnnotations.length} onClick={createInquiryFromSelection}>
              <GitBranch className="mr-1.5 size-3.5" /> Create inquiry
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedAnnotations.length || Boolean(pendingAction)} onClick={createPositionFromSelection}>
              <Layers3 className="mr-1.5 size-3.5" /> Form position
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedAnnotations.length} onClick={() => updateSelectedStatus('reference_only')} className="rounded-full">
              <Quote className="mr-1.5 size-3.5" /> Save as reference
            </Button>
            {selectedAnnotations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedKeys([])} className="rounded-full">
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </section>

      {viewMode === 'table' && filtered.length > 0 ? (
        <section className="min-w-0 rounded-lg border border-border/60 bg-card">
          <Table className="table-fixed xl:table-auto">
            <caption className="sr-only">Annotations</caption>
            <TableHeader>
              <TableRow className="bg-muted/25 hover:bg-muted/25">
                <TableHead className="w-10 sm:w-12"><span className="sr-only">Select</span></TableHead>
                <TableHead>Annotation</TableHead>
                <TableHead className="hidden w-36 xl:table-cell">Type and state</TableHead>
                <TableHead className="hidden w-40 lg:table-cell">Source</TableHead>
                <TableHead className="hidden w-36 xl:table-cell">Location</TableHead>
                <TableHead className="hidden w-24 xl:table-cell">Added</TableHead>
                <TableHead className="w-14"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((annotation) => (
                <TableRow
                  key={annotationKey(annotation)}
                  data-state={selectedKeys.includes(annotationKey(annotation)) ? 'selected' : undefined}
                  className="cursor-pointer align-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={(event) => {
                    if (!isEntitySurfaceClick(event)) return;
                    openAnnotationDetail(annotation);
                  }}
                >
                  <TableCell className="pt-5">
                    <Checkbox checked={selectedKeys.includes(annotationKey(annotation))} onCheckedChange={() => toggleSelected(annotation)} aria-label={`Select annotation from ${annotation.source.title}`} />
                  </TableCell>
                  <TableCell className="max-w-xl py-3 [overflow-wrap:anywhere]">
                    <button type="button" onClick={() => openAnnotationDetail(annotation)} onKeyDown={(event) => activateEntityOnKey(event, () => openAnnotationDetail(annotation))} className="min-h-11 w-full rounded-sm text-left font-body text-sm leading-6 text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{annotation.text}</button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground xl:hidden">
                      <span>{annotationLabel(annotationType(annotation))}</span>
                      <StageBadge type="annotation" stage={annotation.stage} status={annotation.philosophyStatus} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground lg:hidden">{annotation.source.title}</p>
                    {annotationTags(annotation).length > 0 && (
                      <p className="mt-1.5 truncate noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
                        {annotationTags(annotation).slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden py-4 xl:table-cell">
                    <div className="space-y-1.5">
                      <span className="block noesis-eyebrow noesis-eyebrow--sm font-bold text-foreground">{annotationLabel(annotationType(annotation))}</span>
                      <StageBadge type="annotation" stage={annotation.stage} status={annotation.philosophyStatus} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden py-4 lg:table-cell">
                    <button type="button" onClick={() => previewSource(annotation.source, annotation)} className="block max-w-full text-left hover:text-accent">
                      <span className="block truncate text-sm font-medium">{annotation.source.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{annotation.source.creator || MEDIA_LABELS[annotation.source.type]}</span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden py-4 text-xs leading-5 text-muted-foreground xl:table-cell">
                    <span className="line-clamp-2">{annotation.context?.trim() || 'Context not added'}</span>
                  </TableCell>
                  <TableCell className="hidden py-4 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground xl:table-cell">
                    {annotation.date ? new Date(annotation.date).toLocaleDateString() : 'Unknown'}
                  </TableCell>
                  <TableCell className="px-1 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Actions for annotation from ${annotation.source.title}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openAnnotationDetail(annotation)}><Pencil className="mr-2 size-4" /> Review and edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => previewSource(annotation.source, annotation)}><BookOpen className="mr-2 size-4" /> Open source</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTarget(annotation)}><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {viewMode !== 'table' && filtered.map((annotation) => {
          const selectedEffect = selectedEffectForAnnotation(annotation);
          const relatedInquiry = linkedInquiriesFor(annotation)[0];
          const relationLabels: Array<{ label: string; tone: BadgeTone }> = [
            ...(annotation.createdPositionId ? [{ label: 'Formed position', tone: 'position' as const }] : []),
            ...(relatedInquiry ? [{ label: 'Linked inquiry', tone: 'inquiry' as const }] : []),
            ...((annotation.linkedPositionIds || []).length ? [{ label: `${(annotation.linkedPositionIds || []).length} linked position${(annotation.linkedPositionIds || []).length === 1 ? '' : 's'}`, tone: 'position' as const }] : []),
            ...(annotationType(annotation) === 'definition' && annotationTags(annotation).length ? [{ label: `Clarifies ${annotationTags(annotation)[0]}`, tone: 'concept' as const }] : []),
          ];
          return (
          <Card key={`${annotation.source.id}:${annotation.id}`} data-note-stage={annotationStatus(annotation)} role="group" aria-label={`Annotation: ${annotation.text.slice(0, 80)}`} tabIndex={0} onClick={(event) => {
            if (!isEntitySurfaceClick(event)) return;
            openAnnotationDetail(annotation);
          }} onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openAnnotationDetail(annotation); }
          }} className={cn(
            "group border border-border/60 bg-card p-0 shadow-sm transition-all hover:border-accent/35 hover:shadow-md",
            selectedKeys.includes(annotationKey(annotation)) && "border-accent/50 ring-2 ring-accent/10"
          )}>
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={selectedKeys.includes(annotationKey(annotation))}
                  onCheckedChange={() => toggleSelected(annotation)}
                  aria-label={`Select annotation from ${annotation.source.title}`}
                />
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <StageBadge type="annotation" stage={annotation.stage} status={annotation.philosophyStatus} />
                  <span className="noesis-eyebrow noesis-eyebrow--sm font-bold text-foreground">
                    {annotationLabel(annotationType(annotation))}
                  </span>
                  <Badge variant="secondary" className="noesis-eyebrow noesis-eyebrow--sm font-bold">
                    {annotationLabel(annotationStatus(annotation))}
                  </Badge>
                  {missingSourceContext(annotation) && (
                    <Badge variant="outline" className="noesis-eyebrow noesis-eyebrow--sm rounded-full border-accent/25 bg-accent/5 text-foreground font-bold">
                      add context
                    </Badge>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="-mr-2 size-10 shrink-0" aria-label={`Actions for annotation from ${annotation.source.title}`}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openAnnotationDetail(annotation)}><Pencil className="mr-2 size-4" /> Review and edit</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => previewSource(annotation.source, annotation)}><BookOpen className="mr-2 size-4" /> Open source</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTarget(annotation)}><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <button type="button" onClick={() => openAnnotationDetail(annotation)} className="block w-full px-4 py-4 text-left">
              <p className="font-body text-[15px] leading-6 text-foreground line-clamp-4">{annotation.text}</p>
              {annotation.context?.trim() && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{annotation.context}</p>}
            </button>

            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              {normalizeConceptTags(annotation.conceptTags || annotation.source.tags).map((tag) => (
                <Badge key={tag} tone="concept">{tag}</Badge>
              ))}
            </div>

            {relationLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-border/30 px-4 py-3">
                {relationLabels.map((relation) => (
                  <Badge key={relation.label} tone={relation.tone}>{relation.label}</Badge>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 px-4 pb-3">
              <Button
                type="button"
                variant={relatedInquiry || annotation.createdPositionId ? 'secondary' : 'outline'}
                tone={relatedInquiry ? 'inquiry' : annotation.createdPositionId ? 'position' : undefined}
                size="sm"
                onClick={() => {
                  if (relatedInquiry) onNavigate?.('questions', relatedInquiry.id);
                  else if (annotation.createdPositionId) onNavigate?.('vault', annotation.createdPositionId);
                  else openAnnotationDetail(annotation);
                }}
              >
                {relatedInquiry ? 'Open inquiry' : annotation.createdPositionId ? 'Open position' : 'Review impact'}
              </Button>
            </div>

            <div className="flex min-w-0 items-center gap-2 border-t border-border/40 px-4 py-3">
                <div className="flex size-5 shrink-0 items-center justify-center rounded bg-muted/40">
                  <BookOpen className="size-3 text-muted-foreground/60" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium leading-tight text-muted-foreground">{annotation.source.title}</p>
                  <p className="mt-0.5 truncate noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{annotation.source.creator || MEDIA_LABELS[annotation.source.type]}</p>
                </div>
            </div>
          </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={Highlighter}
              title="No excerpts found"
              description="As you extract text and anchor thoughts in your library, they will aggregate here for synthesis."
              action={filtersActive ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>
      </div>

      {isFullPageDetail && !editing && !focusedAnnotation && (
        <PageEmptyState
          icon={Highlighter}
          title="Annotation not found"
          description="This annotation may have been removed, or its source is no longer available."
          action={<Button variant="outline" onClick={closeAnnotationDetail}><ArrowLeft className="mr-2 size-4" />Back to annotations</Button>}
        />
      )}

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete annotation?"
        description="This removes the annotation from its source thread. Any positions or inquiries already created from it will remain."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          const deletingFocusedAnnotation = isFullPageDetail
            && target.source.id === focusedAnnotationSourceId
            && target.id === focusedAnnotationId;
          setDeleteTarget(null);
          setSelectedKeys((current) => current.filter((key) => key !== annotationKey(target)));
          try {
            await onDeleteAnnotation(target.source.id, target.id);
            toast({ title: 'Annotation deleted.' });
            if (deletingFocusedAnnotation) onCloseAnnotation?.();
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Annotation could not be deleted',
              description: noesisUserError(error, 'delete this annotation'),
            });
          }
        }}
      />

      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">
              {linkDialog?.linkType === 'supports' ? 'Support a Position' : 'Challenge a Position'}
            </DialogTitle>
          </DialogHeader>
          {linkDialog && (
            <div className="space-y-4 pt-2">
              <p className="text-sm italic text-muted-foreground font-body leading-relaxed">
                &quot;{linkDialog.annotation.text.slice(0, 120)}{linkDialog.annotation.text.length > 120 ? '…' : ''}&quot;
              </p>
              <p className="text-xs font-code uppercase tracking-widest text-muted-foreground/60">Select a position this annotation {linkDialog.linkType === 'supports' ? 'supports' : 'challenges'}:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {positions.map((position) => (
                  <button
                    key={position.id}
                    className="w-full text-left rounded-xl border border-border/40 bg-muted/10 p-4 hover:border-accent/40 hover:bg-accent/5 transition-all"
                    onClick={() => {
                      onCreateLink({
                        fromType: 'annotation',
                        fromId: linkDialog.annotation.id,
                        fromLabel: linkDialog.annotation.text.slice(0, 80),
                        toType: 'position',
                        toId: position.id,
                        toLabel: position.title,
                        type: linkDialog.linkType,
                        note: `Annotation ${linkDialog.linkType} this position.`,
                        createdFrom: 'manual',
                      });
                      const { source, ...annotationData } = linkDialog.annotation;
                      void persistAnnotation(source.id, {
                        ...annotationData,
                        philosophyStatus: 'used_in_position',
                        linkedPositionIds: Array.from(new Set([...(annotationData.linkedPositionIds || []), position.id])),
                      });
                      toast({ title: linkDialog.linkType === 'supports' ? 'Annotation linked as support for position.' : 'Annotation linked as a challenge to position.', description: position.title });
                      setLinkDialog(null);
                    }}
                  >
                    <p className="font-headline font-bold italic text-sm text-primary leading-tight">{position.title}</p>
                    <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-1">{position.statement}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setLinkDialog(null)} className="rounded-full">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isFullPageDetail && editing ? (
        <RecordPage tone="encounter" identity="marginalia">
              <RecordHeader backLabel="Annotations" onBack={closeAnnotationDetail} view="annotations" kind="Annotation"
                status={annotationLabel(annotationStatus(editing))} extra={`${editing.source.title}${editing.source.creator ? ` · ${editing.source.creator}` : ''}`}
                title={`${annotationLabel(annotationType(editing))} from ${editing.source.title}`}
                subtitle={editing.date && !Number.isNaN(Date.parse(editing.date)) ? `Captured ${new Date(editing.date).toLocaleDateString()}` : undefined}
                tags={normalizeConceptTags(editing.conceptTags || editing.source.tags)}
                trailing={<DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild><IconButton label="Annotation actions" variant="outline"><MoreHorizontal className="size-4" /></IconButton></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditDraft({ ...editing })}><Pencil className="mr-2 size-4" /> Edit the passage</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => previewSource(editing.source, editing)}><ExternalLink className="mr-2 size-4" /> Open source</DropdownMenuItem>
                    <DropdownMenuItem className="text-problem focus:text-problem" onSelect={() => setDeleteTarget(editing)}><Trash2 className="mr-2 size-4" /> Delete annotation</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>} />
                <RecordSection id="ann-markup" title="Markup" description="Mark any part of the passage. What you mark it as is where it goes." headingLevel="h2"
                  aside={<ContextualAiPanel
                      actions={['suggest_annotation_effect']}
                      enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
                      showContextBeforeSending={aiSettings?.showContextBeforeSending}
                      reasoningDepth={aiDepthFor(aiSettings, 'annotations')}
                      buttonLabel="Ask Noesis"
                      promptLabel="What do you want to understand about this note?"
                      promptPlaceholder="For example: Does this challenge my linked position, or only qualify it?"
                      buildEnvelope={(action, userPrompt) => ({
                        action,
                        targetType: 'annotation',
                        targetId: `${editing.source.id}:${editing.id}`,
                        scope: 'linked_items',
                        itemMemory: [
                          `Annotation: ${editing.text}`,
                          `Type: ${editing.type}`,
                          `Source: ${editing.source.title}${editing.source.creator ? ` by ${editing.source.creator}` : ''}`,
                          `Source description: ${editing.source.description || 'Not recorded.'}`,
                          editing.context ? `Surrounding context: ${editing.context}` : 'No surrounding context supplied.',
                          editing.consequenceNote ? `User note: ${editing.consequenceNote}` : 'No user interpretation supplied.',
                          ...(editing.marks || []).map((mark) => `Marked as ${mark.kind}: ${mark.text}`),
                        ],
                        linkedMemory: [
                          ...(editing.conceptTags || []).map((tag) => `Concept: ${tag}`),
                          ...(editing.linkedPositionIds || []).map((id) => {
                            const position = positions.find((item) => item.id === id);
                            return position ? `Position (${position.confidence}% confidence): ${position.statement || position.title}; support: ${(position.evidenceFor || []).length}; challenges: ${(position.evidenceAgainst || []).length}` : 'A previously linked position is no longer available.';
                          }),
                        ],
                        userPrompt,
                      })}
                      onAccept={async (result, content) => {
                        const saved = annotations.find((item) => item.id === editing.id && item.source.id === editing.source.id);
                        if (!saved) throw new Error('This annotation is no longer available.');
                        const { source } = saved;
                        const { source: _source, ...baseline } = editing;
                        const next = await onUpdateAnnotation(source.id, baseline, { result, text: content });
                        if (next) setEditing((current) => current?.id === next.id && current.source.id === source.id ? {
                          ...current, aiEffectReview: next.aiEffectReview, aiReviewHistory: next.aiReviewHistory, effectProvenance: next.effectProvenance,
                        } : current);
                      }}
                    />}>
                  <MarkupSurface text={editing.text} marks={editing.marks || []} onAddMark={(kind, start, end, marked) => void addMark(editing, kind, start, end, marked)} />
                </RecordSection>

                <RecordSection id="ann-marks" title="Marks" description="Every mark is saved here. Send one down its pipeline when you are ready; the annotation stays where it is." headingLevel="h2"
                  aside={<Eyebrow size="sm">{(editing.marks || []).length} mark{(editing.marks || []).length === 1 ? '' : 's'}</Eyebrow>}>
                  {(editing.marks || []).length ? (editing.marks || []).map((mark) => {
                    const kind = markKind(mark.kind);
                    const Icon = kind.icon;
                    const open = movingMark === mark.id;
                    return (
                      <div key={mark.id} className="noesis-mark-row" data-tone={kind.tone}>
                        <Eyebrow tone={kind.tone}><Icon className="size-3.5" aria-hidden="true" /> {kind.label}</Eyebrow>
                        <span className="noesis-mark-row__text">“{mark.text}”</span>
                        <span className="noesis-mark-row__actions">
                          {mark.movedTo
                            ? <Eyebrow size="sm">Sent to {markKind(mark.kind).destination}</Eyebrow>
                            : mark.kind === 'reference'
                              ? <Eyebrow size="sm">Stays here</Eyebrow>
                              : <Button variant="secondary" size="sm" tone={kind.tone} onClick={() => { setMovingMark(open ? null : mark.id); setMoveText(shapeMarkText(mark.kind, mark.text)); }}>{open ? 'Close' : `Send to ${kind.destination}`}</Button>}
                          <IconButton label={`Remove the ${kind.label.toLowerCase()} mark`} size="sm" onClick={() => void removeMark(editing, mark.id)}><X className="size-3.5" /></IconButton>
                        </span>
                        {open && (
                          <Dictation className="col-span-full grid gap-2 border-t border-border pt-3" label="Dictate it">
                            <Eyebrow size="sm">{kind.prompt}</Eyebrow>
                            <Textarea value={moveText} onChange={(event) => setMoveText(event.target.value)} className="min-h-[72px]" aria-label={`What goes to ${kind.destination}`} />
                            {mark.kind === 'definition' && (
                              <div>
                                <Label className="mb-1.5 block text-xs text-muted-foreground">Which concept does this define?</Label>
                                <ConceptTagPicker concepts={concepts} value={editing.conceptTags || editing.source.tags || []} onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)} />
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="primary" size="sm" tone={kind.tone} disabled={!moveText.trim() || (mark.kind === 'definition' && !(editing.conceptTags || editing.source.tags || []).length)} onClick={() => void sendMark(editing, mark)}>Send to {kind.destination}</Button>
                              <Button variant="ghost" size="sm" onClick={() => setMovingMark(null)}>Cancel</Button>
                              <span className="text-xs text-muted-foreground">The annotation stays in {editing.source.title ? 'Library' : 'its collection'}; only the mark travels.</span>
                            </div>
                          </Dictation>
                        )}
                      </div>
                    );
                  }) : <SectionEmpty title="No marks yet." hint="Mark part of the passage above and it appears here." />}
                </RecordSection>

                {savedReviews.length > 0 && (
                  <AiAssistedHistory
                    title="Saved effect reviews"
                    description="Reviewed assistance for this annotation. Editing or deleting a note does not change its links or status."
                    entries={savedReviews.map((entry) => ({
                      ...entry,
                      originDetails: entry.id.startsWith('ai-review-') ? {
                        provenance: { provenanceId: entry.id, kind: 'ai-assisted' },
                        target: annotationEffectTarget(editing.id, entry.id),
                      } : undefined,
                    }))}
                    onChange={async (aiReviewHistory) => {
                      const saved = annotations.find((item) => item.id === editing.id && item.source.id === editing.source.id);
                      if (!saved) throw new Error('This annotation is no longer available.');
                      const { source, ...annotation } = saved;
                      if (!await persistAnnotation(source.id, { ...annotation, aiReviewHistory })) throw new Error('Review history was not saved.');
                      setEditing((current) => current ? { ...current, aiReviewHistory } : current);
                    }}
                  />
                )}

                <details id="annotation-connect" className="noesis-workbench-panel scroll-mt-4">
                  <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="noesis-workbench-panel__eyebrow">Connect</div>
                      <h3 className="noesis-workbench-panel__title">Connections</h3>
                      <p className="noesis-workbench-panel__description">Concept tags and the objects this annotation currently touches.</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">{Math.max(0, connectionsForAnnotation(editing).reduce((total, group) => total + group.items.length, 0) - 1)} related items</Badge>
                  </div>
                  </summary>
                  <div className="noesis-workbench-panel__body">
                  <div className="space-y-2">
                    {connectionsForAnnotation(editing).map((group) => (
                      <div key={group.label} className="grid gap-2 rounded-xl border border-border/40 bg-background/70 p-3 sm:grid-cols-[120px_1fr]">
                        <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{group.label}</div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item) => item.open ? (
                            <Button key={item.id} type="button" variant="outline" onClick={item.open} className="h-auto min-h-11 max-w-full whitespace-normal break-words text-left">{item.label}</Button>
                          ) : (
                            <Badge key={item.id} variant="secondary" className="rounded-full text-xs">{item.label}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Label className="mb-2 block noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Concept tags</Label>
                    <ConceptTagPicker
                      concepts={concepts}
                      value={editing.conceptTags || editing.source.tags || []}
                      onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)}
                      onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                    />
                  </div>
                  <Button className="mt-3" size="sm" variant="outline" disabled={savingEdit} onClick={() => void saveEditing(editing)}>Save connections</Button>
                  </div>
                </details>

                <details id="annotation-trace" className="noesis-workbench-panel scroll-mt-4">
                  <summary className="cursor-pointer list-none">
                    <h3 className="noesis-workbench-panel__title">History</h3>
                  </summary>
                  <div className="noesis-workbench-panel__body space-y-2 text-sm text-muted-foreground">
                    <p>Created from {editing.source.title}{editing.date ? ` on ${editing.date}` : ''}.</p>
                    {editing.createdInquiryId && <p>Used to create an inquiry.</p>}
                    {editing.createdPositionId && <p>Used to form a position.</p>}
                    {(editing.linkedPositionIds || []).length > 0 && <p>Linked to {(editing.linkedPositionIds || []).length} position{(editing.linkedPositionIds || []).length === 1 ? '' : 's'}.</p>}
                    {annotationStatus(editing) === 'reference_only' && <p>Saved as reference.</p>}
                    {annotationStatus(editing) === 'archived' && <p>Archived.</p>}
                  </div>
                </details>
        </RecordPage>
      ) : (
      <Dialog open={!!editing} onOpenChange={(open) => !open && closeAnnotationDetail()}>
        <DialogContent className='max-w-2xl border-none shadow-2xl rounded-2xl max-sm:h-[calc(100dvh-1rem)] max-sm:w-[calc(100vw-1rem)] max-sm:max-w-none max-sm:grid-rows-[auto_minmax(0,1fr)_auto] max-sm:gap-0 max-sm:overflow-hidden max-sm:p-4'
          onCloseAutoFocus={(event) => {
            const target = pendingDetailDeleteRef.current;
            if (!target) return;
            event.preventDefault();
            pendingDetailDeleteRef.current = null;
            requestAnimationFrame(() => setDeleteTarget(target));
          }}
        >
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl italic">Annotation Detail</DialogTitle>
              </DialogHeader>
            {editing && (
              <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pt-2 max-sm:pr-1">
                <RecordSection id="ann-markup" title="Markup" description="Mark any part of the passage. What you mark it as is where it goes." headingLevel="h2"
                  aside={<ContextualAiPanel
                      actions={['suggest_annotation_effect']}
                      enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
                      showContextBeforeSending={aiSettings?.showContextBeforeSending}
                      reasoningDepth={aiDepthFor(aiSettings, 'annotations')}
                      buttonLabel="Ask Noesis"
                      promptLabel="What do you want to understand about this note?"
                      promptPlaceholder="For example: Does this challenge my linked position, or only qualify it?"
                      buildEnvelope={(action, userPrompt) => ({
                        action,
                        targetType: 'annotation',
                        targetId: `${editing.source.id}:${editing.id}`,
                        scope: 'linked_items',
                        itemMemory: [
                          `Annotation: ${editing.text}`,
                          `Type: ${editing.type}`,
                          `Source: ${editing.source.title}${editing.source.creator ? ` by ${editing.source.creator}` : ''}`,
                          `Source description: ${editing.source.description || 'Not recorded.'}`,
                          editing.context ? `Surrounding context: ${editing.context}` : 'No surrounding context supplied.',
                          editing.consequenceNote ? `User note: ${editing.consequenceNote}` : 'No user interpretation supplied.',
                          ...(editing.marks || []).map((mark) => `Marked as ${mark.kind}: ${mark.text}`),
                        ],
                        linkedMemory: [
                          ...(editing.conceptTags || []).map((tag) => `Concept: ${tag}`),
                          ...(editing.linkedPositionIds || []).map((id) => {
                            const position = positions.find((item) => item.id === id);
                            return position ? `Position (${position.confidence}% confidence): ${position.statement || position.title}; support: ${(position.evidenceFor || []).length}; challenges: ${(position.evidenceAgainst || []).length}` : 'A previously linked position is no longer available.';
                          }),
                        ],
                        userPrompt,
                      })}
                      onAccept={async (result, content) => {
                        const saved = annotations.find((item) => item.id === editing.id && item.source.id === editing.source.id);
                        if (!saved) throw new Error('This annotation is no longer available.');
                        const { source } = saved;
                        const { source: _source, ...baseline } = editing;
                        const next = await onUpdateAnnotation(source.id, baseline, { result, text: content });
                        if (next) setEditing((current) => current?.id === next.id && current.source.id === source.id ? {
                          ...current, aiEffectReview: next.aiEffectReview, aiReviewHistory: next.aiReviewHistory, effectProvenance: next.effectProvenance,
                        } : current);
                      }}
                    />}>
                  <MarkupSurface text={editing.text} marks={editing.marks || []} onAddMark={(kind, start, end, marked) => void addMark(editing, kind, start, end, marked)} />
                </RecordSection>

                <RecordSection id="ann-marks" title="Marks" description="Every mark is saved here. Send one down its pipeline when you are ready; the annotation stays where it is." headingLevel="h2"
                  aside={<Eyebrow size="sm">{(editing.marks || []).length} mark{(editing.marks || []).length === 1 ? '' : 's'}</Eyebrow>}>
                  {(editing.marks || []).length ? (editing.marks || []).map((mark) => {
                    const kind = markKind(mark.kind);
                    const Icon = kind.icon;
                    const open = movingMark === mark.id;
                    return (
                      <div key={mark.id} className="noesis-mark-row" data-tone={kind.tone}>
                        <Eyebrow tone={kind.tone}><Icon className="size-3.5" aria-hidden="true" /> {kind.label}</Eyebrow>
                        <span className="noesis-mark-row__text">“{mark.text}”</span>
                        <span className="noesis-mark-row__actions">
                          {mark.movedTo
                            ? <Eyebrow size="sm">Sent to {markKind(mark.kind).destination}</Eyebrow>
                            : mark.kind === 'reference'
                              ? <Eyebrow size="sm">Stays here</Eyebrow>
                              : <Button variant="secondary" size="sm" tone={kind.tone} onClick={() => { setMovingMark(open ? null : mark.id); setMoveText(shapeMarkText(mark.kind, mark.text)); }}>{open ? 'Close' : `Send to ${kind.destination}`}</Button>}
                          <IconButton label={`Remove the ${kind.label.toLowerCase()} mark`} size="sm" onClick={() => void removeMark(editing, mark.id)}><X className="size-3.5" /></IconButton>
                        </span>
                        {open && (
                          <Dictation className="col-span-full grid gap-2 border-t border-border pt-3" label="Dictate it">
                            <Eyebrow size="sm">{kind.prompt}</Eyebrow>
                            <Textarea value={moveText} onChange={(event) => setMoveText(event.target.value)} className="min-h-[72px]" aria-label={`What goes to ${kind.destination}`} />
                            {mark.kind === 'definition' && (
                              <div>
                                <Label className="mb-1.5 block text-xs text-muted-foreground">Which concept does this define?</Label>
                                <ConceptTagPicker concepts={concepts} value={editing.conceptTags || editing.source.tags || []} onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)} />
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="primary" size="sm" tone={kind.tone} disabled={!moveText.trim() || (mark.kind === 'definition' && !(editing.conceptTags || editing.source.tags || []).length)} onClick={() => void sendMark(editing, mark)}>Send to {kind.destination}</Button>
                              <Button variant="ghost" size="sm" onClick={() => setMovingMark(null)}>Cancel</Button>
                              <span className="text-xs text-muted-foreground">The annotation stays in {editing.source.title ? 'Library' : 'its collection'}; only the mark travels.</span>
                            </div>
                          </Dictation>
                        )}
                      </div>
                    );
                  }) : <SectionEmpty title="No marks yet." hint="Mark part of the passage above and it appears here." />}
                </RecordSection>

                {savedReviews.length > 0 && (
                  <AiAssistedHistory
                    title="Saved effect reviews"
                    description="Reviewed assistance for this annotation. Editing or deleting a note does not change its links or status."
                    entries={savedReviews.map((entry) => ({
                      ...entry,
                      originDetails: entry.id.startsWith('ai-review-') ? {
                        provenance: { provenanceId: entry.id, kind: 'ai-assisted' },
                        target: annotationEffectTarget(editing.id, entry.id),
                      } : undefined,
                    }))}
                    onChange={async (aiReviewHistory) => {
                      const saved = annotations.find((item) => item.id === editing.id && item.source.id === editing.source.id);
                      if (!saved) throw new Error('This annotation is no longer available.');
                      const { source, ...annotation } = saved;
                      if (!await persistAnnotation(source.id, { ...annotation, aiReviewHistory })) throw new Error('Review history was not saved.');
                      setEditing((current) => current ? { ...current, aiReviewHistory } : current);
                    }}
                  />
                )}

                <details id="annotation-connect" className="noesis-workbench-panel scroll-mt-4">
                  <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="noesis-workbench-panel__eyebrow">Connect</div>
                      <h3 className="noesis-workbench-panel__title">Connections</h3>
                      <p className="noesis-workbench-panel__description">Concept tags and the objects this annotation currently touches.</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">{Math.max(0, connectionsForAnnotation(editing).reduce((total, group) => total + group.items.length, 0) - 1)} related items</Badge>
                  </div>
                  </summary>
                  <div className="noesis-workbench-panel__body">
                  <div className="space-y-2">
                    {connectionsForAnnotation(editing).map((group) => (
                      <div key={group.label} className="grid gap-2 rounded-xl border border-border/40 bg-background/70 p-3 sm:grid-cols-[120px_1fr]">
                        <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{group.label}</div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item) => item.open ? (
                            <Button key={item.id} type="button" variant="outline" onClick={item.open} className="h-auto min-h-11 max-w-full whitespace-normal break-words text-left">{item.label}</Button>
                          ) : (
                            <Badge key={item.id} variant="secondary" className="rounded-full text-xs">{item.label}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Label className="mb-2 block noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Concept tags</Label>
                    <ConceptTagPicker
                      concepts={concepts}
                      value={editing.conceptTags || editing.source.tags || []}
                      onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)}
                      onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                    />
                  </div>
                  <Button className="mt-3" size="sm" variant="outline" disabled={savingEdit} onClick={() => void saveEditing(editing)}>Save connections</Button>
                  </div>
                </details>

                <details id="annotation-trace" className="noesis-workbench-panel scroll-mt-4">
                  <summary className="cursor-pointer list-none">
                    <h3 className="noesis-workbench-panel__title">History</h3>
                  </summary>
                  <div className="noesis-workbench-panel__body space-y-2 text-sm text-muted-foreground">
                    <p>Created from {editing.source.title}{editing.date ? ` on ${editing.date}` : ''}.</p>
                    {editing.createdInquiryId && <p>Used to create an inquiry.</p>}
                    {editing.createdPositionId && <p>Used to form a position.</p>}
                    {(editing.linkedPositionIds || []).length > 0 && <p>Linked to {(editing.linkedPositionIds || []).length} position{(editing.linkedPositionIds || []).length === 1 ? '' : 's'}.</p>}
                    {annotationStatus(editing) === 'reference_only' && <p>Saved as reference.</p>}
                    {annotationStatus(editing) === 'archived' && <p>Archived.</p>}
                  </div>
                </details>
              </div>
            )}
          <DialogFooter className="pt-4"><Button variant="outline" onClick={closeAnnotationDetail}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      <Dialog open={Boolean(editDraft)} onOpenChange={open => { if (!open && !editSaveLock.current) setEditDraft(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto" onCloseAutoFocus={event => {
          if (!annotationMenuTrigger.current?.isConnected) return;
          event.preventDefault(); annotationMenuTrigger.current.focus({ preventScroll: true });
        }}>
          <DialogHeader>
            <DialogTitle>Edit annotation</DialogTitle>
            <DialogDescription>Update the passage and its metadata.</DialogDescription>
          </DialogHeader>
          {editDraft && <fieldset disabled={savingEdit} className="grid gap-4">
            <label className="grid gap-1 text-sm">Annotation text
              <Textarea value={editDraft.text} onChange={event => setEditDraft({ ...editDraft, text: event.target.value })} className="min-h-28" />
            </label>
            <Select disabled={savingEdit} value={annotationType(editDraft)} onValueChange={type => setEditDraft({ ...editDraft, type: type as AnnotationType })}>
              <SelectTrigger aria-label="Annotation type"><SelectValue /></SelectTrigger>
              <SelectContent>{!ANNOTATION_TYPES.some(type => type.id === annotationType(editDraft)) && <SelectItem value={annotationType(editDraft)}>{annotationLabel(annotationType(editDraft))}</SelectItem>}{ANNOTATION_TYPES.map(type => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
            <details className="border-y border-border py-3">
              <summary className="cursor-pointer text-sm font-medium">Optional context and interpretation</summary>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-sm">Your interpretation<Textarea value={editDraft.consequenceNote || ''} onChange={event => setEditDraft({ ...editDraft, consequenceNote: event.target.value })} /></label>
                <label className="grid gap-1 text-sm">Surrounding source context<Textarea value={editDraft.context || ''} onChange={event => setEditDraft({ ...editDraft, context: event.target.value })} /></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(editDraft.mattersBeyondSource)} onCheckedChange={checked => setEditDraft({ ...editDraft, mattersBeyondSource: checked === true })} />This is my interpretation, not the author’s claim.</label>
              </div>
            </details>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDraft(null)}>Cancel</Button>
              <Button disabled={!editDraft.text.trim() || savingEdit} onClick={async () => { if (await saveEditing(editDraft)) setEditDraft(null); }}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </fieldset>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preflight} onOpenChange={(open) => !open && setPreflight(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Send Annotation</DialogTitle>
            <DialogDescription>Shape the inquiry or position before Noesis opens the destination workspace.</DialogDescription>
          </DialogHeader>
          {preflight && (
            <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-1 py-2">
              <div className="space-y-2">
                <Label htmlFor="annotation-promotion-destination">Destination</Label>
                <Select value={preflight.mode} onValueChange={(value) => setPreflight((prev) => prev ? { ...prev, mode: value as PreflightMode } : prev)}>
                  <SelectTrigger id="annotation-promotion-destination" className="rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="position">Positions</SelectItem>
                    <SelectItem value="inquiry">Inquiries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preflight.mode === 'position' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-title">Position Title</Label>
                    <Input id="annotation-promotion-title" value={preflight.title} onChange={(event) => setPreflight((prev) => prev ? { ...prev, title: event.target.value } : prev)} className="rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-body">Position Statement</Label>
                    <Textarea id="annotation-promotion-body" value={preflight.body} onChange={(event) => setPreflight((prev) => prev ? { ...prev, body: event.target.value } : prev)} className="min-h-[140px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-description">Why This Position Exists</Label>
                    <Textarea id="annotation-promotion-description" value={preflight.description} onChange={(event) => setPreflight((prev) => prev ? { ...prev, description: event.target.value } : prev)} className="min-h-[110px]" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="annotation-promotion-supportNote">Support From Annotation</Label>
                      <Textarea id="annotation-promotion-supportNote" value={preflight.supportNote} onChange={(event) => setPreflight((prev) => prev ? { ...prev, supportNote: event.target.value } : prev)} className="min-h-[90px]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="annotation-promotion-challengeNote">Challenge Or Limitation</Label>
                      <Textarea id="annotation-promotion-challengeNote" value={preflight.challengeNote} onChange={(event) => setPreflight((prev) => prev ? { ...prev, challengeNote: event.target.value } : prev)} className="min-h-[90px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-confidence">Confidence (%)</Label>
                    <Input id="annotation-promotion-confidence" type="number" min={0} max={100}
                      value={preflight.confidence}
                      onChange={(event) => {
                        const confidence = event.target.valueAsNumber;
                        if (Number.isFinite(confidence)) setPreflight((prev) => prev ? { ...prev, confidence } : prev);
                      }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-question">Question To Work</Label>
                    <Textarea id="annotation-promotion-question" value={preflight.question} onChange={(event) => setPreflight((prev) => prev ? { ...prev, question: event.target.value } : prev)} className="min-h-[110px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-whyItMatters">Why This Inquiry Matters</Label>
                    <Textarea id="annotation-promotion-whyItMatters" value={preflight.whyItMatters} onChange={(event) => setPreflight((prev) => prev ? { ...prev, whyItMatters: event.target.value } : prev)} className="min-h-[90px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annotation-promotion-currentIntuition">Current Intuition</Label>
                    <Textarea id="annotation-promotion-currentIntuition" value={preflight.currentIntuition} onChange={(event) => setPreflight((prev) => prev ? { ...prev, currentIntuition: event.target.value } : prev)} className="min-h-[90px]" />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="annotation-promotion-context">Source Context</Label>
                <Textarea id="annotation-promotion-context" value={preflight.context} onChange={(event) => setPreflight((prev) => prev ? { ...prev, context: event.target.value } : prev)} className="min-h-[90px]" />
              </div>

              <div className="space-y-2">
                <Label>Concepts</Label>
                <ConceptTagPicker
                  concepts={concepts}
                  value={preflight.tags}
                  onChange={(tags) => setPreflight((prev) => prev ? { ...prev, tags: normalizeConceptTags(tags) } : prev)}
                  onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => setPreflight(null)} className="rounded-full">Cancel</Button>
            <Button onClick={submitPreflight} disabled={Boolean(pendingAction)}>
              {preflight?.mode === 'position' ? 'Open in Positions' : 'Open in Inquiries'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

