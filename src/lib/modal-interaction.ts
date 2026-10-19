export function releaseStaleModalInteractionLock() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    const activeLayer = document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
    );
    if (!activeLayer) document.body.style.removeProperty('pointer-events');
  });
}
