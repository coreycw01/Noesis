import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('goals');

export default async function CommitmentPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'goals', focusedGoalId: goalId }} />;
}
