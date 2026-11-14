import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('profile');

export default function ProfilePage() {
  return <NoesisRouteSurface routeState={{ view: 'profile' }} />;
}
