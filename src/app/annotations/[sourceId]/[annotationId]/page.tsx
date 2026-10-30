import { NoesisRouteSurface } from '../../../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('annotations');

export default async function AnnotationDetailPage({
  params,
}: {
  params: Promise<{ sourceId: string; annotationId: string }>;
}) {
  const { sourceId, annotationId } = await params;
  return (
    <NoesisRouteSurface
      routeState={{
        view: 'annotations',
        focusedAnnotationSourceId: sourceId,
        focusedAnnotationId: annotationId,
      }}
    />
  );
}
