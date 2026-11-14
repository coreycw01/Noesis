import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  return metadataForNoesisDetail('labs', 'practice', practiceId);
}

export default async function PracticeDetailPage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'labs', focusedPracticeId: practiceId }} />;
}
