
"use client";

import React, { type ReactNode, useRef, useState, useEffect } from 'react';
import { DocsPage } from './DocsPage';
import type { PageViewMode, PageSize, PaperColor, PaperPattern } from './Atelier';
import type { DrawingStroke, DrawingTool, WritingStyle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { pageAtReadingLine } from '@/lib/work-page-location';

interface DocumentCanvasProps {
  content: string;
  onContentChange: (content: string) => void;
  viewMode: PageViewMode;
  pageSize: PageSize;
  paperColor: PaperColor;
  paperPattern: PaperPattern;
  writingStyle: WritingStyle;
  title: string;
  overlayData: string;
  overlayStrokes?: DrawingStroke[];
  backgroundArtwork?: string;
  onOverlayChange: (content: string) => void;
  onOverlayStrokesChange?: (strokes: DrawingStroke[]) => void;
  overlayTool: DrawingTool;
  overlayColor: string;
  overlayGradientColor?: string | null;
  overlayBrushSize: number;
  overlayOpacity: number;
  overlayEnabled: boolean;
  inlineTools?: { overlay?: ReactNode; flow?: ReactNode };
  subpages?: ReactNode;
  toolSections?: ReactNode;
  pageCount: number;
  onCurrentPageChange?: (pageId: string) => void;
}

export function DocumentCanvas({ content, onContentChange, viewMode, pageSize, paperColor, paperPattern, writingStyle, title, overlayData, overlayStrokes, backgroundArtwork, onOverlayChange, onOverlayStrokesChange, overlayTool, overlayColor, overlayGradientColor, overlayBrushSize, overlayOpacity, overlayEnabled, inlineTools, subpages, toolSections, pageCount, onCurrentPageChange }: DocumentCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState<number>();
  const useContinuousCanvas = viewMode === 'vertical-continuous' || pageCount > 1 || Boolean(toolSections);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || useContinuousCanvas) {
      setFitScale(1);
      return;
    }
    const pageWidth = pageSize === 'letter' ? 850 : 827;
    const pageHeight = pageSize === 'letter' ? 1100 : 1169;
    const paper = container.querySelector<HTMLElement>('[data-work-page-paper]');
    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      const availableWidth = Math.max(280, rect.width - 48);
      const availableHeight = Math.max(320, rect.height - 48);
      setFitScale(Math.min(availableWidth / pageWidth, availableHeight / pageHeight, 1));
      setPaperHeight(paper?.offsetHeight || pageHeight);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    if (paper) observer.observe(paper);
    return () => observer.disconnect();
  }, [pageSize, useContinuousCanvas]);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || !onCurrentPageChange) return;

    let frame = 0;
    const updateCurrentPage = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-work-page-id]'));
        if (!pages.length) return;
        const containerTop = container.getBoundingClientRect().top;
        const focusLine = containerTop + Math.min(160, container.clientHeight * 0.25);
        const current = pageAtReadingLine(pages.map((page) => {
          const { top, bottom } = page.getBoundingClientRect();
          return { page, top, bottom };
        }), focusLine);
        onCurrentPageChange(current?.page.dataset.workPageId || 'main');
      });
    };

    updateCurrentPage();
    container.addEventListener('scroll', updateCurrentPage, { passive: true });
    const observer = new ResizeObserver(updateCurrentPage);
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      container.removeEventListener('scroll', updateCurrentPage);
      observer.disconnect();
    };
  }, [onCurrentPageChange, pageCount, useContinuousCanvas]);

  const containerClasses = cn(
    "w-full min-h-0 flex-1 relative transition-all duration-500 bg-muted/10",
    useContinuousCanvas && "overflow-y-auto overflow-x-hidden",
    !useContinuousCanvas && "overflow-auto"
  );

  const canvasClasses = cn(
    "flex transition-all duration-500",
    useContinuousCanvas && "w-full flex-col items-center gap-10 p-3 sm:p-6 lg:p-8",
    !useContinuousCanvas && "min-h-full flex-col items-center justify-center p-3 sm:p-6"
  );

  const pageWidth = pageSize === 'letter' ? 850 : 827;
  const pageHeight = pageSize === 'letter' ? 1100 : 1169;
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(' ').length : 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className={containerClasses} ref={canvasRef} data-noesis-scroll-region data-work-document-scroll role="region" tabIndex={0} aria-label={`${title || 'Untitled work'} document canvas`} onFocusCapture={event => {
        const page = event.target.closest<HTMLElement>('[data-work-page-id]');
        if (page?.dataset.workPageId) onCurrentPageChange?.(page.dataset.workPageId);
      }}>
        <div className={canvasClasses}>
          {useContinuousCanvas ? (
            <div
              id="work-page-main"
              data-work-page-id="main"
              className={cn(
                "w-full scroll-mt-6",
                pageSize === 'letter' ? "max-w-[850px]" : "max-w-[827px]"
              )}
            >
              <DocsPage
                pageNumber={1}
                pageSize={pageSize}
                paperColor={paperColor}
                paperPattern={paperPattern}
                writingStyle={writingStyle}
                isEditable
                content={content}
                onContentChange={onContentChange}
                showBoundary
                overlayData={overlayData}
                overlayStrokes={overlayStrokes}
                backgroundArtwork={backgroundArtwork}
                onOverlayChange={onOverlayChange}
                onOverlayStrokesChange={onOverlayStrokesChange}
                overlayTool={overlayTool}
                overlayColor={overlayColor}
                overlayGradientColor={overlayGradientColor}
                overlayBrushSize={overlayBrushSize}
                overlayOpacity={overlayOpacity}
                overlayEnabled={overlayEnabled}
                inlineTools={inlineTools}
              />
            </div>
          ) : (
            <div
              id="work-page-main"
              data-work-page-id="main"
              className="relative shrink-0 transition-[width,height] duration-300"
              style={{ width: pageWidth * fitScale, height: Math.max(paperHeight || 0, pageHeight) * fitScale }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left transition-transform duration-300"
                style={{ width: pageWidth, minHeight: pageHeight, transform: `scale(${fitScale})` }}
              >
                <DocsPage
                  pageNumber={1}
                  pageSize={pageSize}
                  paperColor={paperColor}
                  paperPattern={paperPattern}
                  writingStyle={writingStyle}
                  isEditable={true}
                  content={content}
                  onContentChange={onContentChange}
                  showBoundary
                  overlayData={overlayData}
                  overlayStrokes={overlayStrokes}
                  backgroundArtwork={backgroundArtwork}
                  onOverlayChange={onOverlayChange}
                  onOverlayStrokesChange={onOverlayStrokesChange}
                  overlayTool={overlayTool}
                  overlayColor={overlayColor}
                  overlayGradientColor={overlayGradientColor}
                  overlayBrushSize={overlayBrushSize}
                  overlayOpacity={overlayOpacity}
                  overlayEnabled={overlayEnabled}
                  inlineTools={inlineTools}
                />
              </div>
            </div>
          )}
          {subpages && <div className="w-full max-w-[850px] space-y-10" aria-label="Document subpages">{subpages}</div>}
          {toolSections && <div className="w-full max-w-[850px] pb-12" aria-label="Document tool sections">{toolSections}</div>}
        </div>
      </div>
      
      <div className="flex h-7 shrink-0 items-center justify-end gap-3 overflow-hidden border-t border-border/30 bg-background/90 px-3 noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground sm:gap-4 sm:px-4">
        <span className="hidden sm:inline">Document</span>
        <span>{wordCount} words</span>
        <span className="hidden sm:inline">{plainText.length} characters</span>
        <span>{Math.max(1, Math.ceil(wordCount / 225))} min read</span>
        {!useContinuousCanvas && <span>{Math.round(fitScale * 100)}% fit</span>}
      </div>
    </div>
  );
}
