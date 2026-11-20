import { Badge } from '@/components/ui/badge';
import { deriveNoesisStage } from '@/lib/workflow-integrity';
import type { NoesisStage, PhilosophicalObjectType } from '@/lib/types';

// Display names follow the sidebar's thinking loop; the stored stage keys are unchanged.
const STAGE_LABELS: Record<NoesisStage, string> = {
  encounter: 'Encounter',
  question: 'Examine',
  claim: 'Claim',
  test: 'Act',
  revise: 'Revise',
};

const STAGE_TONES: Record<NoesisStage, string> = {
  encounter: 'encounter',
  question: 'examine',
  claim: 'claim',
  test: 'act',
  revise: 'integrate',
};

/** Which stage of the loop a record is in: a Badge with a stage-coloured rule. */
export function StageBadge({ type, stage, status, className = '' }: {
  type: PhilosophicalObjectType;
  stage?: NoesisStage;
  status?: string;
  className?: string;
}) {
  const resolved = stage || deriveNoesisStage(type, status);
  return (
    <Badge tone="stage" shape="rule" data-stage-tone={STAGE_TONES[resolved]} className={className}>
      {STAGE_LABELS[resolved]}
    </Badge>
  );
}
