const interactive = 'a,button,input,textarea,select,label,summary,[contenteditable],[role="button"],[role="checkbox"],[role="combobox"],[role="menuitem"],[role="option"],[role="switch"]';

export function activateEntityOnKey(event: { key: string; repeat: boolean; preventDefault: () => void }, open: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (!event.repeat) open();
}

export function isEntitySurfaceClick({ currentTarget, target, defaultPrevented }: {
  currentTarget: Element;
  target: EventTarget;
  defaultPrevented: boolean;
}) {
  if (defaultPrevented || !(target instanceof Element) || !currentTarget.contains(target)) return false;
  const control = target.closest(interactive);
  return !control || control === currentTarget || !currentTarget.contains(control);
}
