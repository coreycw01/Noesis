import { Badge } from '@/components/ui/badge';
import { deriveNoesisStage } from '@/lib/workflow-integrity';
import type { NoesisStage, PhilosophicalObjectType } from '@/lib/types';

const STAGE_LABELS: Record<NoesisStage, string> = {
  encounter: 'Encounter',
  question: 'Question',
  claim: 'Claim',
  test: 'Test',
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
      className={`rounded-full border-accent/35 bg-accent/5 font-code text-[8px] uppercase tracking-widest text-accent ${className}`}
    >
      {STAGE_LABELS[resolved]}
    </Badge>
  );
}
