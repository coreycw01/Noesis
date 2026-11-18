import { Badge } from '@/components/ui/badge';
import { deriveNoesisStage } from '@/lib/workflow-integrity';
import type { NoesisStage, PhilosophicalObjectType } from '@/lib/types';

// Display names follow the sidebar's thinking loop; the stored stage keys are unchanged.
const STAGE_LABELS: Record<NoesisStage, string> = {
  encounter: 'Encounter',
  question: 'Examine',
  claim: 'Claim',
  test: 'Act',
  revise: 'Integrate',
};

const STAGE_TONES: Record<NoesisStage, string> = {
  encounter: 'encounter',
  question: 'examine',
  claim: 'claim',
  test: 'act',
  revise: 'integrate',
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
      data-stage-tone={STAGE_TONES[resolved]}
      className={`noesis-stage-badge rounded-none border-0 border-l-2 bg-transparent py-0 pl-1.5 pr-0 font-code text-[8px] font-semibold uppercase tracking-widest ${className}`}
    >
      {STAGE_LABELS[resolved]}
    </Badge>
  );
}
