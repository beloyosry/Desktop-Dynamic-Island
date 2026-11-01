// High Precision Stopwatch for Dynamic Island Pro
(() => {
  const btnTimerMode = $('#tm-mode-timer');
  const btnSwMode = $('#tm-mode-sw');
  const timerSubview = $('#tm-subview');
  const swSubview = $('#sw-subview');

  const swDigits = $('#sw-digits');
  const swState = $('#sw-state');
  const swStart = $('#sw-start');
  const swLap = $('#sw-lap');
  const swReset = $('#sw-reset');
  const swLaps = $('#sw-laps');

  let running = false;
  let startTime = 0;
  let elapsed = 0;
  let animId = null;
  let laps = [];

  function formatTime(ms) {
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
    const now = performance.now();
    const current = elapsed + (running ? (now - startTime) : 0);
    const t = formatTime(current);
    if (swDigits) swDigits.innerHTML = `${t.main}<small>${t.cs}</small>`;
    if (running) {
      animId = requestAnimationFrame(updateDisplay);
    }
  }

  // Mode switcher
  if (btnTimerMode && btnSwMode) {
    btnTimerMode.addEventListener('click', () => {
      if (typeof playClickSound === 'function') playClickSound(800, 0.03);
      btnTimerMode.classList.add('active');
      btnSwMode.classList.remove('active');
      if (timerSubview) timerSubview.hidden = false;
      if (swSubview) swSubview.hidden = true;
    });

    btnSwMode.addEventListener('click', () => {
      if (typeof playClickSound === 'function') playClickSound(800, 0.03);
      btnSwMode.classList.add('active');
      btnTimerMode.classList.remove('active');
      if (timerSubview) timerSubview.hidden = true;
      if (swSubview) swSubview.hidden = false;
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
      if (typeof playClickSound === 'function') playClickSound(1000, 0.04);
      if (!running) {
        running = true;
        startTime = performance.now();
        swStart.textContent = 'Pause';
        swStart.classList.add('danger');
        if (swState) swState.textContent = 'Running';
        if (swLap) swLap.disabled = false;
        animId = requestAnimationFrame(updateDisplay);
      } else {
        running = false;
        elapsed += performance.now() - startTime;
        cancelAnimationFrame(animId);
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
      if (typeof playClickSound === 'function') playClickSound(1150, 0.03);
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
      if (typeof playClickSound === 'function') playClickSound(650, 0.04);
      running = false;
      cancelAnimationFrame(animId);
      elapsed = 0;
      startTime = 0;
      laps = [];
      if (swStart) {
        swStart.textContent = 'Start';
        swStart.classList.remove('danger');
      }
      if (swLap) swLap.disabled = true;
      if (swState) swState.textContent = 'Ready';
      if (swDigits) swDigits.innerHTML = '00:00<small>.00</small>';
      if (swLaps) swLaps.innerHTML = '';
    });
  }
})();
