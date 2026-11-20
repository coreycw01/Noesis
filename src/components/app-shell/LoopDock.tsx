"use client";

import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoveHorizontal, ChevronDown, ChevronUp, MoreHorizontal, Search, UserCircle2 } from 'lucide-react';
import { NoesisAiMark } from '@/components/ai/NoesisAiMark';
import { cn } from '@/lib/utils';
import { NOESIS_LOOP_STAGES, NOESIS_NAV_SECTION_TONE, NOESIS_PAGE_BY_VIEW, type NoesisNavSection } from '@/lib/noesis-page-definitions';
import { readBrowserPreference, writeBrowserPreference } from '@/lib/browser-preferences';

export const NOESIS_NAV_STYLE_KEY = 'noesis:nav-style';
export const NOESIS_NAV_STYLE_EVENT = 'noesis:nav-style';
export type NoesisNavStyle = 'sidebar' | 'loop';

/** The Loop is the default, as in the prototype; the sidebar is opt-in from Settings. */
export function readNavStyle(): NoesisNavStyle {
  return readBrowserPreference(NOESIS_NAV_STYLE_KEY) === 'sidebar' ? 'sidebar' : 'loop';
}

export function writeNavStyle(style: NoesisNavStyle) {
  writeBrowserPreference(NOESIS_NAV_STYLE_KEY, style);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOESIS_NAV_STYLE_EVENT, { detail: style }));
}

