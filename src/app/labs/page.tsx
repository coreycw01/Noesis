import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('practices');

export default function LabsPage() {
  return <NoesisRouteSurface routeState={{ view: 'practices' }} />;
}
