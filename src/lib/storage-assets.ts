'use client';

import {
  getBlob,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { initializeFirebase } from '@/firebase';
import type { StoredAsset } from '@/lib/types';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const AUDIO_TYPES = new Set(['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']);
const VIDEO_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

function limitFor(contentType: string) {
  if (IMAGE_TYPES.has(contentType)) return 10 * 1_024 * 1_024;
  if (AUDIO_TYPES.has(contentType)) return 100 * 1_024 * 1_024;
  if (VIDEO_TYPES.has(contentType)) return 250 * 1_024 * 1_024;
  return 0;
}

export function validateAssetBlob(blob: Blob) {
  const maxBytes = limitFor(blob.type);
  if (!maxBytes) throw new Error('This file type is not supported.');
  if (blob.size > maxBytes) throw new Error('This file is larger than the allowed upload limit.');
}

export async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function uploadPrivateAsset({
  uid,
  area,
  entityId,
  blob,
  originalName,
  durationSeconds,
}: {
  uid: string;
  area: 'works' | 'atlasMaps';
  entityId: string;
  blob: Blob;
  originalName?: string;
  durationSeconds?: number;
}): Promise<StoredAsset> {
  validateAssetBlob(blob);
  const extension = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
  const storagePath = `users/${uid}/${area}/${entityId}/${crypto.randomUUID()}.${extension}`;
  const storage = getStorage(initializeFirebase().firebaseApp);
  const task = uploadBytesResumable(ref(storage, storagePath), blob, {
    contentType: blob.type,
    customMetadata: { ownerUid: uid, entityId },
  });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', undefined, reject, () => resolve());
  });
  return {
    storagePath,
    contentType: blob.type,
    size: blob.size,
    durationSeconds,
    originalName,
    createdAt: new Date().toISOString(),
  };
}

export async function privateAssetObjectUrl(storagePath: string) {
  const storage = getStorage(initializeFirebase().firebaseApp);
  const blob = await getBlob(ref(storage, storagePath));
  return URL.createObjectURL(blob);
}

export async function persistInlineDraftAssets<T extends DraftAssetInput>(uid: string, draft: T): Promise<T> {
  const next = { ...draft } as T;
  if (next.fileUrl?.startsWith('data:')) {
    const blob = await dataUrlToBlob(next.fileUrl);
    next.asset = await uploadPrivateAsset({
      uid,
      area: 'works',
      entityId: next.id,
      blob,
      durationSeconds: next.durationSeconds,
    });
    next.storagePath = next.asset.storagePath;
    next.fileUrl = '';
  }
  if (next.canvasData?.startsWith('data:')) {
    const blob = await dataUrlToBlob(next.canvasData);
    next.canvasAsset = await uploadPrivateAsset({ uid, area: 'works', entityId: next.id, blob });
    next.canvasData = '';
    next.thumbnailUrl = '';
  }
  if (next.writingOverlayData?.startsWith('data:')) {
    const blob = await dataUrlToBlob(next.writingOverlayData);
    next.overlayAsset = await uploadPrivateAsset({ uid, area: 'works', entityId: next.id, blob });
    next.writingOverlayData = '';
  }
  return next;
}

type DraftAssetInput = {
  id: string;
  fileUrl?: string;
  storagePath?: string;
  asset?: StoredAsset;
  durationSeconds?: number;
  canvasData?: string;
  canvasAsset?: StoredAsset;
  thumbnailUrl?: string;
  writingOverlayData?: string;
  overlayAsset?: StoredAsset;
  [key: string]: unknown;
};
