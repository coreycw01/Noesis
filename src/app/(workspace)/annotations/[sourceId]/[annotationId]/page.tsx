import { NoesisRouteSurface } from '../../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisDetail('annotations', 'annotation');

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
