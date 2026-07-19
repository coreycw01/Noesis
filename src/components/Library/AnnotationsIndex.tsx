
"use client";

import React, { useMemo, useState } from 'react';
import { Archive, BookOpen, CheckCircle2, Edit, ExternalLink, GitBranch, Highlighter, Layers3, Loader2, Quote, Trash2 } from 'lucide-react';
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

interface AnnotationsIndexProps {
  media: Media[];
  concepts: Concept[];
  positions?: VaultEntry[];
  inquiries?: Question[];
  onUpdateAnnotation: (sourceId: string, annotation: Annotation) => void;
  onDeleteAnnotation: (sourceId: string, annotationId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onCreatePosition: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; sourceAnnotationId?: string }) => { positionId: string; insightId: string; title: string };
  onCreateInquiry: (data: { text: string; conceptIds: string[]; sourceIds: string[]; evidenceIds: string[]; type: 'annotation'; sourceAnnotationId?: string }) => Question;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateSuggestion: (data: Partial<AiSuggestion>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onNavigate?: (view: string, targetId?: string) => void;
}

type FlatAnnotation = Annotation & { source: Media };
type AnnotationFilter = AnnotationType | AnnotationPhilosophyStatus | 'all' | 'unanswered' | 'needs_context' | 'source_context_missing' | 'needs_direction' | 'evidence_ready' | 'potentially_important' | 'recently_promoted';
type PreflightMode = 'position' | 'inquiry';
type ConsequenceAction = 'clarifies' | 'raises_question' | 'supports_claim' | 'challenges_claim' | 'reference';
type AnnotationConsequenceKind = NonNullable<Annotation['consequenceKind']>;
type AnnotationSort = 'newest' | 'oldest' | 'source' | 'type' | 'status';

const ANNOTATION_TYPES: Array<{ id: AnnotationType; label: string }> = [
  { id: 'highlight', label: 'Highlight' },
  { id: 'thought', label: 'Thought' },
  { id: 'question', label: 'Question' },
  { id: 'claim', label: 'Claim' },
  { id: 'objection', label: 'Objection' },
  { id: 'definition', label: 'Definition' },
  { id: 'example', label: 'Example' },
  { id: 'connection', label: 'Connection' },
  { id: 'personal_reflection', label: 'Personal Reflection' },
  { id: 'observation', label: 'Observation' },
  { id: 'excerpt', label: 'Excerpt' },
  { id: 'voice_note', label: 'Voice Note' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'image', label: 'Image' },
];

const ANNOTATION_STATUSES: Array<{ id: AnnotationPhilosophyStatus; label: string }> = [
  { id: 'raw', label: 'Unprocessed' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'connected', label: 'Connected' },
  { id: 'questioned', label: 'Questioned' },
  { id: 'used_in_position', label: 'In Positions' },
  { id: 'promoted', label: 'Promoted' },
  { id: 'reference_only', label: 'Reference Only' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'archived', label: 'Archived' },
];

const CONSEQUENCE_KINDS: Array<{ id: AnnotationConsequenceKind; label: string }> = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'interpretation', label: 'Interpretation' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'question', label: 'Question' },
  { id: 'definition', label: 'Definition' },
  { id: 'objection', label: 'Objection' },
  { id: 'claim', label: 'Claim' },
];

const annotationLabel = (value: string) => ANNOTATION_TYPES.find((type) => type.id === value)?.label
  || ANNOTATION_STATUSES.find((status) => status.id === value)?.label
  || value.replace(/_/g, ' ');

