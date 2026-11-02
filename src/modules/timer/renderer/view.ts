import { presentation } from '../../../shared/renderer/presentation';
import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | 'state' | 'lastMode'>;

export function initializeStopwatch(context: Context) {
  const { $ } = context;
  // High Precision Stopwatch for Dynamic Island Pro

  const btnTimerMode = $<HTMLButtonElement>('#tm-mode-timer');
  const btnSwMode = $<HTMLButtonElement>('#tm-mode-sw');
  const timerSubview = $('#tm-subview');
  const swSubview = $('#sw-subview');

  const swDigits = $('#sw-digits');
  const swState = $('#sw-state');
  const swStart = $<HTMLButtonElement>('#sw-start');
  const swLap = $<HTMLButtonElement>('#sw-lap');
  const swReset = $<HTMLButtonElement>('#sw-reset');
  const swLaps = $('#sw-laps');

  let running = false;
  let startTime = 0;
  let elapsed = 0;
  let displayTimer: ReturnType<typeof setTimeout> | undefined;
  let laps: { diff: number; total: number }[] = [];
  const mainDigits = document.createTextNode('00:00');
  const centiseconds = document.createElement('small');
  centiseconds.textContent = '.00';
  swDigits.replaceChildren(mainDigits, centiseconds);
  const displayVisible = () =>
    context.state.visible &&
    !document.hidden &&
    context.lastMode === 'expanded' &&
    context.state.tab === 'timer' &&
    !swSubview.hidden;

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    const csStr = String(cs).padStart(2, '0');
    return { main: `${mStr}:${sStr}`, cs: `.${csStr}`, full: `${mStr}:${sStr}.${csStr}` };
  }

  function updateDisplay() {
    clearTimeout(displayTimer);
    const now = performance.now();
    const current = elapsed + (running ? now - startTime : 0);
    const t = formatTime(current);
    mainDigits.textContent = t.main;
    centiseconds.textContent = t.cs;
    if (running && displayVisible()) displayTimer = setTimeout(updateDisplay, 50);
  }
  function syncDisplay() {
    clearTimeout(displayTimer);
    if (displayVisible()) updateDisplay();
  }
  document.addEventListener('visibilitychange', syncDisplay);
  window.addEventListener('island:mode', syncDisplay);
  window.addEventListener('island:tab', syncDisplay);
  window.addEventListener('island:visibility', syncDisplay);

  // Mode switcher
  if (btnTimerMode && btnSwMode) {
    btnTimerMode.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(800, 0.03);
      btnTimerMode.classList.add('active');
      btnSwMode.classList.remove('active');
      if (timerSubview) timerSubview.hidden = false;
      if (swSubview) swSubview.hidden = true;
      syncDisplay();
    });

    btnSwMode.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(800, 0.03);
      btnSwMode.classList.add('active');
      btnTimerMode.classList.remove('active');
      if (timerSubview) timerSubview.hidden = true;
      if (swSubview) swSubview.hidden = false;
      syncDisplay();
    });
  }

  function renderLaps() {
    if (!swLaps) return;
    swLaps.innerHTML = '';
    if (!laps.length) return;

    let minTime = Infinity;
    let maxTime = -1;
    if (laps.length > 1) {
      laps.forEach((l) => {
        if (l.diff < minTime) minTime = l.diff;
        if (l.diff > maxTime) maxTime = l.diff;
      });
    }

    laps.forEach((lap, idx) => {
      const row = document.createElement('div');
      row.className = 'sw-lap-row';
      if (laps.length > 1) {
        if (lap.diff === minTime) row.classList.add('fastest');
        if (lap.diff === maxTime) row.classList.add('slowest');
      }

      const num = document.createElement('span');
      num.className = 'lap-num';
      num.textContent = `Lap ${laps.length - idx}`;

      const split = document.createElement('span');
      split.className = 'lap-split';
      split.textContent = `+${formatTime(lap.diff).full}`;

      const total = document.createElement('span');
      total.className = 'lap-total';
      total.textContent = formatTime(lap.total).full;

      row.append(num, split, total);
      swLaps.append(row);
    });
  }

  if (swStart) {
    swStart.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1000, 0.04);
      if (!running) {
        running = true;
        startTime = performance.now();
        swStart.textContent = 'Pause';
        swStart.classList.add('danger');
        if (swState) swState.textContent = 'Running';
        if (swLap) swLap.disabled = false;
        updateDisplay();
      } else {
        running = false;
        elapsed += performance.now() - startTime;
        clearTimeout(displayTimer);
        swStart.textContent = 'Resume';
        swStart.classList.remove('danger');
        if (swState) swState.textContent = 'Paused';
        if (swLap) swLap.disabled = true;
        updateDisplay();
      }
    });
  }

  if (swLap) {
    swLap.addEventListener('click', () => {
      if (!running) return;
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1150, 0.03);
      const now = performance.now();
      const current = elapsed + (now - startTime);
      const prevTotal = laps.length ? laps[0].total : 0;
      const diff = current - prevTotal;

      laps.unshift({ total: current, diff });
      renderLaps();
    });
  }

  if (swReset) {
    swReset.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(650, 0.04);
      running = false;
      clearTimeout(displayTimer);
      elapsed = 0;
      startTime = 0;
      laps = [];
      if (swStart) {
        swStart.textContent = 'Start';
        swStart.classList.remove('danger');
      }
      if (swLap) swLap.disabled = true;
      if (swState) swState.textContent = 'Ready';
      updateDisplay();
      if (swLaps) swLaps.innerHTML = '';
    });
  }
}
