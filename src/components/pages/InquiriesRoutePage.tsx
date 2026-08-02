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
  onAddQuestion: (data: Partial<Question>) => Question;
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onAddVaultEntry: (data: Partial<VaultEntry>) => void;
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onAddPractice: (data: Partial<Practice>) => Practice;
  onUpdatePractice: (practice: Practice) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => void;
  onNavigate: (view: NoesisView, options?: { questionId?: string | null; workId?: string | null; practiceId?: string | null }) => void;
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
  onDeleteQuestion,
  onAddVaultEntry,
  onAddDraft,
  onUpdateDraft,
  onAddPractice,
  onUpdatePractice,
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
      onDeleteQuestion={onDeleteQuestion}
      onAddVaultEntry={onAddVaultEntry}
      onAddDraft={onAddDraft}
      onUpdateDraft={onUpdateDraft}
      onAddPractice={onAddPractice}
      onUpdatePractice={onUpdatePractice}
      onOpenWork={(workId) => onNavigate('writing', { workId })}
      onOpenPractice={(practiceId) => onNavigate('practices', { practiceId })}
      onFormPositionFromInquiry={onFormPositionFromInquiry}
      focusedQuestionId={focusedQuestionId}
      onOpenQuestionRoute={(questionId) => onNavigate('questions', { questionId })}
    />
  );
}
