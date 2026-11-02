export function volIconClass(el: HTMLElement, vol: number, muted: boolean) {
  el.classList.toggle('vol-mute', muted || vol === 0);
  el.classList.toggle('vol-low', !muted && vol > 0 && vol < 0.4);
}
