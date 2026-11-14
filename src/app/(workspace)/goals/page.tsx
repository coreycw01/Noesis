import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('goals');

export default function GoalsPage() {
  return <NoesisRouteSurface routeState={{ view: 'goals' }} />;
}
