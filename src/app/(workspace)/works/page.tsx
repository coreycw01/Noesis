import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('writing');

export default function WorksPage() {
  return <NoesisRouteSurface routeState={{ view: 'writing' }} />;
}
