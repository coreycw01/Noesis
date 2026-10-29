const ACTIVE_INTERACTION_LAYER_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper] [data-state="open"]',
].join(', ');

export function releaseStaleModalInteractionLock() {
  if (typeof window === 'undefined') return;

  const releaseIfIdle = () => {
    const activeLayer = document.querySelector(ACTIVE_INTERACTION_LAYER_SELECTOR);
    if (!activeLayer) {
      document.body.style.removeProperty('pointer-events');
      document.documentElement.style.removeProperty('pointer-events');
    }
  };

  // Radix releases modal layers after their exit animation. A dropdown that
  // opens a dialog can otherwise reapply the body lock after a single-frame
  // cleanup, leaving the visible page unable to receive pointer input.
  window.queueMicrotask(releaseIfIdle);
  window.requestAnimationFrame(releaseIfIdle);
  [50, 250, 500, 1000].forEach((delay) => window.setTimeout(releaseIfIdle, delay));
}
