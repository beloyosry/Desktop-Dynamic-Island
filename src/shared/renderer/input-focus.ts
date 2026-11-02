import type { IslandBridge } from '../contracts/bridge';

/** Keep native keyboard focus while a text control or modal dialog is active. */
export function initializeInputFocus(root: HTMLElement, bridge: Pick<IslandBridge, 'focusInput'>) {
  const isInput = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"][aria-modal="true"]');
  root.addEventListener('pointerdown', (event) => {
    if (isInput(event.target)) bridge.focusInput(true);
  });
  root.addEventListener('focusin', (event) => {
    if (isInput(event.target)) bridge.focusInput(true);
  });
  root.addEventListener('focusout', () => {
    queueMicrotask(() => {
      if (!isInput(document.activeElement)) bridge.focusInput(false);
    });
  });
}
