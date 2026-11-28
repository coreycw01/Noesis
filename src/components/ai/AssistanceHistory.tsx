'use client';

import { useContext, useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { usePathname } from 'next/navigation';
import { useFirestore } from '@/firebase/provider';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { workspacePreferenceKey } from '@/lib/browser-preferences';
import type { AssistanceExchange } from '@/lib/assistance-exchange';
import { ContextualAiDocument } from './ContextualAiPanel';

function useExchangeScope() {
  const workspace = useContext(NoesisWorkspaceKeyContext);
  const pathname = usePathname();
  const db = useFirestore();
  const mode = workspace?.split(':').at(-1);
  const uid = mode === 'account' && !/^\/(demo|review)(\/|$)/.test(pathname) ? workspace!.slice(0, workspace!.lastIndexOf(':')) : null;
  const local = mode === 'demo' ? workspacePreferenceKey(workspace, 'assistance-exchanges') : null;
  return { db, uid, local };
}

export function useSaveExchange() {
  const { db, uid, local } = useExchangeScope();
  return async (entry: AssistanceExchange) => {
    if (local) {
      window.localStorage.setItem(local + ':' + entry.id, JSON.stringify(entry));
      window.dispatchEvent(new Event(local));
    } else if (uid) {
      await setDoc(doc(db, 'users', uid, 'assistanceExchanges', entry.id), entry);
    } else throw new Error('No private workspace is available.');
  };
}

export function AssistanceHistory({ itemKey, search = '' }: { itemKey?: string; search?: string }) {
  const { db, uid, local } = useExchangeScope();
  const scope = JSON.stringify([uid, local, itemKey]);
  const [state, setState] = useState<{ scope: string; rows?: AssistanceExchange[]; error?: boolean }>();
  useEffect(() => {
    const failed = () => setState({ scope, error: true });
    const ready = (rows: AssistanceExchange[]) => setState({ scope, rows: rows
      .filter(row => !itemKey || row.itemKey === itemKey)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, itemKey ? undefined : 100) });
    if (local) {
      const refresh = () => {
        try {
          ready(Object.keys(localStorage).filter(key => key.startsWith(local + ':')).map(key => JSON.parse(localStorage.getItem(key)!)));
        } catch { failed(); }
      };
      refresh();
      window.addEventListener(local, refresh);
      window.addEventListener('storage', refresh);
      return () => { window.removeEventListener(local, refresh); window.removeEventListener('storage', refresh); };
    }
    if (!uid) { failed(); return; }
    const ref = collection(db, 'users', uid, 'assistanceExchanges');
    return onSnapshot(itemKey ? query(ref, where('itemKey', '==', itemKey)) : query(ref, orderBy('generatedAt', 'desc'), limit(100)),
      snap => ready(snap.docs.map(d => d.data() as AssistanceExchange)), failed);
  }, [db, uid, local, scope, itemKey]);
  if (state?.scope !== scope) return <p role="status">Loading assistance history...</p>;
  if (state.error) return <p role="alert">Assistance history could not be loaded.</p>;
  const rows = state.rows?.filter(row => [row.itemKey, row.task, row.question, row.answer].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  if (!rows?.length) return <p className="text-sm text-muted-foreground">{search ? 'No matching exchanges.' : 'No recorded exchanges yet. Earlier suggestions that were never saved are not available.'}</p>;
  return <div>{rows.map(row => <details key={row.id} className="border-b border-border py-2">
    <summary className="cursor-pointer py-2 text-sm font-semibold">{row.question || row.task}
      <span className="ml-2 text-xs font-normal text-muted-foreground">{new Date(row.generatedAt).toLocaleString()}</span>
    </summary>
    <div className="pb-3"><p className="mb-2 text-xs text-muted-foreground">{row.task}{!itemKey && ' · ' + row.itemKey} · Original AI response</p>
      <ContextualAiDocument content={row.answer.replace(/^CLARIFY:\s*/i, '')} /></div>
  </details>)}</div>;
}
