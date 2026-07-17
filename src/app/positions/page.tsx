import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('vault');

export default function PositionsPage() {
  return <NoesisRouteSurface routeState={{ view: 'vault' }} />;
}
