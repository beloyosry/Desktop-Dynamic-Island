// ---------------- sliders ----------------
export function makeSlider(
  el: HTMLElement,
  { onInput, onCommit }: { onInput?: (value: number) => void; onCommit?: (value: number) => void } = {},
) {
  const fill = el.querySelector<HTMLElement>('.fill')!;
  let value = 0;
  let dragging = false;
  const set = (v: number) => {
    value = Math.max(0, Math.min(1, v));
    fill.style.width = `${value * 100}%`;
    el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  const at = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.classList.add('drag');
    el.setPointerCapture(e.pointerId);
    set(at(e));
    onInput?.(value);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    set(at(e));
    onInput?.(value);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('drag');
    onCommit?.(value);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return {
    set,
    get dragging() {
      return dragging;
    },
  };
}

export function throttle(fn: (value: number) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (value: number) => {
    const wait = ms - (Date.now() - last);
    clearTimeout(timer);
    if (wait <= 0) {
      last = Date.now();
      fn(value);
    } else {
      timer = setTimeout(() => {
        last = Date.now();
        fn(value);
      }, wait);
    }
  };
}
