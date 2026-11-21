'use client';

import { useEffect, useRef, useState } from 'react';
import { initializeFirebase } from '@/firebase';
import { uploadPrivateAsset, privateAssetBlob, deletePrivateAsset, validateAssetBlob } from '@/lib/storage-assets';
import type { StoredAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { MARKUP_OCR_AI_LIMIT } from '@/lib/markup-ocr';

export function SourcePagePhotos({ sourceId, photos, allowSave, allowAiCleanup, onSave, onText }: {
  sourceId: string; photos: StoredAsset[]; allowSave: boolean; allowAiCleanup: boolean;
  onSave: (photo: StoredAsset) => Promise<boolean>; onText: (text: string) => void;
}) {
  const [file, setFile] = useState<File>();
  const [savedPhoto, setSavedPhoto] = useState(false);
  const [name, setName] = useState('');
  const [extracted, setExtracted] = useState('');
  const [cleaned, setCleaned] = useState('');
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const worker = useRef<import('tesseract.js').Worker | null>(null);
  const cleanupRequest = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; cleanupRequest.current?.abort(); void worker.current?.terminate(); worker.current = null; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function run(action: () => Promise<void>, failure = 'Could not finish. Check the image or connection and try again.') {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try { await action(); } catch { if (active.current) setMessage(failure); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function savePhoto(photo: File) {
    const uid = initializeFirebase().auth.currentUser?.uid;
    if (!uid) { setMessage('Sign in to save photos to this source.'); return; }
    let uploaded: StoredAsset;
    try {
      const asset = await uploadPrivateAsset({ uid, area: 'sourcePhotos', entityId: sourceId, blob: photo, originalName: name.trim() || photo.name });
      uploaded = { storagePath: asset.storagePath, contentType: asset.contentType, size: asset.size, originalName: name.trim() || photo.name, createdAt: asset.createdAt };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (active.current) setMessage(code === 'storage/unauthorized'
        ? 'Photo upload was denied by Firebase Storage. Check that this account can save to the source.'
        : 'Photo could not be uploaded. Check your connection or Storage setup and try again.');
      return;
    }
    let attached = false;
    try {
      if (active.current) attached = await onSave(uploaded);
    } finally {
      if (!attached) await deletePrivateAsset(uploaded.storagePath).catch(() => {});
    }
    if (active.current && attached) {
      setSavedPhoto(true);
      if (input.current) input.current.value = '';
      setMessage('Photo saved to this source.');
    } else if (active.current) {
      setMessage('Photo could not be attached to this source. Select it again or retry.');
    }
  }

  async function cleanExtraction() {
    const controller = new AbortController();
    cleanupRequest.current = controller;
    try {
      const response = await authenticatedFetch('/api/markup-cleanup', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: extracted }), signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('No cleanup returned');
      if (active.current) {
        setCleaned(result.text);
        setMessage('Compare the AI cleanup against the original before adding it.');
      }
    } finally {
      if (cleanupRequest.current === controller) cleanupRequest.current = null;
    }
  }

  return <details className="border-y border-border py-3"><summary className="cursor-pointer font-medium">Page photos{photos.length ? ' · ' + photos.length : ''}</summary>
    <div className="mt-3 grid gap-3">
      <input ref={input} type="file" aria-label="Choose a book page photo" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const chosen = e.target.files?.[0]; setMessage(''); setFile(undefined); setSavedPhoto(false); setPreview(''); setName(''); setExtracted(''); setCleaned('');
        if (!chosen) return;
        try { validateAssetBlob(chosen); setFile(chosen); setPreview(URL.createObjectURL(chosen)); } catch { setMessage('Choose a JPG, PNG or WebP image under 10 MB.'); }
      }} />
      {preview && <img src={preview} alt="Book page" className="max-h-72 max-w-full object-contain" />}
      {file && allowSave && !savedPhoto && <label className="grid gap-1 text-sm font-medium">
        Photo name
        <Input value={name} onChange={event => setName(event.target.value)} maxLength={160} placeholder="e.g. Chapter 3, page 42" disabled={busy} />
      </label>}
      {file && <div className="flex flex-wrap gap-2">
        <Button disabled={busy} variant="outline" onClick={() => void run(async () => {
          const { createWorker } = await import('tesseract.js');
          const w = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core.wasm.js', langPath: '/ocr', workerBlobURL: false });
          if (!active.current) { await w.terminate(); return; }
          worker.current = w;
          try { const result = (await w.recognize(file)).data.text.trim();
            if (active.current) { setExtracted(result); setCleaned(''); setMessage(result ? 'Extraction ready to review.' : 'No text found. Try a sharper photo.'); }
          } finally { if (worker.current === w) { worker.current = null; await w.terminate(); } }
        })}>Extract English text</Button>
        {allowSave && !savedPhoto && <Button disabled={busy} onClick={() => void run(() => savePhoto(file), 'Photo uploaded, but could not be attached. Refresh the source and try again.')}>Save photo to source</Button>}
      </div>}
      {extracted && <div className="grid gap-3 border-t border-border pt-3">
        <div className={cleaned ? 'grid gap-3 xl:grid-cols-2' : 'grid gap-3'}>
          <label className="grid min-w-0 gap-1 text-sm">Original extraction<Textarea readOnly value={extracted} className="min-h-36" /></label>
          {cleaned && <label className="grid min-w-0 gap-1 text-sm">AI cleanup<Textarea value={cleaned} onChange={event => setCleaned(event.target.value)} className="min-h-36" /></label>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => { onText(extracted); setMessage('Original text added to your passage.'); }}>Add original</Button>
          {cleaned ? <Button disabled={busy || !cleaned.trim()} onClick={() => { onText(cleaned.trim()); setMessage('Cleaned text added to your passage.'); }}>Add cleaned text</Button>
            : allowAiCleanup && <Button variant="outline" disabled={busy || extracted.length > MARKUP_OCR_AI_LIMIT} onClick={() => void run(cleanExtraction, 'AI cleanup was unavailable. You can still add the original extraction.')}>Clean up with AI</Button>}
        </div>
        {allowAiCleanup && !cleaned && <p className="text-xs text-muted-foreground">{extracted.length > MARKUP_OCR_AI_LIMIT ? 'This extraction is too long for AI cleanup. You can still add the original.' : 'AI cleanup sends the extracted text, not the photo.'}</p>}
      </div>}
      {photos.map((photo, index) => <Button key={photo.storagePath} variant="outline" disabled={busy} onClick={() => void run(async () => {
        const blob = await privateAssetBlob(photo.storagePath); if (!active.current) return;
        setFile(new File([blob], photo.originalName || 'page', { type: blob.type })); setSavedPhoto(true); setPreview(URL.createObjectURL(blob)); setExtracted(''); setCleaned(''); if (input.current) input.current.value = '';
      })}>{photo.originalName || 'Page photo ' + (index + 1)}</Button>)}
      <p role="status" className="text-sm text-muted-foreground">{busy ? 'Working…' : message}</p>
    </div></details>;
}
