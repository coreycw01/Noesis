
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { DocsPage } from './DocsPage';
import { PageNavigation } from './PageNavigation';
import type { PageViewMode, PageSize, PaperColor, PaperPattern } from './Atelier';
import type { WritingStyle } from '@/lib/types';
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
  onOverlayChange: (content: string) => void;
  overlayTool: 'text' | 'pencil' | 'eraser';
  overlayColor: string;
  overlayBrushSize: number;
}

export function DocumentCanvas({ content, onContentChange, viewMode, pageSize, paperColor, paperPattern, writingStyle, title, overlayData, onOverlayChange, overlayTool, overlayColor, overlayBrushSize }: DocumentCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  
  useEffect(() => {
    const charCount = content.length;
    const estimatedPages = Math.max(1, Math.ceil(charCount / 3000));
    setTotalPages(estimatedPages);
  }, [content]);

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewMode === 'vertical-continuous' || viewMode === 'vertical-single') {
      const scrollPos = e.currentTarget.scrollTop;
      const pageHeight = pageSize === 'letter' ? 1056 : 1123;
      const page = Math.floor(scrollPos / (pageHeight + 40)) + 1;
      setCurrentPage(Math.min(page, totalPages));
    }
  };

  const containerClasses = cn(
    "w-full min-h-0 flex-1 relative transition-all duration-500 bg-muted/10",
    viewMode === 'vertical-continuous' && "overflow-y-auto overflow-x-hidden",
    viewMode === 'vertical-single' && "overflow-hidden",
    viewMode === 'horizontal-single' && "overflow-x-auto overflow-y-hidden"
  );

  const canvasClasses = cn(
    "flex transition-all duration-500",
    viewMode === 'vertical-continuous' && "p-12",
    viewMode === 'vertical-continuous' && "flex-col items-center gap-10",
    viewMode === 'vertical-single' && "h-full flex-col items-center justify-center",
    viewMode === 'horizontal-single' && "h-full flex-row items-center justify-center min-w-full"
  );

  const pageWidth = pageSize === 'letter' ? 850 : 827;
  const pageHeight = pageSize === 'letter' ? 1100 : 1169;
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(' ').length : 0;

  return (
    <div className="flex min-h-0 h-full w-full flex-col">
      <div className={containerClasses} onScroll={handleScroll} ref={canvasRef}>
        <div className={canvasClasses}>
          {viewMode === 'vertical-continuous' ? (
            Array.from({ length: totalPages }).map((_, i) => (
              <DocsPage 
                key={i}
                pageNumber={i + 1}
                pageSize={pageSize}
                paperColor={paperColor}
                paperPattern={paperPattern}
                writingStyle={writingStyle}
                isEditable={i === 0}
                content={i === 0 ? content : ""}
                onContentChange={onContentChange}
                showBoundary
                overlayData={i === 0 ? overlayData : ''}
                onOverlayChange={onOverlayChange}
                overlayTool={overlayTool}
                overlayColor={overlayColor}
                overlayBrushSize={overlayBrushSize}
              />
            ))
          ) : (
            <div
              className="relative shrink-0 transition-[width,height] duration-300"
              style={{ width: pageWidth * fitScale, height: pageHeight * fitScale }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left transition-transform duration-300"
                style={{ transform: `scale(${fitScale})` }}
              >
                <DocsPage
                  pageNumber={currentPage}
                  pageSize={pageSize}
                  paperColor={paperColor}
                  paperPattern={paperPattern}
                  writingStyle={writingStyle}
                  isEditable={true}
                  content={content}
                  onContentChange={onContentChange}
                  showBoundary
                  overlayData={overlayData}
                  onOverlayChange={onOverlayChange}
                  overlayTool={overlayTool}
                  overlayColor={overlayColor}
                  overlayBrushSize={overlayBrushSize}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <PageNavigation 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={(p) => {
          setCurrentPage(p);
        }}
      />
      <div className="flex h-7 shrink-0 items-center justify-end gap-4 border-t border-border/30 bg-background/90 px-4 font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>{wordCount} words</span>
        <span>{plainText.length} characters</span>
        <span>{Math.max(1, Math.ceil(wordCount / 225))} min read</span>
        {viewMode !== 'vertical-continuous' && <span>{Math.round(fitScale * 100)}% fit</span>}
      </div>
    </div>
  );
}
