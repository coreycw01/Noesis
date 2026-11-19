import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('exercises');

export default function ExercisesPage() {
  return <NoesisRouteSurface routeState={{ view: 'exercises' }} />;
}
