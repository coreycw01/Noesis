'use client';

const PREFIX = 'noesis-demo-asset:';
export const isDemoAsset = (value: string) => value.startsWith(PREFIX);

function openAssets(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('noesis-demo-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recordings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local demo media storage is unavailable.'));
  });
}

export async function saveDemoRecording(blob: Blob): Promise<string> {
  const db = await openAssets();
  const id = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('recordings', 'readwrite');
      transaction.objectStore('recordings').put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new Error('The demo recording could not be stored. Check available browser storage.'));
    });
    return `${PREFIX}${id}`;
  } finally { db.close(); }
}

export async function demoRecordingUrl(value: string): Promise<string> {
  if (!isDemoAsset(value)) throw new Error('Invalid local recording reference.');
  const db = await openAssets();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction('recordings').objectStore('recordings').get(value.slice(PREFIX.length));
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error('This demo recording is no longer stored in this browser.'));
      request.onerror = () => reject(new Error('The demo recording could not be opened.'));
    });
    return URL.createObjectURL(blob);
  } finally { db.close(); }
}
