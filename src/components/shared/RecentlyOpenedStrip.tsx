"use client";

import { useContext, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { pathForNoesisRouteTarget, type NoesisRouteTargetType, type NoesisView } from '@/lib/noesis-routes';
import { readRecentlyOpened, RECENTLY_OPENED_EVENT, type RecentlyOpenedItem } from '@/lib/recently-opened';
import { navigateWorkspace } from '@/lib/workspace-navigation';

const TYPE_VIEW: Record<NoesisRouteTargetType, NoesisView> = {
  concept: 'concepts', inquiry: 'questions', source: 'library', annotation: 'annotations', position: 'vault', work: 'writing', practice: 'labs',
};

/** Quick links back to the records last opened on this page, newest first. */
export function RecentlyOpenedStrip({ type, reviewMode }: { type: NoesisRouteTargetType; reviewMode: boolean }) {
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  const [items, setItems] = useState<RecentlyOpenedItem[]>([]);
  useEffect(() => {
    const load = () => setItems(readRecentlyOpened(workspaceKey).filter((item) => item.type === type).slice(0, 6));
    load();
    window.addEventListener(RECENTLY_OPENED_EVENT, load);
    return () => window.removeEventListener(RECENTLY_OPENED_EVENT, load);
  }, [type, workspaceKey]);
  if (!items.length) return null;
  return (
    <nav aria-label="Recently opened" className="noesis-recent-strip">
      <span className="noesis-recent-strip__label"><History className="size-3.5" aria-hidden="true" /> Last opened</span>
      {items.map((item) => (
        <button
          key={`${item.type}:${item.id}`}
          type="button"
          className="noesis-recent-strip__item"
          title={item.label}
          onClick={() => navigateWorkspace(window.history, pathForNoesisRouteTarget({ type: item.type, id: item.id, view: TYPE_VIEW[item.type], annotationSourceId: item.annotationSourceId }, { reviewMode }))}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
