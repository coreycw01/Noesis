
"use client";

import React, { type ReactNode, useRef, useState, useEffect } from 'react';
import { DocsPage } from './DocsPage';
import type { PageViewMode, PageSize, PaperColor, PaperPattern } from './Atelier';
import type { DrawingTool, WritingStyle } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  backgroundArtwork?: string;
  onOverlayChange: (content: string) => void;
  overlayTool: DrawingTool;
  overlayColor: string;
  overlayBrushSize: number;
  overlayOpacity: number;
  overlayEnabled: boolean;
  inlineTools?: ReactNode;
  subpages?: ReactNode;
  toolSections?: ReactNode;
  onCurrentPageChange?: (pageId: string) => void;
}

export function DocumentCanvas({ content, onContentChange, viewMode, pageSize, paperColor, paperPattern, writingStyle, title, overlayData, backgroundArtwork, onOverlayChange, overlayTool, overlayColor, overlayBrushSize, overlayOpacity, overlayEnabled, inlineTools, subpages, toolSections, onCurrentPageChange }: DocumentCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || viewMode === 'vertical-continuous') {
      setFitScale(1);
      return;
    }
    const pageWidth = pageSize === 'letter' ? 850 : 827;
    const pageHeight = pageSize === 'letter' ? 1100 : 1169;
    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      const availableWidth = Math.max(280, rect.width - 48);
      const availableHeight = Math.max(320, rect.height - 48);
      setFitScale(Math.min(availableWidth / pageWidth, availableHeight / pageHeight, 1));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [pageSize, viewMode]);

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
        const current = pages.reduce((closest, page) => {
          const distance = Math.abs(page.getBoundingClientRect().top - focusLine);
          return distance < closest.distance ? { page, distance } : closest;
        }, { page: pages[0], distance: Number.POSITIVE_INFINITY });
        onCurrentPageChange(current.page.dataset.workPageId || 'main');
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
  }, [onCurrentPageChange, subpages, toolSections]);

  const hasAdditionalPages = Boolean(subpages || toolSections);
  const useContinuousCanvas = viewMode === 'vertical-continuous' || hasAdditionalPages;
  const containerClasses = cn(
    "w-full min-h-0 flex-1 relative transition-all duration-500 bg-muted/10",
    useContinuousCanvas && "overflow-y-auto overflow-x-hidden",
    !useContinuousCanvas && viewMode === 'vertical-single' && "overflow-hidden",
    !useContinuousCanvas && viewMode === 'horizontal-single' && "overflow-x-auto overflow-y-hidden"
  );

  const canvasClasses = cn(
    "flex transition-all duration-500",
    useContinuousCanvas && "w-full flex-col items-center gap-10 p-3 sm:p-6 lg:p-8",
    !useContinuousCanvas && viewMode === 'vertical-single' && "h-full flex-col items-center justify-center",
    !useContinuousCanvas && viewMode === 'horizontal-single' && "h-full flex-row items-center justify-center min-w-full"
  );

  const pageWidth = pageSize === 'letter' ? 850 : 827;
  const pageHeight = pageSize === 'letter' ? 1100 : 1169;
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(' ').length : 0;

  return (
    <div className="flex min-h-0 h-full w-full flex-col">
      <div className={containerClasses} ref={canvasRef} aria-label={`${title || 'Untitled work'} document canvas`}>
        <div className={canvasClasses}>
          {useContinuousCanvas ? (
            <div id="work-page-main" data-work-page-id="main" className="scroll-mt-6">
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
                backgroundArtwork={backgroundArtwork}
                onOverlayChange={onOverlayChange}
                overlayTool={overlayTool}
                overlayColor={overlayColor}
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
              style={{ width: pageWidth * fitScale, height: pageHeight * fitScale }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left transition-transform duration-300"
                style={{ transform: `scale(${fitScale})` }}
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
                  backgroundArtwork={backgroundArtwork}
                  onOverlayChange={onOverlayChange}
                  overlayTool={overlayTool}
                  overlayColor={overlayColor}
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
      
      <div className="flex h-7 shrink-0 items-center justify-end gap-4 border-t border-border/30 bg-background/90 px-4 font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>Document</span>
        <span>{wordCount} words</span>
        <span>{plainText.length} characters</span>
        <span>{Math.max(1, Math.ceil(wordCount / 225))} min read</span>
        {viewMode !== 'vertical-continuous' && <span>{Math.round(fitScale * 100)}% fit</span>}
      </div>
    </div>
  );
}
