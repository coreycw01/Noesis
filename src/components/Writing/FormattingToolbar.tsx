"use client";

import React, { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChartColumn,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Mic,
  Palette,
  Pilcrow,
  RotateCcw,
  RotateCw,
  Smile,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  saveStatus?: string;
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function FormattingToolbar({ saveStatus }: FormattingToolbarProps) {
  const { toast } = useToast();
  const [textColor, setTextColor] = useState('#31241d');
  const [highlightColor, setHighlightColor] = useState('#fef3c7');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
  };

  const insertHtml = (html: string) => {
    document.execCommand('insertHTML', false, html);
  };

  const applyLineSpacing = (value: string) => {
    insertHtml(`<div style="line-height:${value};"><br></div>`);
  };

  const insertImage = () => {
    const url = window.prompt('Paste an image URL to insert inline:');
    if (!url?.trim()) return;
    insertHtml(`<img src="${url.trim()}" alt="" style="max-width:100%; border-radius:12px; margin:16px 0;" />`);
  };

  const insertIcon = () => {
    const symbol = window.prompt('Insert a symbol or icon:', '✦');
    if (!symbol) return;
    insertHtml(`<span style="font-size:1.35em; display:inline-block; padding:0 0.2em;">${symbol}</span>`);
  };

  const insertChart = () => {
    const raw = window.prompt('Chart values as Label:Value, Label:Value', 'Support:5, Challenge:2, Unknown:3');
    if (!raw) return;
    const rows = raw.split(',').map((part) => {
      const [label, value] = part.split(':');
      return { label: label?.trim() || 'Item', value: Math.max(0, Number(value) || 0) };
    });
    const max = Math.max(1, ...rows.map((row) => row.value));
    insertHtml(`
      <div contenteditable="false" style="border:1px solid #e7dfd5; border-radius:14px; padding:16px; margin:18px 0; background:#fff;">
        ${rows.map((row) => `
          <div style="display:grid; grid-template-columns:110px 1fr 40px; gap:10px; align-items:center; margin:8px 0; font-size:13px;">
            <strong>${row.label}</strong>
            <span style="height:10px; border-radius:999px; background:linear-gradient(90deg, #6d28d9 ${(row.value / max) * 100}%, #eee8df ${(row.value / max) * 100}%);"></span>
            <span>${row.value}</span>
          </div>
        `).join('')}
      </div><p><br></p>
    `);
  };

  const toggleTalkToText = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition as SpeechRecognitionCtor | undefined;
    if (!Recognition) {
      toast({
        variant: 'destructive',
        title: 'Talk to Text unavailable',
        description: 'This browser does not support speech recognition. You can still type or record audio in Works.',
      });
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result: any) => result[0]?.transcript || '')
        .join(' ');
      if (text.trim()) insertHtml(`${text.trim()} `);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center border-b border-border/30 bg-background/95 backdrop-blur py-2 px-8">
      <div className="flex items-center gap-1 p-1.5 rounded-full border border-border/60 bg-white shadow-sm overflow-x-auto max-w-full">
        <div className="flex items-center px-3 border-r border-border/40 gap-1">
          <ToolbarButton icon={RotateCcw} onClick={() => applyFormat('undo')} title="Undo" />
          <ToolbarButton icon={RotateCw} onClick={() => applyFormat('redo')} title="Redo" />
        </div>

        <div className="flex items-center px-3 border-r border-border/40 gap-2">
          <Type className="size-3.5 text-muted-foreground" />
          <select defaultValue="P" onChange={(event) => applyFormat('formatBlock', event.target.value)} className="bg-transparent text-[11px] font-body italic text-primary/80 outline-none" title="Paragraph style">
            <option value="P">Paragraph</option>
            <option value="H1">Heading 1</option>
            <option value="H2">Heading 2</option>
            <option value="H3">Heading 3</option>
            <option value="BLOCKQUOTE">Quote</option>
          </select>
        </div>

        <div className="flex items-center px-3 border-r border-border/40 gap-2">
          <Pilcrow className="size-3.5 text-muted-foreground" />
          <select defaultValue="normal" onChange={(event) => applyLineSpacing(event.target.value)} className="bg-transparent text-[11px] font-code font-bold text-primary/80 outline-none" title="Line spacing">
            <option value="1.2">Single</option>
            <option value="1.6">1.5</option>
            <option value="2">Double</option>
            <option value="2.4">Custom</option>
          </select>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-border/40">
          <ToolbarButton icon={Bold} onClick={() => applyFormat('bold')} title="Bold" />
          <ToolbarButton icon={Italic} onClick={() => applyFormat('italic')} title="Italic" />
          <ToolbarButton icon={Underline} onClick={() => applyFormat('underline')} title="Underline" />
          <ToolbarButton icon={Strikethrough} onClick={() => applyFormat('strikeThrough')} title="Strikethrough" />
        </div>

        <div className="flex items-center gap-2 px-2 border-r border-border/40">
          <ColorButton icon={Palette} value={textColor} onChange={(value) => { setTextColor(value); applyFormat('foreColor', value); }} title="Text color" />
          <ColorButton icon={Highlighter} value={highlightColor} onChange={(value) => { setHighlightColor(value); applyFormat('hiliteColor', value); applyFormat('backColor', value); }} title="Highlight color" />
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-border/40">
          <ToolbarButton icon={AlignLeft} onClick={() => applyFormat('justifyLeft')} active />
          <ToolbarButton icon={AlignCenter} onClick={() => applyFormat('justifyCenter')} />
          <ToolbarButton icon={AlignRight} onClick={() => applyFormat('justifyRight')} />
          <ToolbarButton icon={AlignJustify} onClick={() => applyFormat('justifyFull')} />
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-border/40">
          <ToolbarButton icon={List} onClick={() => applyFormat('insertUnorderedList')} />
          <ToolbarButton icon={ListOrdered} onClick={() => applyFormat('insertOrderedList')} />
          <ToolbarButton icon={IndentDecrease} onClick={() => applyFormat('outdent')} title="Outdent" />
          <ToolbarButton icon={IndentIncrease} onClick={() => applyFormat('indent')} title="Indent" />
        </div>

        <div className="flex items-center gap-0.5 px-2">
          <ToolbarButton icon={ImagePlus} onClick={insertImage} title="Insert image" />
          <ToolbarButton icon={Smile} onClick={insertIcon} title="Insert icon" />
          <ToolbarButton icon={ChartColumn} onClick={insertChart} title="Insert chart" />
          <ToolbarButton icon={Mic} onClick={toggleTalkToText} active={listening} title="Talk to Text" />
        </div>
      </div>
    </div>
  );
}

function ColorButton({ icon: Icon, value, onChange, title }: { icon: any; value: string; onChange: (value: string) => void; title: string }) {
  return (
    <label title={title} className="size-8 rounded-full flex items-center justify-center transition-all hover:bg-muted text-muted-foreground cursor-pointer relative">
      <Icon className="size-3.5" />
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

function ToolbarButton({ icon: Icon, onClick, active, title }: { icon: any, onClick?: () => void, active?: boolean, title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      title={title}
      className={cn(
        "size-8 rounded-full flex items-center justify-center transition-all hover:bg-muted",
        active ? "bg-accent/10 text-accent" : "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