interface PreflightDraft {
  mode: PreflightMode;
  annotation: FlatAnnotation;
  title: string;
  body: string;
  question: string;
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
  const annotationStatus = (annotation: Annotation): AnnotationPhilosophyStatus => annotation.philosophyStatus || (annotation.type === 'question' ? 'questioned' : 'raw');
  const annotationTags = (annotation: FlatAnnotation) => normalizeConceptTags(annotation.conceptTags || annotation.source.tags || []);
  const needsContext = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed', 'promoted', 'used_in_position'].includes(status)
      && (!annotationTags(annotation).length || !annotation.consequenceNote?.trim());
  };
  const isPotentiallyImportant = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    if (['archived', 'dismissed', 'reference_only'].includes(status)) return false;
    return Boolean(
      annotation.mattersBeyondSource
      || ['claim', 'objection', 'definition', 'connection'].includes(annotation.type)
      || ['evidence', 'claim', 'objection', 'definition'].includes(annotation.consequenceKind || '')
    );
  };
  const missingSourceContext = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed'].includes(status) && !annotation.context?.trim();
  };
  const needsSupportDirection = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    if (['archived', 'dismissed', 'reference_only', 'used_in_position', 'promoted'].includes(status)) return false;
    const isEvidenceLike = ['claim', 'objection'].includes(annotation.type) || ['evidence', 'claim', 'objection'].includes(annotation.consequenceKind || '');
    return isEvidenceLike && !(annotation.linkedPositionIds || []).length && !annotation.createdPositionId;
  };
  const isEvidenceReady = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return !['archived', 'dismissed', 'reference_only'].includes(status)
      && Boolean(annotation.consequenceNote?.trim())
      && annotationTags(annotation).length > 0
      && ['claim', 'objection', 'definition', 'connection'].includes(annotation.type);
  };
  const isRecentlyPromoted = (annotation: FlatAnnotation) => {
    const status = annotationStatus(annotation);
    return Boolean(annotation.createdInquiryId || annotation.createdPositionId || ['promoted', 'used_in_position'].includes(status));
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

    if (annotation.consequenceNote?.trim()) score += 1;
    else missing.push('consequence note');

    if (annotation.consequenceKind) score += 1;
    else missing.push('consequence type');

    if (
      ['reviewed', 'connected', 'questioned', 'used_in_position', 'promoted', 'reference_only', 'archived', 'dismissed'].includes(status)
      || annotation.createdInquiryId
      || annotation.createdPositionId
    ) score += 1;
    else missing.push('processing status');

    if (needsSupportDirection(annotation)) {
      missing.push('support/challenge direction');
    } else {
      score += 1;
    }

    const label = score >= 6
      ? 'processed'
      : score >= 4
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
          typeOk = annotation.type === 'question' && !annotation.answer?.trim();
        } else if (filterType === 'needs_context') {
          typeOk = needsContext(annotation);
        } else if (filterType === 'source_context_missing') {
          typeOk = missingSourceContext(annotation);
        } else if (filterType === 'needs_direction') {
          typeOk = needsSupportDirection(annotation);
        } else if (filterType === 'evidence_ready') {
          typeOk = isEvidenceReady(annotation);
        } else if (filterType === 'potentially_important') {
          typeOk = isPotentiallyImportant(annotation);
        } else if (filterType === 'recently_promoted') {
          typeOk = isRecentlyPromoted(annotation);
        } else if (filterType !== 'all') {
          typeOk = ANNOTATION_TYPES.some((option) => option.id === filterType)
            ? annotation.type === filterType
            : annotationStatus(annotation) === filterType;
        }
        const conceptOk = filterConcept === 'all' || annotationTags(annotation).map(conceptKey).includes(filterConcept);
        const sourceOk = filterSource === 'all' || annotation.source.id === filterSource;
        const query = `${annotation.text} ${annotation.source.title} ${annotation.source.creator} ${annotationTags(annotation).join(' ')}`.toLowerCase();
        return typeOk && conceptOk && sourceOk && (!search || query.includes(search.toLowerCase()));
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'source') return a.source.title.localeCompare(b.source.title) || new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'type') return annotationLabel(a.type).localeCompare(annotationLabel(b.type)) || new Date(b.date).getTime() - new Date(a.date).getTime();
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
      unanswered: annotations.filter((annotation) => annotation.type === 'question' && !annotation.answer?.trim()).length,
    };
    ANNOTATION_TYPES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotation.type === option.id).length;
    });
    ANNOTATION_STATUSES.forEach((option) => {
      counts[option.id] = annotations.filter((annotation) => annotationStatus(annotation) === option.id).length;
    });
    return counts;
  }, [annotations]);

  const consequenceLanes = useMemo(() => [
    {
      label: 'Unprocessed',
      value: typeCounts.raw,
      description: 'Captured meaning that still needs classification or a next step.',
      filter: 'raw' as AnnotationFilter,
    },
    {
      label: 'Needs Context',
      value: annotations.filter(needsContext).length,
      description: 'Fragments missing concept tags or a clear consequence note.',
      filter: 'needs_context' as AnnotationFilter,
    },
    {
      label: 'Potentially Important',
      value: annotations.filter(isPotentiallyImportant).length,
      description: 'Claims, objections, definitions, evidence, and fragments marked beyond the source.',
      filter: 'potentially_important' as AnnotationFilter,
    },
    {
      label: 'Needs Direction',
      value: annotations.filter(needsSupportDirection).length,
      description: 'Evidence-like captures that need support or challenge direction before judgment.',
      filter: 'needs_direction' as AnnotationFilter,
    },
    {
      label: 'Evidence Ready',
      value: annotations.filter(isEvidenceReady).length,
      description: 'Tagged, interpreted captures ready to become evidence, concept material, or inquiry fuel.',
      filter: 'evidence_ready' as AnnotationFilter,
    },
    {
      label: 'Recently Promoted',
      value: annotations.filter(isRecentlyPromoted).length,
      description: 'Annotations already routed into inquiries, positions, or promoted thinking objects.',
      filter: 'recently_promoted' as AnnotationFilter,
    },
    {
      label: 'Fully Processed',
      value: annotations.filter((annotation) => annotationProcessingQuality(annotation).score >= 6).length,
      description: 'Captures with tags, context, consequence, direction, and a clear processing state.',
      filter: 'all' as AnnotationFilter,
    },
    {
      label: 'Archived',
      value: typeCounts.archived || 0,
      description: 'Reference material deliberately removed from active processing.',
      filter: 'archived' as AnnotationFilter,
    },
  ], [annotations, typeCounts.raw, typeCounts.archived]);

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
      philosophyStatus: annotation.philosophyStatus || (annotation.type === 'question' ? 'questioned' : 'connected'),
      date: annotation.date || today(),
    });
    setEditing(null);
  };

  const openPreflight = (annotation: FlatAnnotation, mode: PreflightMode) => {
    const tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags);
    setPreflight({
      mode,
      annotation,
      title: annotation.text.slice(0, 90),
      body: annotation.answer ? `${annotation.text}\n\nAnswer: ${annotation.answer}` : annotation.text,
      question: annotation.type === 'question' ? annotation.text : `What does this imply: ${annotation.text}`,
      tags,
    });
  };

  const submitPreflight = () => {
    if (!preflight) return;
    if (preflight.mode === 'position') {
      void createPosition(preflight.annotation, preflight.title, preflight.body, preflight.tags, true);
    } else {
      void createInquiry(preflight.annotation, preflight.question, preflight.tags, true);
    }
    setPreflight(null);
  };

  const createPosition = async (
    annotation: FlatAnnotation,
    title = annotation.text.slice(0, 90),
    body = annotation.answer ? `${annotation.text}\n\nAnswer: ${annotation.answer}` : annotation.text,
    tags = normalizeConceptTags(annotation.conceptTags || annotation.source.tags),
    navigateOnCreate = false
  ) => {
    if (annotation.createdPositionId) {
      toast({ title: 'Position already exists', description: 'This annotation already has a position draft.' });
      if (navigateOnCreate) onNavigate?.('vault', annotation.createdPositionId);
      return annotation.createdPositionId;
    }
    setPendingAction(`position:${annotation.id}`);
    const created = onCreatePosition({
      title,
      body,
      tags,
      sourceIds: [annotation.source.id],
      sourceAnnotationId: annotation.id,
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
    navigateOnCreate = false
  ) => {
    if (annotation.createdInquiryId) {
      toast({ title: 'Inquiry already exists', description: 'This annotation already has an inquiry.' });
      if (navigateOnCreate) onNavigate?.('questions', annotation.createdInquiryId);
      return annotation.createdInquiryId;
    }
    setPendingAction(`inquiry:${annotation.id}`);
    const created = onCreateInquiry({
      text,
      conceptIds: concepts.filter((concept) => tags.map(conceptKey).includes(conceptKey(concept.name))).map((concept) => concept.id),
      sourceIds: [annotation.source.id],
      evidenceIds: [annotation.id],
      type: 'annotation',
      sourceAnnotationId: annotation.id,
    });
    const { source, ...annotationData } = annotation;
    onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'questioned', createdInquiryId: created.id });
    toast({ title: 'Inquiry draft created from annotation.', description: 'You can keep working it in Inquiries.' });
    if (navigateOnCreate) onNavigate?.('questions', created.id);
    setPendingAction(null);
    return created.id;
  };

  const suggestConsequences = async (annotation: FlatAnnotation) => {
    setSuggestingId(annotation.id);
    try {
      const suggestion = await aiClient.suggestAnnotationConsequences({
        annotationText: annotation.text,
        annotationType: annotation.type,
        sourceTitle: annotation.source.title,
        existingConcepts: concepts.map((concept) => concept.name),
        existingInquiries: inquiries.map((inquiry) => inquiry.text),
        existingPositions: positions.map((position) => position.statement || position.title),
      });
      onCreateSuggestion({
        targetType: 'annotation',
        targetId: `${annotation.source.id}:${annotation.id}`,
        targetLabel: annotation.text.slice(0, 90),
        suggestionType: 'annotation_consequence',
        title: 'Possible consequence',
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
      onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'connected' });
      toast({ title: 'Annotation marked as conceptual clarification.', description: 'It stays in the inbox as reviewed concept material.' });
      return;
    }
    if (action === 'raises_question') {
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
    onUpdateAnnotation(source.id, { ...annotationData, philosophyStatus: 'reference_only', consequenceKind: 'interpretation' });
    toast({ title: 'Kept as reference.', description: 'This note will remain attached to the source without becoming a new object.' });
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

  const createPositionFromSelection = () => {
    if (!selectedAnnotations.length) return;
    const sourceIds = Array.from(new Set(selectedAnnotations.map((annotation) => annotation.source.id)));
    const tags = normalizeConceptTags(selectedAnnotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []));
    const first = selectedAnnotations[0];
    const body = selectedAnnotations.map((annotation) => `- ${annotation.text}${annotation.answer ? `\n  Answer: ${annotation.answer}` : ''}`).join('\n\n');
    const created = onCreatePosition({
      title: first.text.slice(0, 90),
      body,
      tags,
      sourceIds,
      sourceAnnotationId: first.id,
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
    const created = onCreateInquiry({
      text: selectedAnnotations.find((annotation) => annotation.type === 'question')?.text || `What follows from these annotations?\n\n${selectedAnnotations.map((annotation) => `- ${annotation.text}`).join('\n')}`,
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
    { id: 'raw', label: 'Unprocessed', count: typeCounts.raw || 0, always: true },
    { id: 'needs_context', label: 'Needs Context', count: annotations.filter(needsContext).length },
    { id: 'needs_direction', label: 'Needs Direction', count: annotations.filter(needsSupportDirection).length },
    { id: 'evidence_ready', label: 'Evidence Ready', count: annotations.filter(isEvidenceReady).length },
    { id: 'potentially_important', label: 'Important', count: annotations.filter(isPotentiallyImportant).length },
    { id: 'recently_promoted', label: 'Promoted', count: annotations.filter(isRecentlyPromoted).length },
    { id: 'reference_only', label: 'Reference', count: typeCounts.reference_only || 0 },
    { id: 'archived', label: 'Archived', count: typeCounts.archived || 0 },
    { id: 'highlight', label: 'Highlights', count: typeCounts.highlight || 0 },
    { id: 'claim', label: 'Claims', count: typeCounts.claim || 0 },
    { id: 'objection', label: 'Objections', count: typeCounts.objection || 0 },
    { id: 'definition', label: 'Definitions', count: typeCounts.definition || 0 },
    { id: 'question', label: 'Questions', count: typeCounts.question || 0 },
    { id: 'unanswered', label: 'Unanswered', count: typeCounts.unanswered },
    { id: 'connection', label: 'Connections', count: typeCounts.connection || 0 },
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
        sortLabel={`Sorted by ${sortBy.replace(/_/g, ' ')}`}
        className="mb-5"
      >
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as AnnotationSort)}>
          <SelectTrigger className="w-44 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest" className="font-code text-[10px] uppercase">Newest</SelectItem>
            <SelectItem value="oldest" className="font-code text-[10px] uppercase">Oldest</SelectItem>
            <SelectItem value="source" className="font-code text-[10px] uppercase">Source</SelectItem>
            <SelectItem value="type" className="font-code text-[10px] uppercase">Type</SelectItem>
            <SelectItem value="status" className="font-code text-[10px] uppercase">Status</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
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

          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-56 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="Filter by Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Sources</SelectItem>
              {media.map((source) => <SelectItem key={source.id} value={source.id} className="font-code text-[10px] uppercase">{source.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterConcept} onValueChange={setFilterConcept}>
            <SelectTrigger className="w-56 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="Filter by Concept" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Concepts</SelectItem>
              {allConcepts.map(c => <SelectItem key={c} value={c} className="font-code text-[10px] uppercase">{c}</SelectItem>)}
            </SelectContent>
          </Select>
      </FilterToolbar>

      <section className="mb-8 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
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
              <Quote className="mr-1.5 size-3.5" /> Keep as reference
            </Button>
            {selectedAnnotations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedKeys([])} className="rounded-full">
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filtered.map((annotation) => {
          const selectedEffect = selectedEffectForAnnotation(annotation);
          const contextValue = annotation.context || '';
          return (
          <Card key={`${annotation.source.id}:${annotation.id}`} className={cn(
            "p-5 bg-white border border-accent/10 shadow-md rounded-2xl group hover:shadow-xl transition-all",
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
                    {annotation.type}
                  </Badge>
                  <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest rounded-full bg-accent/5 text-accent font-bold">
                    {annotationStatus(annotation).replace(/_/g, ' ')}
                  </Badge>
                  {missingSourceContext(annotation) && (
                    <Badge variant="outline" className="font-code text-[8px] uppercase tracking-widest rounded-full border-amber-200 bg-amber-50 text-amber-800 font-bold">
                      add context
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              <p className="font-body italic leading-relaxed text-[18px] text-primary/90 relative z-10">"{annotation.text}"</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {normalizeConceptTags(annotation.conceptTags || annotation.source.tags).map((tag) => (
                <Badge key={tag} variant="secondary" className="font-code text-[8px] uppercase tracking-wider rounded-full bg-muted/20 text-muted-foreground font-bold">{tag}</Badge>
              ))}
            </div>

            <div className="mb-3 rounded-xl border border-border/40 bg-background/70 p-3">
              <Label className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60">Optional context</Label>
              <Textarea
                defaultValue={contextValue}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value !== contextValue) {
                    const { source, ...annotationData } = annotation;
                    onUpdateAnnotation(source.id, { ...annotationData, context: value });
                  }
                }}
                placeholder="Add the surrounding idea only if this note needs it."
                className="mt-2 min-h-16 rounded-xl bg-card text-xs leading-5"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={Boolean(annotation.mattersBeyondSource)}
                  onCheckedChange={(checked) => updateAnnotationConsequence(annotation, {
                    mattersBeyondSource: Boolean(checked),
                    philosophyStatus: annotationStatus(annotation) === 'raw' ? 'reviewed' : annotationStatus(annotation),
                  })}
                />
                This is my interpretation, not the author's claim.
              </label>
            </div>

            <div className="mb-3 rounded-xl border border-accent/15 bg-accent/5 p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="font-code text-[8px] uppercase tracking-widest text-accent font-bold">How does this affect your thinking?</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {consequenceQuestion(annotation)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['supports_claim', 'Supports a position'],
                    ['challenges_claim', 'Challenges a position'],
                    ['raises_question', 'Raises a question'],
                    ['clarifies', 'Clarifies an idea'],
                    ['reference', 'Keep as reference'],
                  ] as Array<[ConsequenceAction, string]>).map(([action, label]) => (
                    <Button
                      key={action}
                      type="button"
                      variant={selectedEffect === action ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => runConsequenceAction(annotation, action)}
                      className="h-8 rounded-full px-3 font-code text-[8px] uppercase tracking-widest"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60">Next action</div>
                    <p className="mt-1 text-xs text-muted-foreground">{nextActionLabelForEffect(annotation, selectedEffect)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => runConsequenceAction(annotation, selectedEffect)}
                    className="rounded-full"
                  >
                    {nextActionLabelForEffect(annotation, selectedEffect)}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openPreflight(annotation, 'position')}
                  className="self-start rounded-full px-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Form position instead
                </Button>
              </div>
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
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="icon" onClick={() => suggestConsequences(annotation)} disabled={suggestingId === annotation.id} className="size-11 rounded-full bg-card border-border/60" title="Ask Noesis AI">
                  {suggestingId === annotation.id ? <Loader2 className="size-5 animate-spin" /> : <GenerativeAiIcon className="size-8" />}
                </Button>
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
                        philosophyStatus: linkDialog.linkType === 'supports' ? 'used_in_position' : 'questioned',
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
          <DialogHeader><DialogTitle className="font-headline text-2xl italic">Edit Annotation</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editing.type} onValueChange={(value) => setEditing((prev) => prev ? { ...prev, type: value as AnnotationType } : prev)}>
                    <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANNOTATION_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Processing State</Label>
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
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={editing.source.title} disabled className="rounded-full" />
              </div>
              <div className="space-y-2">
                <Label>Text</Label>
                <Textarea value={editing.text} onChange={(event) => setEditing((prev) => prev ? { ...prev, text: event.target.value } : prev)} className="min-h-[140px]" />
              </div>
              {editing.type === 'question' && (
                <div className="space-y-2">
                  <Label>Working Answer</Label>
                  <Textarea value={editing.answer || ''} onChange={(event) => setEditing((prev) => prev ? { ...prev, answer: event.target.value } : prev)} className="min-h-[100px]" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Concepts</Label>
                <ConceptTagPicker
                  concepts={concepts}
                  value={editing.conceptTags || editing.source.tags || []}
                  onChange={(tags) => setEditing((prev) => prev ? { ...prev, conceptTags: normalizeConceptTags(tags) } : prev)}
                  onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_190px]">
                <div className="space-y-2">
                  <Label>Suggested Consequence</Label>
                  <Textarea
                    value={editing.consequenceNote || ''}
                    onChange={(event) => setEditing((prev) => prev ? { ...prev, consequenceNote: event.target.value } : prev)}
                    placeholder="What does this suggest, challenge, clarify, or raise?"
                    className="min-h-[90px]"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Consequence Kind</Label>
                    <Select value={editing.consequenceKind || 'interpretation'} onValueChange={(value) => setEditing((prev) => prev ? { ...prev, consequenceKind: value as AnnotationConsequenceKind } : prev)}>
                      <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONSEQUENCE_KINDS.map((kind) => (
                          <SelectItem key={kind.id} value={kind.id}>{kind.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing((prev) => prev ? { ...prev, mattersBeyondSource: !prev.mattersBeyondSource } : prev)}
                    className={cn(
                      "w-full rounded-full border px-4 py-2 font-code text-[9px] font-bold uppercase tracking-widest transition-colors",
                      editing.mattersBeyondSource ? "border-accent/40 bg-accent/10 text-accent" : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Matters Beyond Source
                  </button>
                </div>
              </div>
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
            <DialogTitle className="font-headline text-2xl italic">Route Annotation</DialogTitle>
            <p className="text-sm text-muted-foreground">Shape the object before Noesis sends it to the right workspace.</p>
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
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Question To Work</Label>
                  <Textarea value={preflight.question} onChange={(event) => setPreflight((prev) => prev ? { ...prev, question: event.target.value } : prev)} className="min-h-[140px]" />
                </div>
              )}

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
