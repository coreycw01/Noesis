"use client";

import React, { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChartColumn,
  CircleDotDashed,
  CaseUpper,
  Code2,
  FileSearch,
  GitBranch,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Link,
  Mic,
  MoreHorizontal,
  Palette,
  PencilLine,
  Pilcrow,
  RotateCcw,
  RotateCw,
  Replace,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Upload,
  Workflow,
  Type,
  Underline,
  Unlink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { escapeTextAsHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { WorkToolKind } from '@/lib/types';

interface FormattingToolbarProps {
  saveStatus?: string;
  onOpenDrawing?: () => void;
  onInsertTool?: (tool: WorkToolKind) => void;
  onUploadImage?: (file: File) => Promise<string>;
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

type UtilityDialog = 'image' | 'link' | 'find' | 'replace' | null;

export function FormattingToolbar({ saveStatus, onOpenDrawing, onInsertTool, onUploadImage }: FormattingToolbarProps) {
  const { toast } = useToast();
  const [textColor, setTextColor] = useState('#31241d');
  const [highlightColor, setHighlightColor] = useState('#fef3c7');
  const [listening, setListening] = useState(false);
  const [utilityDialog, setUtilityDialog] = useState<UtilityDialog>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [findQuery, setFindQuery] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const recognitionRef = useRef<any>(null);
  const selectionRef = useRef<Range | null>(null);
  const findCursorRef = useRef(0);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (container?.closest('[contenteditable="true"]')) selectionRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const range = selectionRef.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const applyFormat = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    rememberSelection();
  };

  const insertHtml = (html: string) => {
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!editor) return;
    restoreSelection();
    const before = editor.innerHTML;
    const insertedAtSelection = document.execCommand('insertHTML', false, html);
    // Opening a modal can legitimately clear a browser selection. In that case
    // append to the document rather than silently dropping the requested insert.
    if (!insertedAtSelection || editor.innerHTML === before) {
      editor.insertAdjacentHTML('beforeend', html);
    }
    // execCommand is inconsistent about emitting an input event for complex
    // inserts. Dispatch one so inline tables, images, and graphs enter the
    // normal document save pipeline immediately.
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText' }),
    );
    rememberSelection();
  };

  const applyLineSpacing = (value: string) => {
    restoreSelection();
    const selection = window.getSelection();
    const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
    const block = anchor?.closest('p, div, blockquote, li, h1, h2, h3') as HTMLElement | null;
    if (block?.closest('[contenteditable="true"]')) block.style.lineHeight = value;
  };

  const insertDivider = () => insertHtml('<hr style="border:0;border-top:1px solid currentColor;opacity:.25;margin:24px 0;"><p><br></p>');

  const replaceInDocument = (query: string, replacement: string) => {
    if (!query.trim()) return;
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!editor) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const matches: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.data.includes(query)) matches.push(node);
    }
    matches.forEach((node) => {
      node.data = node.data.split(query).join(replacement);
    });
    if (matches.length) {
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
      toast({ title: 'Text replaced', description: `${matches.length} text block${matches.length === 1 ? '' : 's'} updated.` });
    } else {
      toast({ title: 'No matches found', description: `“${query}” does not appear in this work.` });
    }
  };

  const findInDocument = (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!normalizedQuery || !editor) return false;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const matches: Array<{ node: Text; index: number }> = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const haystack = node.data.toLocaleLowerCase();
      let index = haystack.indexOf(normalizedQuery);
      while (index >= 0) {
        matches.push({ node, index });
        index = haystack.indexOf(normalizedQuery, index + normalizedQuery.length);
      }
    }
    if (!matches.length) {
      toast({ title: 'No matches found', description: `“${query.trim()}” does not appear in this work.` });
      findCursorRef.current = 0;
      return false;
    }
    const matchIndex = findCursorRef.current % matches.length;
    const match = matches[matchIndex];
    const range = document.createRange();
    range.setStart(match.node, match.index);
    range.setEnd(match.node, match.index + query.trim().length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    match.node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    findCursorRef.current = matchIndex + 1;
    toast({ title: `Match ${matchIndex + 1} of ${matches.length}` });
    return true;
  };

  const openUtilityDialog = (dialog: Exclude<UtilityDialog, null>) => {
    rememberSelection();
    setUtilityDialog(dialog);
  };

  const validExternalUrl = (value: string) => {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  };

  const runUtilityDialog = async () => {
    if (utilityDialog === 'image') {
      if (!imageFile || !onUploadImage) {
        toast({ title: 'Choose an image', description: 'Select an image from this device first.', variant: 'destructive' });
        return;
      }
      try {
        setUploadingImage(true);
        const url = await onUploadImage(imageFile);
        insertHtml(`<figure contenteditable="false" data-noesis-image="uploaded"><img src="${escapeTextAsHtml(url)}" alt="${escapeTextAsHtml(imageAlt)}" style="display:block;max-width:100%;height:auto;margin:0 auto;" />${imageAlt.trim() ? `<figcaption>${escapeTextAsHtml(imageAlt.trim())}</figcaption>` : ''}</figure><p><br></p>`);
        setImageFile(null);
        setImageAlt('');
      } catch (error) {
        toast({ title: 'Image could not be added', description: error instanceof Error ? error.message : 'Try another image.', variant: 'destructive' });
        return;
      } finally {
        setUploadingImage(false);
      }
    }
    if (utilityDialog === 'link') {
      const url = validExternalUrl(linkUrl);
      if (!url) {
        toast({ title: 'Use a web link', description: 'Links must use an http or https address.', variant: 'destructive' });
        return;
      }
      applyFormat('createLink', url);
    }
    if (utilityDialog === 'find' && findQuery.trim()) findInDocument(findQuery);
    if (utilityDialog === 'replace') replaceInDocument(findQuery, replacementText);
    setUtilityDialog(null);
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
    <>
    <div className="sticky top-0 z-40 h-[60px] shrink-0 overflow-hidden border-b border-border/30 bg-background/95 px-3 py-2 backdrop-blur sm:h-[101px] sm:px-6">
      <div className="flex flex-nowrap items-center justify-start gap-1 rounded-[var(--card-radius)] border border-border/60 bg-card p-1.5 shadow-sm sm:flex-wrap sm:justify-center sm:gap-1.5">
        <div className="flex items-center gap-1 border-r border-border/40 pr-2">
          {onOpenDrawing && <ToolbarButton icon={PencilLine} onClick={onOpenDrawing} title="Open drawing tools" />}
          <ToolbarButton icon={RotateCcw} onClick={() => applyFormat('undo')} title="Undo" />
          <ToolbarButton icon={RotateCw} onClick={() => applyFormat('redo')} title="Redo" />
        </div>

        <div className="hidden items-center gap-2 border-r border-border/40 pr-2 sm:flex">
          <Type className="size-3.5 text-muted-foreground" />
          <select aria-label="Paragraph style" defaultValue="P" onPointerDown={rememberSelection} onChange={(event) => applyFormat('formatBlock', event.target.value)} className="bg-card text-[11px] font-body italic text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground" title="Paragraph style">
            <option value="P">Paragraph</option>
            <option value="H1">Heading 1</option>
            <option value="H2">Heading 2</option>
            <option value="H3">Heading 3</option>
            <option value="BLOCKQUOTE">Quote</option>
          </select>
        </div>

        <div className="hidden items-center gap-2 border-r border-border/40 pr-2 sm:flex">
          <select aria-label="Font family" defaultValue="Georgia" onPointerDown={rememberSelection} onChange={(event) => applyFormat('fontName', event.target.value)} className="max-w-32 bg-card text-[11px] text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground" title="Font family">
            <optgroup label="Serif">
              <option value="Georgia">Georgia</option>
              <option value="Garamond">Garamond</option>
              <option value="Baskerville">Baskerville</option>
              <option value="Palatino Linotype">Palatino</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Book Antiqua">Book Antiqua</option>
            </optgroup>
            <optgroup label="Sans serif">
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Aptos">Aptos</option>
              <option value="Calibri">Calibri</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet</option>
              <option value="Tahoma">Tahoma</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="Courier New">Courier New</option>
              <option value="Consolas">Consolas</option>
              <option value="Lucida Console">Lucida Console</option>
            </optgroup>
          </select>
          <select aria-label="Font size" defaultValue="3" onPointerDown={rememberSelection} onChange={(event) => applyFormat('fontSize', event.target.value)} className="bg-card text-[11px] text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground" title="Font size">
            <option value="2">Small</option>
            <option value="3">Body</option>
            <option value="4">Large</option>
            <option value="5">Display</option>
          </select>
        </div>

        <div className="flex items-center gap-0.5 border-r border-border/40 pr-2">
          <ToolbarButton icon={Bold} onClick={() => applyFormat('bold')} title="Bold" />
          <ToolbarButton icon={Italic} onClick={() => applyFormat('italic')} title="Italic" />
          <ToolbarButton icon={Underline} onClick={() => applyFormat('underline')} title="Underline" />
          <div className="hidden sm:contents"><ColorButton icon={Palette} value={textColor} onChange={(value) => { setTextColor(value); applyFormat('foreColor', value); }} title="Text color" /></div>
          <div className="hidden sm:contents"><ColorButton icon={Highlighter} value={highlightColor} onChange={(value) => { setHighlightColor(value); applyFormat('hiliteColor', value); applyFormat('backColor', value); }} title="Highlight color" /></div>
        </div>

        <div className="hidden items-center gap-0.5 border-r border-border/40 pr-2 sm:flex">
          <ToolbarButton icon={AlignLeft} onClick={() => applyFormat('justifyLeft')} active title="Align left" />
          <ToolbarButton icon={AlignCenter} onClick={() => applyFormat('justifyCenter')} title="Align center" />
          <ToolbarButton icon={AlignRight} onClick={() => applyFormat('justifyRight')} title="Align right" />
        </div>

        <div className="flex items-center gap-0.5 border-r border-border/40 pr-2">
          <div className="hidden sm:block"><ToolbarButton icon={Link} onClick={() => openUtilityDialog('link')} title="Add link" /></div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={rememberSelection}>
              <Button type="button" variant="ghost" size="sm" className="size-8 rounded-md p-0 font-code text-[9px] font-bold uppercase tracking-wider sm:h-8 sm:w-auto sm:px-2" aria-label="Format text"><Pilcrow className="size-4 sm:hidden" /><span className="hidden sm:inline">Format</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border-border bg-popover text-popover-foreground">
              <DropdownMenuLabel>Text and spacing</DropdownMenuLabel>
              <div className="space-y-2 px-2 pb-2 sm:hidden" onPointerDown={rememberSelection}>
                <select aria-label="Paragraph style" defaultValue="P" onChange={(event) => applyFormat('formatBlock', event.target.value)} className="h-8 w-full rounded-md border border-border/60 bg-card px-2 text-xs text-foreground"><option value="P">Paragraph</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option><option value="BLOCKQUOTE">Quote</option></select>
                <div className="grid grid-cols-2 gap-2"><select aria-label="Font family" defaultValue="Georgia" onChange={(event) => applyFormat('fontName', event.target.value)} className="h-8 rounded-md border border-border/60 bg-card px-2 text-xs text-foreground"><option value="Georgia">Georgia</option><option value="Garamond">Garamond</option><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Consolas">Consolas</option></select><select aria-label="Font size" defaultValue="3" onChange={(event) => applyFormat('fontSize', event.target.value)} className="h-8 rounded-md border border-border/60 bg-card px-2 text-xs text-foreground"><option value="2">Small</option><option value="3">Body</option><option value="4">Large</option><option value="5">Display</option></select></div>
                <div className="flex items-center gap-3"><ColorButton icon={Palette} value={textColor} onChange={(value) => { setTextColor(value); applyFormat('foreColor', value); }} title="Text color" /><ColorButton icon={Highlighter} value={highlightColor} onChange={(value) => { setHighlightColor(value); applyFormat('hiliteColor', value); applyFormat('backColor', value); }} title="Highlight color" /></div>
              </div>
              <DropdownMenuItem onSelect={() => applyFormat('strikeThrough')}><Strikethrough className="mr-2 size-4" /> Strikethrough</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('superscript')}><Superscript className="mr-2 size-4" /> Superscript</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('subscript')}><Subscript className="mr-2 size-4" /> Subscript</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('formatBlock', 'PRE')}><Code2 className="mr-2 size-4" /> Code block</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('removeFormat')}><CaseUpper className="mr-2 size-4" /> Clear formatting</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Line spacing</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <select aria-label="Line spacing" defaultValue="1.6" onChange={(event) => applyLineSpacing(event.target.value)} className="h-8 w-full rounded-md border border-border/60 bg-card px-2 text-xs text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground">
                  <option value="1.2">Single</option>
                  <option value="1.6">1.5</option>
                  <option value="2">Double</option>
                  <option value="2.4">Custom</option>
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={rememberSelection}>
              <Button type="button" variant="outline" size="sm" className="size-8 rounded-md border-border/60 p-0 font-code text-[9px] font-bold uppercase tracking-wider sm:h-8 sm:w-auto sm:px-2.5" aria-label="Insert visual or media"><ImagePlus className="size-4 sm:hidden" /><span className="hidden sm:inline">Insert</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground">
              <DropdownMenuItem className="sm:hidden" onSelect={() => openUtilityDialog('link')}><Link className="mr-2 size-4" /> Add link</DropdownMenuItem>
              <DropdownMenuLabel>Media</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openUtilityDialog('image')}><ImagePlus className="mr-2 size-4" /> Upload image</DropdownMenuItem>
              {onInsertTool && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Visuals</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => onInsertTool('bar_chart')}><ChartColumn className="mr-2 size-4" /> Bar chart</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInsertTool('visual_table')}><Table2 className="mr-2 size-4" /> Visual table</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Thinking tools</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => onInsertTool('mind_map')}><GitBranch className="mr-2 size-4" /> Mind map</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInsertTool('timeline')}><Workflow className="mr-2 size-4" /> Timeline</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInsertTool('venn_diagram')}><CircleDotDashed className="mr-2 size-4" /> Venn diagram</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInsertTool('comparison_matrix')}><Table2 className="mr-2 size-4" /> Comparison matrix</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onInsertTool('causal_chain')}><Workflow className="mr-2 size-4" /> Causal chain</DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onSelect={insertDivider}><Pilcrow className="mr-2 size-4" /> Divider</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={rememberSelection}>
              <Button type="button" variant="ghost" size="sm" className="size-8 rounded-md p-0 font-code text-[9px] font-bold uppercase tracking-wider sm:h-8 sm:w-auto sm:px-2" aria-label="More editing actions"><MoreHorizontal className="size-4 sm:hidden" /><span className="hidden sm:inline">Edit</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground">
              <DropdownMenuItem onSelect={() => applyFormat('unlink')}><Unlink className="mr-2 size-4" /> Remove link</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('justifyFull')}><AlignJustify className="mr-2 size-4" /> Justify text</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('insertUnorderedList')}><List className="mr-2 size-4" /> Bulleted list</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('insertOrderedList')}><ListOrdered className="mr-2 size-4" /> Numbered list</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('outdent')}><IndentDecrease className="mr-2 size-4" /> Outdent</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => applyFormat('indent')}><IndentIncrease className="mr-2 size-4" /> Indent</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openUtilityDialog('find')}><FileSearch className="mr-2 size-4" /> Find</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openUtilityDialog('replace')}><Replace className="mr-2 size-4" /> Find and replace</DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleTalkToText}><Mic className="mr-2 size-4" /> {listening ? 'Stop talk to text' : 'Talk to text'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
      <Dialog open={utilityDialog !== null} onOpenChange={(open) => !open && setUtilityDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{utilityDialog === 'image' ? 'Insert image' : utilityDialog === 'link' ? 'Add link' : utilityDialog === 'replace' ? 'Find and replace' : 'Find in document'}</DialogTitle>
            <DialogDescription>{utilityDialog === 'image' ? 'Choose an image from this device. It will be stored with this work and placed in the document.' : utilityDialog === 'link' ? 'Select text first, then enter the web address to link it.' : utilityDialog === 'replace' ? 'Replace matching text throughout this document.' : 'Find the next matching phrase in this document.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {utilityDialog === 'image' && <div className="space-y-3"><div className="space-y-2"><Label htmlFor="image-file">Image file</Label><label htmlFor="image-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"><Upload className="size-5" /><span>{imageFile ? imageFile.name : 'Choose PNG, JPEG, WebP, or GIF'}</span></label><Input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="sr-only" /></div><div className="space-y-2"><Label htmlFor="image-alt">Caption and description</Label><Input id="image-alt" value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="Describe the image" /></div></div>}
            {utilityDialog === 'link' && <div className="space-y-2"><Label htmlFor="link-url">Link URL</Label><Input id="link-url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" autoFocus /></div>}
            {(utilityDialog === 'find' || utilityDialog === 'replace') && <div className="space-y-2"><Label htmlFor="find-query">Find</Label><Input id="find-query" value={findQuery} onChange={(event) => setFindQuery(event.target.value)} placeholder="Text to find" autoFocus /></div>}
            {utilityDialog === 'replace' && <div className="space-y-2"><Label htmlFor="replacement-text">Replace with</Label><Input id="replacement-text" value={replacementText} onChange={(event) => setReplacementText(event.target.value)} placeholder="Replacement text" /></div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUtilityDialog(null)}>Cancel</Button>
            <Button type="button" onClick={() => void runUtilityDialog()} disabled={uploadingImage}>{utilityDialog === 'replace' ? 'Replace all' : utilityDialog === 'find' ? 'Find next' : utilityDialog === 'image' ? uploadingImage ? 'Uploading…' : 'Insert image' : 'Add link'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ColorButton({ icon: Icon, value, onChange, title }: { icon: any; value: string; onChange: (value: string) => void; title: string }) {
  return (
    <label title={title} className="size-8 rounded-full flex items-center justify-center transition-all hover:bg-muted text-muted-foreground cursor-pointer relative">
      <Icon className="size-3.5" />
      <input
        aria-label={title}
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
      aria-label={title || 'Formatting action'}
      className={cn(
        "size-8 rounded-full flex items-center justify-center transition-all hover:bg-muted",
        active ? "bg-accent/10 text-accent" : "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
