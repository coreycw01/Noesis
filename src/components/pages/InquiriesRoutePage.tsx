"use client";

import { QuestionsWorkspace } from '@/components/Questions/QuestionsWorkspace';
import type { AiSettings, Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface InquiriesRoutePageProps {
  aiSettings: AiSettings;
  questions: Question[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  concepts: Concept[];
  focusedQuestionId?: string | null;
  onAddQuestion: (data: Partial<Question>) => Promise<Question>;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onSaveAiReview: (inquiryId: string, review: import('@/lib/inquiry-ai-review').InquiryAiReview, content: string) => Promise<void>;
  onDeleteQuestion: (id: string) => void | Promise<void>;
  onAddVaultEntry: (data: Partial<VaultEntry>) => void;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onLinkItem: (inquiryId: string, type: 'work' | 'practice', itemId: string) => Promise<void>;
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => Promise<VaultEntry>;
  onNavigate: (view: NoesisView, options?: { questionId?: string | null; workId?: string | null; practiceId?: string | null; positionId?: string | null; annotationSourceId?: string; annotationId?: string }) => void;
}

export function InquiriesRoutePage({
  aiSettings,
  questions,
  media,
  vault,
  drafts,
  practices,
  concepts,
  focusedQuestionId,
  onAddQuestion,
  onUpdateQuestion,
  onSaveAiReview,
  onDeleteQuestion,
  onAddVaultEntry,
  onAddDraft,
  onLinkItem,
  onAddPractice,
  onFormPositionFromInquiry,
  onNavigate,
}: InquiriesRoutePageProps) {
  return (
    <QuestionsWorkspace
      aiSettings={aiSettings}
      questions={questions}
      media={media}
      vault={vault}
      drafts={drafts}
      practices={practices}
      concepts={concepts}
      onAddQuestion={onAddQuestion}
      onUpdateQuestion={onUpdateQuestion}
      onSaveAiReview={onSaveAiReview}
      onDeleteQuestion={onDeleteQuestion}
      onAddVaultEntry={onAddVaultEntry}
      onAddDraft={onAddDraft}
      onLinkItem={onLinkItem}
      onAddPractice={onAddPractice}
      onOpenWork={(workId) => onNavigate('writing', { workId })}
      onOpenPosition={(positionId) => onNavigate('vault', { positionId })}
      onOpenAnnotation={(annotationSourceId, annotationId) => onNavigate('annotations', { annotationSourceId, annotationId })}
      onOpenPractice={(practiceId) => onNavigate('labs', { practiceId })}
      onFormPositionFromInquiry={onFormPositionFromInquiry}
      focusedQuestionId={focusedQuestionId}
      onOpenQuestionRoute={(questionId) => onNavigate('questions', { questionId })}
    />
  );
}
