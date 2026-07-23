"use client";

import { QuestionsWorkspace } from '@/components/Questions/QuestionsWorkspace';
import type { Concept, Draft, Media, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface InquiriesRoutePageProps {
  questions: Question[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  concepts: Concept[];
  focusedQuestionId?: string | null;
  onAddQuestion: (data: Partial<Question>) => Question;
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onAddVaultEntry: (data: Partial<VaultEntry>) => void;
  onAddDraft: (data: Partial<Draft>) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => void;
  onNavigate: (view: NoesisView, options?: { questionId?: string | null }) => void;
}

export function InquiriesRoutePage({
  questions,
  media,
  vault,
  drafts,
  concepts,
  focusedQuestionId,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onAddVaultEntry,
  onAddDraft,
  onFormPositionFromInquiry,
  onNavigate,
}: InquiriesRoutePageProps) {
  return (
    <QuestionsWorkspace
      questions={questions}
      media={media}
      vault={vault}
      drafts={drafts}
      concepts={concepts}
      onAddQuestion={onAddQuestion}
      onUpdateQuestion={onUpdateQuestion}
      onDeleteQuestion={onDeleteQuestion}
      onAddVaultEntry={onAddVaultEntry}
      onAddDraft={onAddDraft}
      onFormPositionFromInquiry={onFormPositionFromInquiry}
      focusedQuestionId={focusedQuestionId}
      onOpenQuestionRoute={(questionId) => onNavigate('questions', { questionId })}
    />
  );
}
