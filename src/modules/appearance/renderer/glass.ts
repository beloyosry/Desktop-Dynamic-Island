import { motionAllowed } from './theme';

/** Specular light follows interaction. No animation loop runs when the pointer is still. */
export function initializeGlass(root: HTMLElement) {
  let frame = 0;
  let active: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  const enabled = () =>
    document.documentElement.dataset.pageHidden !== 'true' &&
    motionAllowed() &&
    document.documentElement.dataset.reflections !== 'false' &&
    document.documentElement.dataset.transparency !== 'reduced';
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    root.style.removeProperty('--light-x');
    root.style.removeProperty('--light-y');
    active?.style.removeProperty('--pointer-x');
    active?.style.removeProperty('--pointer-y');
    active = null;
  }
  function draw() {
    frame = 0;
    if (!enabled()) {
      reset();
      return;
    }
    const rect = root.getBoundingClientRect();
    root.style.setProperty(
      '--light-x',
      `${Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100))}%`,
    );
    root.style.setProperty(
      '--light-y',
      `${Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100))}%`,
    );
    if (active) {
      const bounds = active.getBoundingClientRect();
      active.style.setProperty('--pointer-x', `${x - bounds.left}px`);
      active.style.setProperty('--pointer-y', `${y - bounds.top}px`);
    }
  }
  root.addEventListener(
    'pointermove',
    (event) => {
      if (!enabled()) return;
      x = event.clientX;
      y = event.clientY;
      const target = (event.target as Element).closest<HTMLElement>(
        '.tool-btn, .theme-option, .preview-island, .ctl, .btn',
      );
      if (active !== target) {
        active?.style.removeProperty('--pointer-x');
        active?.style.removeProperty('--pointer-y');
        active = target;
      }
      if (!frame) frame = requestAnimationFrame(draw);
    },
    { passive: true },
  );
  root.addEventListener('pointerleave', reset);
  document.addEventListener('appearance:change', () => {
    if (!enabled()) reset();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  });
  window.addEventListener('island:visibility', (event) => {
    if (!event.detail) reset();
  });
}
