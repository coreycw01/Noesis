import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('settings');

export default function SettingsPage() {
  return <NoesisRouteSurface routeState={{ view: 'settings' }} />;
}
