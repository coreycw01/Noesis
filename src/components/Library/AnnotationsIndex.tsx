
"use client";

import React, { useMemo, useState } from 'react';
import { Archive, BookOpen, CheckCircle2, Edit, ExternalLink, GitBranch, Highlighter, Layers3, Loader2, MoreHorizontal, Quote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { GenerativeAiIcon } from '@/components/GenerativeAiIcon';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import type { AiSuggestion, Annotation, AnnotationPhilosophyStatus, AnnotationType, Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import { allAnnotations, conceptKey, MEDIA_LABELS, normalizeConceptTags, today } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { aiClient } from '@/lib/ai-client';
import { noesisUserError } from '@/lib/user-facing-errors';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import { searchMatches } from '@/lib/search';

interface AnnotationsIndexProps {
  media: Media[];
  concepts: Concept[];
  positions?: VaultEntry[];
  inquiries?: Question[];
  onUpdateAnnotation: (sourceId: string, annotation: Annotation) => void;
  onDeleteAnnotation: (sourceId: string, annotationId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreatePosition: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; sourceAnnotationId?: string; position?: { title: string; statement: string; description: string; confidence: number } }) => { positionId: string; insightId: string; title: string };
  onCreateInquiry: (data: Partial<Question> & { text: string; conceptIds: string[]; sourceIds: string[]; evidenceIds: string[]; type: 'annotation'; sourceAnnotationId?: string }) => Question;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateSuggestion: (data: Partial<AiSuggestion>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onNavigate?: (view: string, targetId?: string) => void;
}

type FlatAnnotation = Annotation & { source: Media };
type AnnotationFilter = AnnotationType | AnnotationPhilosophyStatus | 'all' | 'has_relationships' | 'unanswered';
type PreflightMode = 'position' | 'inquiry';
type ConsequenceAction = 'clarifies' | 'raises_question' | 'supports_claim' | 'challenges_claim' | 'reference';
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
  { id: 'used_in_position', label: 'Applied' },
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
  onCreateSuggestion,
  onCreateLink,
  onNavigate,
}: AnnotationsIndexProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AnnotationFilter>('all');
  const [filterConcept, setFilterConcept] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<AnnotationSort>('newest');
  const [editing, setEditing] = useState<FlatAnnotation | null>(null);
  const [preflight, setPreflight] = useState<PreflightDraft | null>(null);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ annotation: FlatAnnotation; linkType: 'supports' | 'challenges' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlatAnnotation | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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
  const annotationKey = (annotation: FlatAnnotation) => `${annotation.source.id}:${annotation.id}`;
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
          typeOk = annotationType(annotation) === 'question' && !annotation.createdInquiryId;
        } else if (filterType === 'has_relationships') {
          typeOk = Boolean(annotation.createdInquiryId || annotation.createdPositionId || (annotation.linkedPositionIds || []).length);
        } else if (filterType !== 'all') {
          typeOk = ANNOTATION_TYPES.some((option) => option.id === filterType)
            ? annotationType(annotation) === filterType
            : annotationStatus(annotation) === filterType;
        }
        const conceptOk = filterConcept === 'all' || annotationTags(annotation).map(conceptKey).includes(filterConcept);
        const sourceOk = filterSource === 'all' || annotation.source.id === filterSource;
        const relatedPositions = (positions || []).filter((position) => (annotation.linkedPositionIds || []).includes(position.id) || annotation.createdPositionId === position.id);
        const relatedInquiries = (inquiries || []).filter((inquiry) => annotation.createdInquiryId === inquiry.id);
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
  }, [annotations, search, filterType, filterConcept, filterSource, sortBy]);

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
      unanswered: annotations.filter((annotation) => annotationType(annotation) === 'question' && !annotation.createdInquiryId).length,
      has_relationships: annotations.filter((annotation) => annotation.createdInquiryId || annotation.createdPositionId || (annotation.linkedPositionIds || []).length).length,
    };
    ANNOTATION_TYPES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotationType(annotation) === option.id).length;
    });
    ANNOTATION_STATUSES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotationStatus(annotation) === option.id).length;
    });
    return counts;
  }, [annotations]);

  const updateAnnotationConsequence = (annotation: FlatAnnotation, patch: Partial<Annotation>) => {
    const { source, ...annotationData } = annotation;
    onUpdateAnnotation(source.id, {
      ...annotationData,
      ...patch,
      philosophyStatus: patch.philosophyStatus || annotationData.philosophyStatus || 'reviewed',
    });
  };

  const saveEditing = () => {
    if (!editing || !editing.text.trim()) return;
    const { source, ...annotation } = editing;
    onUpdateAnnotation(source.id, {
      ...annotation,
      text: annotation.text.trim(),
      conceptTags: normalizeConceptTags(annotation.conceptTags || source.tags),
      philosophyStatus: annotation.philosophyStatus || 'reviewed',
      date: annotation.date || today(),
    });
    setEditing(null);
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
      confidence: 3,
      tags,
    });
  };

  const submitPreflight = () => {
    if (!preflight) return;
    if (preflight.mode === 'position') {
      void createPosition(preflight.annotation, preflight.title, preflight.body, preflight.tags, true, preflight);
    } else {
      void createInquiry(preflight.annotation, preflight.question, preflight.tags, true, preflight);
    }
    setPreflight(null);
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
    setPendingAction(`position:${annotation.id}`);
    const created = onCreatePosition({
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
      position: {
        title,
        statement: body,
        description: shaped?.description || `Formed from annotation: ${annotation.text}`,
        confidence: shaped?.confidence || 3,
      },
    });
    const { source, ...annotationData } = annotation;
    onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'used_in_position', createdPositionId: created.positionId });
    toast({ title: 'Position draft created from annotation.', description: `Saved as "${created.title}".` });
    if (navigateOnCreate) onNavigate?.('vault', created.positionId);
    setPendingAction(null);
    return created.positionId;
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
    setPendingAction(`inquiry:${annotation.id}`);
    const created = onCreateInquiry({
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
    });
    const { source, ...annotationData } = annotation;
    onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'used_in_position', createdInquiryId: created.id });
    toast({ title: 'Inquiry draft created from annotation.', description: 'You can keep working it in Inquiries.' });
    if (navigateOnCreate) onNavigate?.('questions', created.id);
    setPendingAction(null);
    return created.id;
  };

  const suggestConsequences = async (annotation: FlatAnnotation) => {
    setSuggestingId(annotation.id);
    try {
      const tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags);
      const tagKeys = new Set(tags.map(conceptKey));
      const linkedConcepts = concepts
        .filter((concept) => tagKeys.has(conceptKey(concept.name)))
        .slice(0, 6);
      const linkedPositions = positions
        .filter((position) => (position.tags || []).some((tag) => tagKeys.has(conceptKey(tag))) || (annotation.linkedPositionIds || []).includes(position.id))
        .slice(0, 6);
      const linkedInquiries = inquiries
        .filter((inquiry) => (inquiry.conceptIds || []).some((id) => linkedConcepts.some((concept) => concept.id === id)) || (annotation.createdInquiryId && inquiry.id === annotation.createdInquiryId))
        .slice(0, 6);
      const suggestion = await aiClient.suggestAnnotationConsequences({
        annotationText: annotation.text,
        annotationType: annotation.type,
        sourceTitle: annotation.source.title,
        existingConcepts: linkedConcepts.map((concept) => concept.name),
        existingInquiries: linkedInquiries.map((inquiry) => inquiry.text),
        existingPositions: linkedPositions.map((position) => position.statement || position.title),
        memoryContext: {
          scope: 'linked_objects',
          instruction: 'Use the annotation and its parent source first. Use linked concepts, positions, and inquiries only to choose the most relevant next move. Do not infer from unrelated workspace material.',
          itemMemory: [
            `Annotation text: ${annotation.text}`,
            `Annotation type: ${annotation.type}`,
            annotation.context ? `Annotation context: ${annotation.context}` : '',
            annotation.answer ? `User interpretation or answer: ${annotation.answer}` : '',
            `Parent source: ${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}`,
            annotation.source.description ? `Source summary: ${annotation.source.description}` : '',
            annotation.source.capture?.after?.coreArgument ? `Source core argument: ${annotation.source.capture.after.coreArgument}` : '',
          ].filter(Boolean),
          linkedMemory: [
            ...linkedConcepts.map((concept) => `Concept ${concept.name}: ${concept.description || 'No definition yet.'}`),
            ...linkedPositions.map((position) => `Position ${position.title}: ${position.statement || position.description || 'No statement yet.'}`),
            ...linkedInquiries.map((inquiry) => `Inquiry ${inquiry.text}: ${inquiry.answer || inquiry.status || 'open'}`),
          ],
          workspaceMemory: [
            `${concepts.length} total concepts`,
            `${positions.length} total positions`,
            `${inquiries.length} total inquiries`,
          ],
        },
      });
      onCreateSuggestion({
        targetType: 'annotation',
        targetId: `${annotation.source.id}:${annotation.id}`,
        targetLabel: annotation.text.slice(0, 90),
        suggestionType: 'annotation_consequence',
        title: 'Suggested next move',
        body: suggestion.rationale,
        payload: {
          ...suggestion,
          sourceId: annotation.source.id,
          annotationId: annotation.id,
        },
      });
      toast({ title: 'Suggestion Saved', description: 'Noesis saved a possible next step for you to accept or ignore later.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Suggestion Failed',
        description: noesisUserError(error, 'The assistant could not read this annotation right now.'),
      });
    } finally {
      setSuggestingId(null);
    }
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
      onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: status });
    });
    toast({ title: 'Annotations updated', description: `${selectedAnnotations.length} annotations marked ${status.replace(/_/g, ' ')}.` });
    setSelectedKeys([]);
  };

  const runConsequenceAction = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    const { source, ...annotationData } = annotation;
    if (action === 'clarifies') {
      onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'used_in_position' });
      toast({ title: 'Annotation applied as conceptual clarification.', description: 'It remains discoverable through its source and concept tags.' });
      return;
    }
    if (action === 'raises_question') {
      if (annotation.createdInquiryId) {
        onNavigate?.('questions', annotation.createdInquiryId);
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
        openPreflight(annotation, 'inquiry');
      }
      return;
    }
    onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'reference_only' });
    toast({ title: 'Saved as reference.', description: 'This note remains searchable without becoming a position, inquiry, or concept change.' });
  };

  const consequenceQuestion = (annotation: FlatAnnotation) => {
    if (annotation.type === 'question') return 'What question does this raise?';
    if (annotation.type === 'connection') return 'What relationship does this reveal?';
    if (annotation.type === 'highlight') return 'What claim or concept does this clarify?';
    return 'What does this thought affect?';
  };

  const selectedEffectForAnnotation = (annotation: FlatAnnotation): ConsequenceAction => {
    if (annotation.createdInquiryId || annotation.type === 'question' || annotation.consequenceKind === 'question') return 'raises_question';
    if ((annotation.linkedPositionIds || []).length || annotation.createdPositionId || ['evidence', 'claim'].includes(annotation.consequenceKind || '')) return 'supports_claim';
    if (annotation.type === 'objection' || annotation.consequenceKind === 'objection') return 'challenges_claim';
    if (annotation.philosophyStatus === 'reference_only') return 'reference';
    if (annotation.type === 'definition' || annotation.consequenceKind === 'definition') return 'clarifies';
    return 'reference';
  };

  const nextActionLabelForEffect = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    if (action === 'raises_question') return annotation.createdInquiryId ? 'Open inquiry' : 'Open inquiry';
    if (action === 'supports_claim') return positions.length ? 'Select position' : 'Form position';
    if (action === 'challenges_claim') return positions.length ? 'Select position' : 'Open inquiry';
    if (action === 'clarifies') return 'Select concept';
    return 'Finish';
  };

  const connectionsForAnnotation = (annotation: FlatAnnotation) => {
    const linkedPositionIds = Array.from(new Set([...(annotation.linkedPositionIds || []), annotation.createdPositionId].filter(Boolean) as string[]));
    const linkedPositions = positions.filter((position) => linkedPositionIds.includes(position.id));
    const linkedInquiries = inquiries.filter((inquiry) => inquiry.id === annotation.createdInquiryId);
    const linkedConcepts = annotationTags(annotation);
    return [
      {
        label: 'Positions',
        items: linkedPositions.map((position) => position.title),
      },
      {
        label: 'Inquiries',
        items: linkedInquiries.map((inquiry) => inquiry.text),
      },
      {
        label: 'Concepts',
        items: linkedConcepts,
      },
      {
        label: 'Source',
        items: [annotation.source.title],
      },
    ].filter((group) => group.items.length > 0);
  };

  const runDetailAction = (annotation: FlatAnnotation, action: ConsequenceAction) => {
    setEditing(null);
    runConsequenceAction(annotation, action);
  };

  const createPositionFromSelection = () => {
    if (!selectedAnnotations.length) return;
    const sourceIds = Array.from(new Set(selectedAnnotations.map((annotation) => annotation.source.id)));
    const tags = normalizeConceptTags(selectedAnnotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []));
    const first = selectedAnnotations[0];
    const body = selectedAnnotations.map((annotation) => `- ${annotation.text}${annotation.answer ? `\n  Answer: ${annotation.answer}` : ''}`).join('\n\n');
    const sourceContext = selectedAnnotations
      .map((annotation) => `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}: ${annotation.context || annotation.text}`)
      .join('\n');
    const created = onCreatePosition({
      title: first.text.slice(0, 90),
      body: `${body}\n\nSource context:\n${sourceContext}`,
      tags,
      sourceIds,
      sourceAnnotationId: first.id,
      position: {
        title: first.text.slice(0, 90),
        statement: first.answer || first.text,
        description: `Formed from ${selectedAnnotations.length} annotation${selectedAnnotations.length === 1 ? '' : 's'} across ${sourceIds.length} source${sourceIds.length === 1 ? '' : 's'}.\n\n${sourceContext}`,
        confidence: 3,
      },
    });
    selectedAnnotations.forEach((selectedAnnotation) => {
      const { source, ...annotationData } = selectedAnnotation;
      onUpdateAnnotation(source.id, {
        ...annotationData,
        philosophyStatus: 'used_in_position',
        linkedPositionIds: Array.from(new Set([...(annotationData.linkedPositionIds || []), created.positionId])),
        createdPositionId: annotationData.createdPositionId || created.positionId,
      });
    });
    toast({ title: 'Position created from selected annotations.', description: created.title });
    setSelectedKeys([]);
    onNavigate?.('vault', created.positionId);
  };

  const createInquiryFromSelection = () => {
    if (!selectedAnnotations.length) return;
    const sourceIds = Array.from(new Set(selectedAnnotations.map((annotation) => annotation.source.id)));
    const evidenceIds = selectedAnnotations.map((annotation) => annotation.id);
    const tags = normalizeConceptTags(selectedAnnotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []));
    const sourceContext = selectedAnnotations
      .map((annotation) => `${annotation.source.title}${annotation.source.creator ? ` by ${annotation.source.creator}` : ''}: ${annotation.context || annotation.text}`)
      .join('\n');
    const created = onCreateInquiry({
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
    });
    selectedAnnotations.forEach((selectedAnnotation) => {
      const { source, ...annotationData } = selectedAnnotation;
      onUpdateAnnotation(source.id, {
        ...annotationData,
        philosophyStatus: 'questioned',
        createdInquiryId: annotationData.createdInquiryId || created.id,
      });
    });
    toast({ title: 'Inquiry created from selected annotations.', description: created.text.slice(0, 90) });
    setSelectedKeys([]);
    onNavigate?.('questions', created.id);
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
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <PageHeader
        title="Annotations"
        description="Review and refine captured highlights, thoughts, questions, and connections across all sources."
        actions={<Stat label="Total Excerpts" value={typeCounts.total} />}
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search excerpt text..."
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
        className="mb-5"
      >
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as AnnotationSort)}>
          <SelectTrigger className="w-44 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest" className="font-code text-[10px] uppercase">Recently added</SelectItem>
            <SelectItem value="status" className="font-code text-[10px] uppercase">Recently updated</SelectItem>
            <SelectItem value="source" className="font-code text-[10px] uppercase">Source order</SelectItem>
            <SelectItem value="oldest" className="font-code text-[10px] uppercase">Oldest</SelectItem>
            <SelectItem value="type" className="font-code text-[10px] uppercase">A-Z by type</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ANNOTATION_TYPES.some((option) => option.id === filterType) ? filterType : 'all'} onValueChange={(value) => setFilterType(value as AnnotationFilter)}>
          <SelectTrigger className="w-44 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[10px] uppercase">All types</SelectItem>
            {ANNOTATION_TYPES.map((type) => <SelectItem key={type.id} value={type.id} className="font-code text-[10px] uppercase">{type.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-1.5">
          {filterButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => setFilterType(button.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[9px] font-code font-bold uppercase tracking-[0.14em] transition-all shadow-sm",
                filterType === button.id ? "bg-accent text-white" : "bg-card text-muted-foreground border border-border/60 hover:text-foreground"
              )}
            >
              {button.label} {button.count}
            </button>
          ))}
        </div>

      </FilterToolbar>

      <section className="mb-8 hidden rounded-2xl border border-border/50 bg-card p-4 shadow-sm md:block">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button onClick={toggleVisibleSelection} className="flex items-center gap-3 text-left">
            <Checkbox checked={filtered.length > 0 && filtered.every((annotation) => selectedKeys.includes(annotationKey(annotation)))} />
            <div>
              <p className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Processing Inbox</p>
              <p className="text-xs text-muted-foreground">
                {selectedAnnotations.length ? `${selectedAnnotations.length} selected` : 'Select notes to tag, open as inquiries, or form a position together.'}
              </p>
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!selectedAnnotations.length} onClick={createInquiryFromSelection} className="rounded-full">
              <GitBranch className="mr-1.5 size-3.5" /> Create inquiry
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedAnnotations.length} onClick={createPositionFromSelection} className="rounded-full">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
        {filtered.map((annotation) => {
          const selectedEffect = selectedEffectForAnnotation(annotation);
          const relationLabels = [
            ...(annotation.createdPositionId ? ['Formed position'] : []),
            ...(annotation.createdInquiryId ? ['Linked inquiry'] : []),
            ...((annotation.linkedPositionIds || []).length ? [`${(annotation.linkedPositionIds || []).length} linked position${(annotation.linkedPositionIds || []).length === 1 ? '' : 's'}`] : []),
            ...(annotationType(annotation) === 'definition' && annotationTags(annotation).length ? [`Clarifies ${annotationTags(annotation)[0]}`] : []),
          ];
          return (
          <Card key={`${annotation.source.id}:${annotation.id}`} className={cn(
            "p-4 md:p-5 bg-card border border-accent/10 shadow-md rounded-2xl group hover:shadow-xl transition-all",
            selectedKeys.includes(annotationKey(annotation)) && "border-accent/50 ring-2 ring-accent/10"
          )}>
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedKeys.includes(annotationKey(annotation))}
                  onCheckedChange={() => toggleSelected(annotation)}
                  aria-label={`Select annotation from ${annotation.source.title}`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-code text-[9px] uppercase tracking-widest bg-muted/5 border-border/40 rounded-full font-bold px-3 py-1">
                    {annotationLabel(annotationType(annotation))}
                  </Badge>
                  <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest rounded-full bg-accent/5 text-accent font-bold">
                    {annotationLabel(annotationStatus(annotation))}
                  </Badge>
                  {missingSourceContext(annotation) && (
                    <Badge variant="outline" className="font-code text-[8px] uppercase tracking-widest rounded-full border-amber-200 bg-amber-50 text-amber-800 font-bold">
                      add context
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="size-10 rounded-full text-accent hover:text-accent" onClick={() => suggestConsequences(annotation)} disabled={suggestingId === annotation.id} title="Ask Noesis AI">
                  {suggestingId === annotation.id ? <Loader2 className="size-5 animate-spin" /> : <GenerativeAiIcon className="size-8" />}
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => setEditing(annotation)} title="Edit annotation">
                  <Edit className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => previewSource(annotation.source, annotation)} title="Preview source thread">
                  <ExternalLink className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-full text-destructive hover:text-destructive" onClick={() => setDeleteTarget(annotation)} title="Delete annotation">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative mb-4">
              <Quote className="absolute -left-6 -top-2 size-10 text-accent/5" />
              <p className="font-body italic leading-relaxed text-[15px] text-primary/90 relative z-10 line-clamp-5 md:text-[16px]">"{annotation.text}"</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {normalizeConceptTags(annotation.conceptTags || annotation.source.tags).map((tag) => (
                <Badge key={tag} variant="secondary" className="font-code text-[8px] uppercase tracking-wider rounded-full bg-muted/20 text-muted-foreground font-bold">{tag}</Badge>
              ))}
            </div>

            {relationLabels.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {relationLabels.map((label) => (
                  <Badge key={label} variant="outline" className="rounded-full border-accent/20 bg-accent/5 font-code text-[8px] uppercase tracking-widest text-accent">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {([
                ['supports_claim', 'Support'],
                ['challenges_claim', 'Challenge'],
                ['raises_question', annotation.createdInquiryId ? 'Open inquiry' : 'Raise inquiry'],
                ['supports_claim', 'Form position'],
              ] as Array<[ConsequenceAction, string]>).map(([action, label]) => (
                <Button
                  key={`${action}-${label}`}
                  type="button"
                  variant={selectedEffect === action && label !== 'Form position' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => label === 'Form position' ? openPreflight(annotation, 'position') : runConsequenceAction(annotation, action)}
                  className="h-8 rounded-full px-3 font-code text-[8px] uppercase tracking-widest"
                >
                  {label}
                </Button>
              ))}
              <details className="relative">
                <summary className="flex h-8 list-none items-center gap-1 rounded-full border border-border bg-card px-3 font-code text-[8px] uppercase tracking-widest text-muted-foreground shadow-sm">
                  <MoreHorizontal className="size-3.5" /> More
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-popover p-2 shadow-xl">
                  <button type="button" onClick={() => runConsequenceAction(annotation, 'clarifies')} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">Clarify concept</button>
                  <button type="button" onClick={() => runConsequenceAction(annotation, 'reference')} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">Save as reference</button>
                  <button type="button" onClick={() => setEditing(annotation)} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">Edit</button>
                  <button type="button" onClick={() => updateAnnotationConsequence(annotation, { philosophyStatus: 'archived' })} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">Archive</button>
                  <button type="button" onClick={() => setDeleteTarget(annotation)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10">Delete</button>
                </div>
              </details>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/20 mt-4">
              <button onClick={() => previewSource(annotation.source, annotation)} className="flex min-w-0 items-center gap-3 text-left">
                <div className="size-8 rounded-lg bg-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
                  <BookOpen className="size-4 text-accent/40" />
                </div>
                <div className="min-w-0">
                  <p className="font-headline font-bold italic text-sm text-primary leading-tight truncate">{annotation.source.title}</p>
                  <p className="readex-kicker text-[8px] text-muted-foreground/60 uppercase tracking-widest font-bold truncate mt-1">{annotation.source.creator || MEDIA_LABELS[annotation.source.type]}</p>
                </div>
              </button>
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
              action={filtersActive ? <Button variant="outline" onClick={clearFilters} className="rounded-full">Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete annotation?"
        description="This removes the annotation from its source thread. Any positions or inquiries already created from it will remain."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          onDeleteAnnotation(deleteTarget.source.id, deleteTarget.id);
          setDeleteTarget(null);
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
                "{linkDialog.annotation.text.slice(0, 120)}{linkDialog.annotation.text.length > 120 ? '…' : ''}"
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
                      onUpdateAnnotation(source.id, {
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Annotation Detail</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 pt-2">
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{annotationLabel(annotationType(editing))}</Badge>
                    <Badge variant="secondary" className="rounded-full bg-accent/5 font-code text-[8px] uppercase tracking-widest text-accent">{annotationLabel(annotationStatus(editing))}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => previewSource(editing.source, editing)} title="Open source">
                      <ExternalLink className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(editing); setEditing(null); }} title="Delete annotation">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="font-body text-lg italic leading-8 text-primary">"{editing.text}"</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>From <span className="font-medium text-foreground">{editing.source.title}</span>{editing.source.creator ? ` by ${editing.source.creator}` : ''}</span>
                  <span>·</span>
                  <span>{editing.date || 'Date unknown'}</span>
                </div>
                <details className="mt-4 rounded-xl border border-border/50 bg-background/60 p-3">
                  <summary className="cursor-pointer list-none font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Edit annotation text and metadata
                  </summary>
                  <div className="mt-3 space-y-3">
                    <Textarea value={editing.text} onChange={(event) => setEditing((prev) => prev ? { ...prev, text: event.target.value } : prev)} className="min-h-[120px]" />
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={annotationType(editing)} onValueChange={(value) => setEditing((prev) => prev ? { ...prev, type: value as AnnotationType } : prev)}>
                        <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ANNOTATION_TYPES.map((type) => (
                            <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={annotationStatus(editing)} onValueChange={(value) => setEditing((prev) => prev ? { ...prev, philosophyStatus: value as AnnotationPhilosophyStatus } : prev)}>
                        <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ANNOTATION_STATUSES.map((status) => (
                            <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </details>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4">
                <details open={Boolean(editing.consequenceNote || editing.context)}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Your note</div>
                        <p className="mt-1 text-xs text-muted-foreground">{editing.consequenceNote || editing.context ? 'Personal context attached.' : 'Collapsed because no note has been added yet.'}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[9px]">Edit</Badge>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={editing.consequenceNote || ''}
                      onChange={(event) => setEditing((prev) => prev ? { ...prev, consequenceNote: event.target.value } : prev)}
                      placeholder="Your note, interpretation, limitation, or reminder."
                      className="min-h-[90px]"
                    />
                    <Textarea
                      value={editing.context || ''}
                      onChange={(event) => setEditing((prev) => prev ? { ...prev, context: event.target.value } : prev)}
                      placeholder="Optional surrounding source context."
                      className="min-h-[80px]"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={Boolean(editing.mattersBeyondSource)}
                        onCheckedChange={(checked) => setEditing((prev) => prev ? { ...prev, mattersBeyondSource: Boolean(checked) } : prev)}
                      />
                      This is my interpretation, not the author's claim.
                    </label>
                  </div>
                </details>
              </section>

              <section className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-code text-[9px] font-bold uppercase tracking-widest text-accent">Next action</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connectionsForAnnotation(editing).some((group) => group.label !== 'Source')
                        ? 'This annotation has already been applied. You can change action or add another connection.'
                        : 'Choose where this annotation should go, or save it as reference.'}
                    </p>
                  </div>
                  {connectionsForAnnotation(editing).some((group) => group.label !== 'Source') && (
                    <Badge className="rounded-full bg-accent text-accent-foreground">Applied to philosophy</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['supports_claim', 'Support a position'],
                    ['challenges_claim', 'Challenge a position'],
                    ['raises_question', editing.createdInquiryId ? 'Open inquiry' : 'Raise an inquiry'],
                    ['clarifies', 'Clarify a concept'],
                    ['reference', 'Save as reference'],
                  ] as Array<[ConsequenceAction, string]>).map(([action, label]) => (
                    <Button key={label} type="button" variant="outline" size="sm" onClick={() => runDetailAction(editing, action)} className="h-8 rounded-full px-3 font-code text-[8px] uppercase tracking-widest">
                      {label}
                    </Button>
                  ))}
                  <Button type="button" size="sm" onClick={() => { const current = editing; setEditing(null); openPreflight(current, 'position'); }} className="h-8 rounded-full px-3 font-code text-[8px] uppercase tracking-widest">
                    Form a position
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Connections</div>
                    <p className="mt-1 text-xs text-muted-foreground">What this annotation currently touches.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full">{Math.max(0, connectionsForAnnotation(editing).reduce((total, group) => total + group.items.length, 0) - 1)} links</Badge>
                </div>
                <div className="space-y-2">
                  {connectionsForAnnotation(editing).map((group) => (
                    <div key={group.label} className="grid gap-2 rounded-xl border border-border/40 bg-background/70 p-3 sm:grid-cols-[120px_1fr]">
                      <div className="font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => (
                          <Badge key={item} variant="secondary" className="rounded-full text-xs">{item}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Label className="mb-2 block font-code text-[8px] uppercase tracking-widest text-muted-foreground">Concept tags</Label>
                  <ConceptTagPicker
                    concepts={concepts}
                    value={editing.conceptTags || editing.source.tags || []}
                    onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)}
                    onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                  />
                </div>
              </section>

              <details className="rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer list-none font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  History
                </summary>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
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
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setEditing(null)} className="rounded-full">Cancel</Button>
            <Button onClick={saveEditing} className="rounded-full px-8">Save Annotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preflight} onOpenChange={(open) => !open && setPreflight(null)}>
        <DialogContent className="max-w-2xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Send Annotation</DialogTitle>
            <p className="text-sm text-muted-foreground">Shape the inquiry or position before Noesis opens the destination workspace.</p>
          </DialogHeader>
          {preflight && (
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label>Destination</Label>
                <Select value={preflight.mode} onValueChange={(value) => setPreflight((prev) => prev ? { ...prev, mode: value as PreflightMode } : prev)}>
                  <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="position">Positions</SelectItem>
                    <SelectItem value="inquiry">Inquiries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preflight.mode === 'position' ? (
                <>
                  <div className="space-y-2">
                    <Label>Position Title</Label>
                    <Input value={preflight.title} onChange={(event) => setPreflight((prev) => prev ? { ...prev, title: event.target.value } : prev)} className="rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Label>Position Statement</Label>
                    <Textarea value={preflight.body} onChange={(event) => setPreflight((prev) => prev ? { ...prev, body: event.target.value } : prev)} className="min-h-[140px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Why This Position Exists</Label>
                    <Textarea value={preflight.description} onChange={(event) => setPreflight((prev) => prev ? { ...prev, description: event.target.value } : prev)} className="min-h-[110px]" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Support From Annotation</Label>
                      <Textarea value={preflight.supportNote} onChange={(event) => setPreflight((prev) => prev ? { ...prev, supportNote: event.target.value } : prev)} className="min-h-[90px]" />
                    </div>
                    <div className="space-y-2">
                      <Label>Challenge Or Limitation</Label>
                      <Textarea value={preflight.challengeNote} onChange={(event) => setPreflight((prev) => prev ? { ...prev, challengeNote: event.target.value } : prev)} className="min-h-[90px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confidence</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreflight((prev) => prev ? { ...prev, confidence: value } : prev)}
                          className={cn(
                            'h-9 flex-1 rounded-full border font-code text-[10px] font-bold uppercase tracking-widest transition-colors',
                            preflight.confidence === value ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:border-accent/40'
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Question To Work</Label>
                    <Textarea value={preflight.question} onChange={(event) => setPreflight((prev) => prev ? { ...prev, question: event.target.value } : prev)} className="min-h-[110px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Why This Inquiry Matters</Label>
                    <Textarea value={preflight.whyItMatters} onChange={(event) => setPreflight((prev) => prev ? { ...prev, whyItMatters: event.target.value } : prev)} className="min-h-[90px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Intuition</Label>
                    <Textarea value={preflight.currentIntuition} onChange={(event) => setPreflight((prev) => prev ? { ...prev, currentIntuition: event.target.value } : prev)} className="min-h-[90px]" />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Source Context</Label>
                <Textarea value={preflight.context} onChange={(event) => setPreflight((prev) => prev ? { ...prev, context: event.target.value } : prev)} className="min-h-[90px]" />
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
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setPreflight(null)} className="rounded-full">Cancel</Button>
            <Button onClick={submitPreflight} className="rounded-full px-8">
              {preflight?.mode === 'position' ? 'Open in Positions' : 'Open in Inquiries'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-right">
      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold mb-1">{label}</div>
      <div className="font-headline text-3xl font-bold italic text-primary leading-none">{value}</div>
    </div>
  );
}
