import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('evolution');

export default function EvolutionPage() {
  return <NoesisRouteSurface routeState={{ view: 'evolution' }} />;
}
