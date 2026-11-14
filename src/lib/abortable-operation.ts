export async function abortableOperation<T>(start: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return start();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return start();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