/** Follows the saved navigation style, including changes made in Settings. */
export function useNavStyle() {
  const [style, setStyle] = useState<NoesisNavStyle>('loop');
  useEffect(() => {
    setStyle(readNavStyle());
    const update = () => setStyle(readNavStyle());
    window.addEventListener(NOESIS_NAV_STYLE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(NOESIS_NAV_STYLE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return style;
}

interface LoopItem { id: string; icon: LucideIcon; count?: number }

const LOOP_STAGES: NoesisNavSection[] = [...NOESIS_LOOP_STAGES];

/**
 * The Loop: a floating dock that lays navigation out as the thinking cycle.
 * Each stage is a ring; opening one shows its pages. Today sits on the left,
 * More (Works, Noesis AI, Settings, Profile, Find) on the right, and the
 * whole dock folds down to a single pill when it is in the way.
 */
export function LoopDock({ items, activeView, attention, onNavigate, onFind, onOpenProfile }: {
  items: LoopItem[];
  activeView: string;
  attention: number;
  onNavigate: (view: string) => void;
  onFind: (opener: HTMLElement) => void;
  onOpenProfile: () => void;
}) {
  const [open, setOpen] = useState<NoesisNavSection | null>(null);
  const [folded, setFolded] = useState(false);
  const [anchor, setAnchor] = useState('center');
  const dock = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnchor(readBrowserPreference('noesis:loop-anchor') || 'center');
    setFolded(readBrowserPreference('noesis:loop-folded') === '1');
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!dock.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const fold = (next: boolean) => {
    setFolded(next);
    setOpen(null);
    writeBrowserPreference('noesis:loop-folded', next ? '1' : '0');
  };

  const pageSection = (id: string) => NOESIS_PAGE_BY_VIEW[id as keyof typeof NOESIS_PAGE_BY_VIEW]?.section;
  const activeSection = pageSection(activeView === 'goals' ? 'labs' : activeView);
  const itemsIn = (section: NoesisNavSection) => items.filter((item) => pageSection(item.id) === section && !(section === 'More' && item.id === 'context-desk'));
  const aiItem = items.find((item) => item.id === 'context-desk');
  const go = (view: string) => { setOpen(null); onNavigate(view); };
  const today = items.find((item) => item.id === 'home');

  if (folded) {
    const ActiveIcon = items.find((item) => item.id === activeView)?.icon;
    return (
      <div className="noesis-loop noesis-loop--folded" style={anchor === 'left' ? { left: '1rem', transform: 'none' } : anchor === 'right' ? { right: '1rem', left: 'auto', transform: 'none' } : undefined} data-stage={activeSection ? NOESIS_NAV_SECTION_TONE[activeSection] : 'more'}>
        <button type="button" className="noesis-loop__pill" onClick={() => fold(false)} aria-label="Show the Loop navigation">
          {ActiveIcon && <ActiveIcon className="size-4" aria-hidden="true" />}
          <span>{NOESIS_PAGE_BY_VIEW[activeView as keyof typeof NOESIS_PAGE_BY_VIEW]?.title || 'Noesis'}</span>
          <ChevronUp className="size-3.5 opacity-70" aria-hidden="true" />
        </button>
        <button type="button" className="grid size-11 place-items-center" aria-label={`Move navigation to ${anchor === 'center' ? 'right' : anchor === 'right' ? 'left' : 'center'}`} title="Move navigation" onClick={() => { const next = anchor === 'center' ? 'right' : anchor === 'right' ? 'left' : 'center'; setAnchor(next); writeBrowserPreference('noesis:loop-anchor', next); }}><MoveHorizontal className="size-4" /></button>
      </div>
    );
  }

  const stageButton = (section: NoesisNavSection) => {
    const tone = NOESIS_NAV_SECTION_TONE[section];
    const group = itemsIn(section);
    const isActive = activeSection === section;
    const total = group.reduce((sum, item) => sum + (item.count || 0), 0);
    return (
      <div key={section} className="noesis-loop__stage" data-stage={tone}>
        <button
          type="button"
          aria-expanded={open === section}
          aria-haspopup="true"
          aria-current={isActive ? 'true' : undefined}
          onClick={() => setOpen(open === section ? null : section)}
          className="noesis-loop__stage-button"
        >
          <span className="noesis-loop__ring" aria-hidden="true">
            {section === 'More' ? <MoreHorizontal className="size-4" /> : group[0] && (() => { const Icon = group[0].icon; return <Icon className="size-4" />; })()}
          </span>
          {section === 'More'
            ? <span className="sr-only">More</span>
            : <span className="noesis-loop__stage-name"><b className="noesis-loop__initial">{section[0]}</b>{section.slice(1)}</span>}
          {section !== 'More' && total > 0 && <span className="sr-only">{total} records</span>}
        </button>
        {open === section && (
          <div className="noesis-loop__pop" role="menu" aria-label={`${section} pages`}>
            <div className="noesis-loop__pop-label">{section}</div>
            {group.map((item) => {
              const page = NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW];
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" role="menuitem" className="noesis-loop__pop-item" aria-current={activeView === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">{page.title}</span>
                  {typeof item.count === 'number' && <span className="noesis-figure opacity-60">{item.count}</span>}
                </button>
              );
            })}
            {section === 'More' && (
              <>
                <button type="button" role="menuitem" className="noesis-loop__pop-item" onClick={() => { setOpen(null); onOpenProfile(); }}>
                  <UserCircle2 className="size-4 shrink-0" aria-hidden="true" /><span className="flex-1 text-left">Profile</span>
                </button>
                <button type="button" role="menuitem" className="noesis-loop__pop-item" onClick={(event) => { setOpen(null); onFind(event.currentTarget); }}>
                  <Search className="size-4 shrink-0" aria-hidden="true" /><span className="flex-1 text-left">Find in Noesis</span>
                  <span className="noesis-figure noesis-figure--sm opacity-60">Ctrl K</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav ref={dock} className="noesis-loop" aria-label="The Loop navigation">
      {today && (
        <button type="button" className="noesis-loop__today" data-stage="encounter" aria-current={activeView === 'home' ? 'page' : undefined} onClick={() => go('home')}>
          <today.icon className="size-4" aria-hidden="true" />
          <span>Today</span>
          {attention > 0 && <span className="noesis-loop__badge" aria-label={`${attention} items need attention`}>{attention > 9 ? '9+' : attention}</span>}
        </button>
      )}
      <span className="noesis-loop__divider" aria-hidden="true" />
      <div className="noesis-loop__cycle">
        {LOOP_STAGES.map((section, index) => (
          <div key={section} className="contents">
            {stageButton(section)}
            {index < LOOP_STAGES.length - 1 && <span className="noesis-loop__link" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <span className="noesis-loop__divider" aria-hidden="true" />
      {aiItem && (
        <button type="button" className="noesis-loop__ask" aria-current={activeView === 'context-desk' ? 'page' : undefined} onClick={() => go('context-desk')}>
          <NoesisAiMark className="size-5" />
          <span>Ask Noesis</span>
        </button>
      )}
      {stageButton('More')}
      <button type="button" className="noesis-loop__fold" onClick={() => fold(true)} aria-label="Fold the Loop navigation">
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
