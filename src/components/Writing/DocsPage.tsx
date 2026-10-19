
"use client";

import React, { useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { PageSize, PaperColor, PaperPattern } from './Atelier';
import type { DrawingTool, WritingStyle } from '@/lib/types';
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
  overlayData: string;
  backgroundArtwork?: string;
  onOverlayChange: (content: string) => void;
  overlayTool: DrawingTool;
  overlayColor: string;
  overlayBrushSize: number;
  overlayOpacity: number;
  overlayEnabled: boolean;
  inlineTools?: ReactNode;
}

export function DocsPage({ pageNumber, pageSize, paperColor, paperPattern, writingStyle, content, onContentChange, isEditable, showBoundary, overlayData, backgroundArtwork, onOverlayChange, overlayTool, overlayColor, overlayBrushSize, overlayOpacity, overlayEnabled, inlineTools }: DocsPageProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const overlayDrawingRef = useRef(false);
  const overlayStartRef = useRef<{ x: number; y: number } | null>(null);
  const overlayBaseRef = useRef<ImageData | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current !== document.activeElement) {
      editorRef.current.innerHTML = sanitizeHtml(content);
    }
  }, [content]);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    if (!overlayData) return;
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, width, height);
    image.src = overlayData;
  }, [overlayData]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  useEffect(() => {
    const onResize = () => redrawOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redrawOverlay]);

  const getOverlayPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const drawShape = (ctx: CanvasRenderingContext2D, tool: DrawingTool, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const width = end.x - start.x;
    const height = end.y - start.y;
    ctx.beginPath();
    if (tool === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    } else if (tool === 'rectangle') {
      ctx.strokeRect(start.x, start.y, width, height);
      return;
    } else if (tool === 'ellipse') {
      ctx.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
    } else if (tool === 'arrow') {
      const angle = Math.atan2(height, width);
      const head = Math.max(8, Math.min(18, overlayBrushSize * 3));
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    }
    ctx.stroke();
  };

  const startOverlayDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditable || !overlayEnabled) return;
    const ctx = overlayRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getOverlayPoint(event);
    if (overlayTool === 'text') {
      const text = window.prompt('Text to add to the drawing:');
      if (!text?.trim()) return;
      ctx.save();
      ctx.fillStyle = overlayColor;
      ctx.globalAlpha = overlayOpacity;
      ctx.font = `${Math.max(14, overlayBrushSize * 4)}px Georgia, serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(text.trim(), point.x, point.y);
      ctx.restore();
      onOverlayChange(event.currentTarget.toDataURL('image/png'));
      return;
    }
    overlayDrawingRef.current = true;
    overlayStartRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = overlayTool === 'marker' ? overlayBrushSize * 3 : overlayTool === 'pencil' ? Math.max(1, overlayBrushSize * 0.65) : overlayBrushSize;
    ctx.strokeStyle = overlayColor;
    ctx.globalAlpha = overlayTool === 'marker' ? Math.min(overlayOpacity, 0.3) : overlayTool === 'pencil' ? Math.min(overlayOpacity, 0.65) : overlayOpacity;
    ctx.globalCompositeOperation = overlayTool === 'eraser' ? 'destination-out' : 'source-over';
    if (['line', 'rectangle', 'ellipse', 'arrow'].includes(overlayTool)) {
      overlayBaseRef.current = ctx.getImageData(0, 0, event.currentTarget.width, event.currentTarget.height);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const moveOverlayDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!overlayDrawingRef.current || !overlayEnabled) return;
    const ctx = overlayRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getOverlayPoint(event);
    if (overlayStartRef.current && ['line', 'rectangle', 'ellipse', 'arrow'].includes(overlayTool)) {
      if (overlayBaseRef.current) ctx.putImageData(overlayBaseRef.current, 0, 0);
      drawShape(ctx, overlayTool, overlayStartRef.current, point);
      return;
    }
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endOverlayDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!overlayDrawingRef.current || !overlayEnabled) return;
    overlayDrawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    overlayStartRef.current = null;
    overlayBaseRef.current = null;
    const ctx = overlayRef.current?.getContext('2d');
    if (ctx) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const data = overlayRef.current?.toDataURL('image/png');
    if (data) onOverlayChange(data);
  };

  const sizeClasses = {
    letter: "w-full max-w-[850px] min-h-[1100px]",
    a4: "w-full max-w-[827px] min-h-[1169px]"
  };

  const colorClasses = {
    blank: "bg-[#ffffff] text-[#211f1c]",
    warm: "bg-[#fffaf0] text-[#302820]",
    sepia: "bg-[#f4ecd8] text-[#5b4636]",
    dark: "bg-slate-900 text-slate-200"
  };

  const getPatternStyles = () => {
    if (paperPattern === 'none') return {};
    const guide = paperColor === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(86, 72, 56, 0.15)';
    const guideStrong = paperColor === 'dark' ? 'rgba(255, 255, 255, 0.21)' : 'rgba(86, 72, 56, 0.23)';
    if (paperPattern === 'notebook') {
      return {
        backgroundImage: `linear-gradient(${guide} 1px, transparent 1px)`,
        backgroundSize: '100% 2.4em'
      };
    }
    if (paperPattern === 'grid') {
      return {
        backgroundImage: `linear-gradient(${guide} 1px, transparent 1px), linear-gradient(90deg, ${guide} 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      };
    }
    if (paperPattern === 'dotted') {
      return {
        backgroundImage: `radial-gradient(${guideStrong} 1px, transparent 1px)`,
        backgroundSize: '18px 18px'
      };
    }
    if (paperPattern === 'dotted_grid') {
      return {
        backgroundImage: `linear-gradient(${guide} 1px, transparent 1px), linear-gradient(90deg, ${guide} 1px, transparent 1px), radial-gradient(${guideStrong} 1px, transparent 1px)`,
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
      paperPattern === 'notebook' && "before:absolute before:bottom-0 before:left-8 before:top-0 before:w-px before:bg-red-200/60 sm:before:left-12 lg:before:left-20"
    )}
    style={getPatternStyles()}
    >
      {backgroundArtwork && <img src={backgroundArtwork} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-85" />}
      <div className="absolute right-6 top-6 opacity-0 transition-opacity group-hover:opacity-100 sm:right-12 sm:top-8">
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
        suppressContentEditableWarning
        role="textbox"
        aria-label="Document body"
        aria-multiline="true"
        spellCheck
        data-placeholder="Start writing…"
        onInput={(e) => onContentChange(sanitizeHtml(e.currentTarget.innerHTML))}
        className={cn(
          "relative z-[1] p-6 font-body text-base italic leading-8 focus:outline-none empty:before:pointer-events-none empty:before:text-current/25 empty:before:content-[attr(data-placeholder)] sm:p-12 sm:text-[17px] sm:leading-9 lg:p-24 lg:text-[18px] lg:leading-[2.4]",
          inlineTools ? "min-h-64 pb-8 sm:pb-10 lg:pb-12" : "flex-1",
          !isEditable && "pointer-events-none opacity-20",
          paperPattern === 'notebook' && "pl-12 sm:pl-16 lg:pl-28",
          writingStyle === 'cornell_notes' && "pb-36 sm:pl-[240px]",
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
      {inlineTools && <div className="relative z-[2] space-y-6 px-6 pb-10 sm:px-12 lg:px-24" aria-label="Inline document tools">{inlineTools}</div>}
      <canvas
        ref={overlayRef}
        onPointerDown={startOverlayDraw}
        onPointerMove={moveOverlayDraw}
        onPointerUp={endOverlayDraw}
        onPointerLeave={() => { overlayDrawingRef.current = false; }}
        className={cn(
          "absolute inset-0 h-full w-full",
          overlayEnabled ? "z-20 pointer-events-auto" : "z-0 pointer-events-none",
          isEditable ? "cursor-crosshair" : "pointer-events-none"
        )}
      />

      {structureLabels[writingStyle] && (
        <div className="pointer-events-none absolute inset-0 p-16 font-code text-[9px] font-bold uppercase tracking-widest text-accent/45">
          {structureLabels[writingStyle]!.map((label, index) => (
            <span
              key={label}
              className={cn(
                "absolute rounded-full border border-accent/15 bg-card/80 px-3 py-1",
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
