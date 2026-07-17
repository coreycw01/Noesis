import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('practices');

export default function PracticesPage() {
  return <NoesisRouteSurface routeState={{ view: 'practices' }} />;
}
