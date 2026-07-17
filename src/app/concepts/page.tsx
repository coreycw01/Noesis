import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('concepts');

export default function ConceptsPage() {
  return <NoesisRouteSurface routeState={{ view: 'concepts' }} />;
}
