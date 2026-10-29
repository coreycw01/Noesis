import { Badge } from '@/components/ui/badge';
import { deriveNoesisStage } from '@/lib/workflow-integrity';
import type { NoesisStage, PhilosophicalObjectType } from '@/lib/types';

const STAGE_LABELS: Record<NoesisStage, string> = {
  encounter: 'Encounter',
  question: 'Question',
  claim: 'Claim',
  test: 'Praxis',
  revise: 'Revise',
};

export function StageBadge({
  type,
  stage,
  status,
  className = '',
}: {
  type: PhilosophicalObjectType;
  stage?: NoesisStage;
  status?: string;
  className?: string;
}) {
  const resolved = stage || deriveNoesisStage(type, status);
  return (
    <Badge
      variant="outline"
      className={`rounded-none border-0 border-l-2 border-accent/60 bg-transparent py-0 pl-1.5 pr-0 font-code text-[8px] font-semibold uppercase tracking-widest text-accent ${className}`}
    >
      {STAGE_LABELS[resolved]}
    </Badge>
  );
}
