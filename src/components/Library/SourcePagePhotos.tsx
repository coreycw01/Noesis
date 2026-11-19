'use client';

import { useEffect, useRef, useState } from 'react';
import { initializeFirebase } from '@/firebase';
import { uploadPrivateAsset, privateAssetBlob, deletePrivateAsset, validateAssetBlob } from '@/lib/storage-assets';
import type { StoredAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function SourcePagePhotos({ sourceId, photos, allowSave, onSave, onText }: {
  sourceId: string; photos: StoredAsset[]; allowSave: boolean;
  onSave: (photo: StoredAsset) => Promise<boolean>; onText: (text: string) => void;
}) {
  const [file, setFile] = useState<File>();
  const [savedPhoto, setSavedPhoto] = useState(false);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const worker = useRef<import('tesseract.js').Worker | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; void worker.current?.terminate(); worker.current = null; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try { await action(); } catch { if (active.current) setMessage('Could not finish. Check the image or connection and try again.'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  return <details className="border-y border-border py-3"><summary className="cursor-pointer font-medium">Page photos{photos.length ? ' · ' + photos.length : ''}</summary>
    <div className="mt-3 grid gap-3">
      <input ref={input} type="file" aria-label="Choose a book page photo" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const chosen = e.target.files?.[0]; setMessage(''); setFile(undefined); setSavedPhoto(false); setPreview('');
        if (!chosen) return;
        try { validateAssetBlob(chosen); setFile(chosen); setPreview(URL.createObjectURL(chosen)); } catch { setMessage('Choose a JPG, PNG or WebP image under 10 MB.'); }
      }} />
      {preview && <img src={preview} alt="Book page" className="max-h-72 max-w-full object-contain" />}
      {file && <div className="flex flex-wrap gap-2">
        <Button disabled={busy} variant="outline" onClick={() => void run(async () => {
          const { createWorker } = await import('tesseract.js');
          const w = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core.wasm.js', langPath: '/ocr', workerBlobURL: false });
          if (!active.current) { await w.terminate(); return; }
          worker.current = w;
          try { const result = (await w.recognize(file)).data.text.trim();
            if (active.current) { if (result) onText(result); setMessage(result ? 'Text added to your draft. Review it before saving.' : 'No text found. Try a sharper photo.'); }
          } finally { if (worker.current === w) { worker.current = null; await w.terminate(); } }
        })}>Extract English text</Button>
        {allowSave && !savedPhoto && <Button disabled={busy} onClick={() => void run(async () => {
          const uid = initializeFirebase().auth.currentUser?.uid;
          if (!uid) throw Error('Sign in first');
          const asset = await uploadPrivateAsset({ uid, area: 'sourcePhotos', entityId: sourceId, blob: file, originalName: file.name });
          if (!active.current || !await onSave(asset)) { await deletePrivateAsset(asset.storagePath); throw Error('Not attached'); }
          setSavedPhoto(true); if (input.current) input.current.value = ''; setMessage('Photo saved to this source.');
        })}>Save photo to source</Button>}
      </div>}
      {photos.map((photo, index) => <Button key={photo.storagePath} variant="outline" disabled={busy} onClick={() => void run(async () => {
        const blob = await privateAssetBlob(photo.storagePath); if (!active.current) return;
        setFile(new File([blob], photo.originalName || 'page', { type: blob.type })); setSavedPhoto(true); setPreview(URL.createObjectURL(blob)); if (input.current) input.current.value = '';
      })}>{photo.originalName || 'Page photo ' + (index + 1)}</Button>)}
      <p role="status" className="text-sm text-muted-foreground">{busy ? 'Working…' : message}</p>
    </div></details>;
}
