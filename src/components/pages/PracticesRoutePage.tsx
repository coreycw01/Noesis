"use client";

import type { ReactNode } from 'react';
import { usePersistentView } from '@/hooks/use-persistent-view';
import type { PraxisMethod } from '@/components/Practices/PraxisMethodPicker';
import { PracticesWorkspace, practicePraxisMethod } from '@/components/Practices/PracticesWorkspace';
import type { AiSettings, Concept, Draft, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface PracticesRoutePageProps {
  aiSettings: AiSettings;
  renderCommitments: (pick: (method: 'practices' | 'experiments') => void) => ReactNode;
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  links: PhilosophicalLink[];
  focusedPracticeId?: string | null;
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onAddQuestion?: (data: Partial<Question>) => unknown;
  onUpdatePractice: (practice: Practice, approval?: import('@/lib/practice-ai-review').PracticeReviewApproval) => void | Promise<Practice | void>;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onNavigate: (view: NoesisView, options?: { practiceId?: string | null; questionId?: string | null; positionId?: string | null }) => void;
}

export function PracticesRoutePage({
  aiSettings,
  renderCommitments,
  practices,
  concepts,
  media,
  questions,
  positions,
  drafts,
  links,
  focusedPracticeId,
  onAddPractice,
  onAddQuestion,
  onUpdatePractice,
  onDeletePractice,
  onAddConcept,
  onCreateLink,
  onNavigate,
}: PracticesRoutePageProps) {
  const [method, setMethod] = usePersistentView<PraxisMethod>('noesis:labs-tool', 'practices', ['practices', 'experiments', 'commitments']);
  const focused = focusedPracticeId ? practices.find(item => item.id === focusedPracticeId) : undefined;
  const active = focused ? practicePraxisMethod(focused.type) : method;
  if (active === 'commitments') return <>{renderCommitments(setMethod)}</>;
  return (
    <PracticesWorkspace
      labTool={active}
      onPickMethod={next => { setMethod(next); if (focusedPracticeId) onNavigate('labs'); }}
      aiSettings={aiSettings}
      practices={practices}
      concepts={concepts}
      media={media}
      questions={questions}
      positions={positions}
      drafts={drafts}
      links={links}
      onAddPractice={onAddPractice}
      onAddQuestion={onAddQuestion}
      onUpdatePractice={onUpdatePractice}
      onDeletePractice={onDeletePractice}
      onAddConcept={onAddConcept}
      onCreateLink={onCreateLink}
      focusedPracticeId={focusedPracticeId}
      onOpenPracticeRoute={(practiceId) => onNavigate('labs', { practiceId })}
      onNavigateTarget={(target) => onNavigate(target.view, {
        practiceId: target.view === 'labs' ? target.targetId : null,
        questionId: target.view === 'questions' ? target.targetId : null,
        positionId: target.view === 'vault' ? target.targetId : null,
      })}
    />
  );
}
