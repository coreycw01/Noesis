import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params;
  return metadataForNoesisDetail('vault', 'position', positionId);
}

export default async function PositionDetailPage({ params }: { params: Promise<{ positionId: string }> }) {
  const { positionId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'vault', focusedPositionId: positionId }} />;
}
