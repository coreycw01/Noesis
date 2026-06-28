
"use client";

import React, { useRef, useEffect } from 'react';
import type { PageSize, PaperColor, PaperPattern } from './Atelier';
import type { WritingStyle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

interface DocsPageProps {
  pageNumber: number;
  pageSize: PageSize;
  paperColor: PaperColor;
  paperPattern: PaperPattern;
  writingStyle: WritingStyle;
  content: string;
  onContentChange: (content: string) => void;
  isEditable: boolean;
  showBoundary?: boolean;
}

export function DocsPage({ pageNumber, pageSize, paperColor, paperPattern, writingStyle, content, onContentChange, isEditable, showBoundary }: DocsPageProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current !== document.activeElement) {
      editorRef.current.innerHTML = sanitizeHtml(content);
    }
  }, [content]);

  const sizeClasses = {
    letter: "w-[850px] min-h-[1100px]",
    a4: "w-[827px] min-h-[1169px]"
  };

  const colorClasses = {
    blank: "bg-white text-primary",
    warm: "bg-amber-50/40 text-primary",
    sepia: "bg-[#f4ecd8] text-[#5b4636]",
    dark: "bg-slate-900 text-slate-200"
  };

  const getPatternStyles = () => {
    if (paperPattern === 'none') return {};
    if (paperPattern === 'notebook') {
      return {
        backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '100% 2.4em'
      };
    }
    if (paperPattern === 'grid') {
      return {
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      };
    }
    if (paperPattern === 'dotted') {
      return {
        backgroundImage: 'radial-gradient(#d6d3d1 1px, transparent 1px)',
        backgroundSize: '18px 18px'
      };
    }
    if (paperPattern === 'dotted_grid') {
      return {
        backgroundImage: 'linear-gradient(#eee8df 1px, transparent 1px), linear-gradient(90deg, #eee8df 1px, transparent 1px), radial-gradient(#cfc6bb 1px, transparent 1px)',
        backgroundSize: '28px 28px, 28px 28px, 14px 14px'
      };
    }
    return {};
  };

  const structureClasses: Record<WritingStyle, string> = {
    blank_paper: '',
    ruled_notebook: '',
    manuscript: 'after:absolute after:left-24 after:right-24 after:top-24 after:h-px after:bg-border/25 after:shadow-[0_72px_0_hsl(var(--border)/0.22),0_144px_0_hsl(var(--border)/0.22),0_216px_0_hsl(var(--border)/0.22)]',
    cornell_notes: 'before:absolute before:left-[210px] before:top-20 before:bottom-32 before:w-px before:bg-accent/25 after:absolute after:left-16 after:right-16 after:bottom-28 after:h-px after:bg-accent/25',
    two_column_debate: 'before:absolute before:left-1/2 before:top-20 before:bottom-20 before:w-px before:bg-accent/25',
    dialectic: 'after:absolute after:left-16 after:right-16 after:top-[32%] after:h-px after:bg-accent/20 before:absolute before:left-16 before:right-16 before:top-[61%] before:h-px before:bg-accent/20',
    belief_audit: 'after:absolute after:inset-16 after:rounded-xl after:border after:border-dashed after:border-accent/20',
    source_analysis: 'after:absolute after:left-16 after:right-16 after:top-40 after:h-px after:bg-border/35 before:absolute before:left-16 before:right-16 before:top-[58%] before:h-px before:bg-border/35',
    mind_map: 'after:absolute after:left-1/2 after:top-1/2 after:size-36 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-accent/25 after:bg-accent/5 before:absolute before:left-1/2 before:top-1/2 before:size-[420px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-dashed before:border-accent/15',
    timeline: 'before:absolute before:left-20 before:right-20 before:top-1/2 before:h-px before:bg-accent/35 after:absolute after:left-20 after:top-1/2 after:size-3 after:-translate-y-1/2 after:rounded-full after:bg-accent/50 after:shadow-[160px_0_0_hsl(var(--accent)/0.45),320px_0_0_hsl(var(--accent)/0.35),480px_0_0_hsl(var(--accent)/0.25)]',
  };

  const structureLabels: Partial<Record<WritingStyle, string[]>> = {
    cornell_notes: ['Cues', 'Notes', 'Summary'],
    two_column_debate: ['Argument', 'Counterargument'],
    dialectic: ['Thesis', 'Antithesis', 'Synthesis'],
    belief_audit: ['Belief', 'Evidence', 'Assumptions', 'Objections', 'Revision'],
    source_analysis: ['Citation / Source', 'Claims + Evidence', 'Critique + Connections'],
    mind_map: ['Central Idea'],
    timeline: ['Past', 'Now', 'Next'],
  };

  return (
    <div className={cn(
      "relative shadow-2xl transition-all duration-300 origin-center flex flex-col group",
      sizeClasses[pageSize],
      colorClasses[paperColor],
      structureClasses[writingStyle],
      showBoundary && "border border-border/20",
      paperPattern === 'notebook' && "before:absolute before:left-20 before:top-0 before:bottom-0 before:w-px before:bg-red-200/60"
    )}
    style={getPatternStyles()}
    >
      <div className="absolute top-8 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={cn(
          "font-code text-[9px] uppercase tracking-widest font-bold",
          paperColor === 'dark' ? "text-slate-500" : "text-muted-foreground/40"
        )}>
          PAGE {pageNumber}
        </span>
      </div>

      <div 
        ref={editorRef}
        contentEditable={isEditable}
        onInput={(e) => onContentChange(sanitizeHtml(e.currentTarget.innerHTML))}
        className={cn(
          "flex-1 p-24 focus:outline-none font-body text-[18px] italic leading-[2.4]",
          !isEditable && "pointer-events-none opacity-20",
          paperPattern === 'notebook' && "pl-28",
          writingStyle === 'cornell_notes' && "pl-[240px] pb-36",
          writingStyle === 'two_column_debate' && "columns-2 gap-20",
          writingStyle === 'manuscript' && "leading-[2.8]",
          writingStyle === 'mind_map' && "pt-[420px] text-center",
          writingStyle === 'timeline' && "pt-[620px]"
        )}
        style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap'
        }}
      />

      {structureLabels[writingStyle] && (
        <div className="pointer-events-none absolute inset-0 p-16 font-code text-[9px] font-bold uppercase tracking-widest text-accent/45">
          {structureLabels[writingStyle]!.map((label, index) => (
            <span
              key={label}
              className={cn(
                "absolute rounded-full border border-accent/15 bg-white/70 px-3 py-1",
                writingStyle === 'cornell_notes' && index === 0 && "left-20 top-24",
                writingStyle === 'cornell_notes' && index === 1 && "left-[240px] top-24",
                writingStyle === 'cornell_notes' && index === 2 && "left-20 bottom-20",
                writingStyle === 'two_column_debate' && index === 0 && "left-24 top-24",
                writingStyle === 'two_column_debate' && index === 1 && "right-24 top-24",
                writingStyle === 'dialectic' && index === 0 && "left-24 top-24",
                writingStyle === 'dialectic' && index === 1 && "left-24 top-[36%]",
                writingStyle === 'dialectic' && index === 2 && "left-24 top-[65%]",
                writingStyle === 'belief_audit' && index === 0 && "left-24 top-[20%]",
                writingStyle === 'belief_audit' && index === 1 && "left-24 top-[33%]",
                writingStyle === 'belief_audit' && index === 2 && "left-24 top-[46%]",
                writingStyle === 'belief_audit' && index === 3 && "left-24 top-[59%]",
                writingStyle === 'belief_audit' && index === 4 && "left-24 top-[72%]",
                writingStyle === 'source_analysis' && index === 0 && "left-24 top-24",
                writingStyle === 'source_analysis' && index === 1 && "left-24 top-44",
                writingStyle === 'source_analysis' && index === 2 && "left-24 top-[61%]",
                writingStyle === 'mind_map' && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                writingStyle === 'timeline' && index === 0 && "left-20 top-[47%]",
                writingStyle === 'timeline' && index === 1 && "left-1/2 top-[47%] -translate-x-1/2",
                writingStyle === 'timeline' && index === 2 && "right-20 top-[47%]"
              )}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="h-16 flex items-center justify-center">
        <div className={cn(
          "w-12 h-px",
          paperColor === 'dark' ? "bg-slate-800" : "bg-muted/10"
        )} />
      </div>
    </div>
  );
}
