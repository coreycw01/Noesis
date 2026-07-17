import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('questions');

export default function InquiriesPage() {
  return <NoesisRouteSurface routeState={{ view: 'questions' }} />;
}
