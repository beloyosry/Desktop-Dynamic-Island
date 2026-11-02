import type { IslandContext } from '../../../renderer/island/context';
import { presentation } from '../../../shared/renderer/presentation';
import { timerMinutes } from '../domain/duration';

type Context = Pick<
  IslandContext,
  '$' | '$$' | 'state' | 'island' | 'feat' | 'render' | 'showToast' | 'celebrate' | 'playTones' | 'fmt'
> & { timerActive(): boolean };
export function initializeFocusTimer({
  $,
  $$,
  state,
  island,
  feat,
  render,
  showToast,
  celebrate,
  playTones,
  fmt,
  timerActive,
}: Context) {
  // ---------------- timer ----------------
  const RING = 276.46;
  let lastDraw = '';

  function setTimer(min: number, phase: string | null = null) {
    state.timer = { total: min * 60, remaining: min * 60, endAt: 0, running: false, phase };
    island.classList.toggle('focus-on', phase === 'focus');
    island.classList.toggle('break-on', phase === 'break');
    $$('[data-min]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.min) === min));
    drawTimer();
    render();
  }

  function drawTimer() {
    const t = state.timer;
    const rem = t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.remaining;
    if (!state.visible || document.hidden) return rem;
    // Completion still checks at 250 ms; unchanged digits and controls need no DOM writes.
    const key = `${Math.ceil(rem)}:${t.total}:${t.running}:${t.phase}`;
    if (key === lastDraw) return rem;
    lastDraw = key;
    island.classList.toggle('timer-running', t.running);
    $$<HTMLButtonElement>('[data-extend]').forEach((button) => {
      button.disabled = !t.total || t.total >= 240 * 60;
    });
    const text = fmt(Math.ceil(rem));
    $('#tm-digits').textContent = text;
    $('#c-time').textContent = $('#vc-time').textContent = text;
    $('#tm-ring').style.strokeDashoffset = String(t.total ? RING * (1 - rem / t.total) : RING);
    const started = t.remaining > 0 && t.remaining < t.total;
    $<HTMLButtonElement>('#tm-start').textContent = t.running ? 'Pause' : started ? 'Resume' : 'Start';
    const label =
      t.phase === 'focus' ? `Focus ${focus.round + 1}` : t.phase === 'break' ? 'Break' : 'Running';
    $('#tm-state').textContent = t.running ? label : started ? 'Paused' : t.total ? 'Ready' : 'Pick a time';
    $<HTMLButtonElement>('#tm-focus').classList.toggle('sel', !!t.phase);
    $<HTMLButtonElement>('#tm-reset').disabled = !t.total;
    return rem;
  }

  function beep() {
    playTones(
      [
        [0, 880],
        [0.22, 1108],
        [0.44, 1318],
      ],
      { peak: 0.25, decay: 0.35 },
    );
  }

  $$('[data-min]').forEach((b) => b.addEventListener('click', () => setTimer(Number(b.dataset.min))));
  $<HTMLFormElement>('#tm-custom').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $<HTMLInputElement>('#tm-minutes');
    const minutes = timerMinutes(input.value);
    if (minutes === null) {
      input.reportValidity();
      return;
    }
    setTimer(minutes);
  });
  $$<HTMLButtonElement>('[data-extend]').forEach((button) =>
    button.addEventListener('click', () => {
      const t = state.timer;
      if (!t.total || t.total >= 240 * 60) return;
      const seconds = Math.min(Number(button.dataset.extend) * 60, 240 * 60 - t.total);
      t.total += seconds;
      t.remaining += seconds;
      if (t.running) t.endAt += seconds * 1000;
      drawTimer();
      render();
    }),
  );

  $<HTMLButtonElement>('#tm-start').addEventListener('click', () => {
    if (!state.timer.total) setTimer(5);
    const t = state.timer;
    if (t.running) {
      t.remaining = Math.max(0, (t.endAt - Date.now()) / 1000);
      t.running = false;
    } else if (t.remaining > 0) {
      t.endAt = Date.now() + t.remaining * 1000;
      t.running = true;
    }
    drawTimer();
    render();
  });

  // ---- focus sessions: focus, then a break that starts by itself (longer after every 4th) ----
  const focus = { round: 0 };
  function startPhase(phase: string) {
    const f = state.features;
    const min =
      phase === 'focus' ? f.focusMin || 25 : focus.round % 4 === 0 ? f.longBreakMin || 15 : f.breakMin || 5;
    setTimer(min, phase);
    state.timer.endAt = Date.now() + state.timer.remaining * 1000;
    state.timer.running = true;
    drawTimer();
    render();
    // Nova puts her headband on and opens her laptop
    if (phase === 'focus' && feat('novaFocus')) {
      $('.sc-laptop-time').textContent = `${min}:00`;
      presentation.playScene?.({
        who: 'nova',
        props: ['band', 'laptop'],
        arms: 'type',
        tone: 'focus',
        badge: '🎯 Focus',
        title: 'Focus time',
        sub: `<b>${min} min</b> of deep work — reminders stay quiet until it ends`,
        ms: 6000,
      });
    }
  }
  // while focusing, reminders and other gentle interruptions wait
  const focusing = () => state.timer.phase === 'focus' && timerActive();
  $<HTMLButtonElement>('#tm-focus').addEventListener('click', () => {
    if (state.timer.phase) return;
    focus.round = 0;
    startPhase('focus');
  });

  $<HTMLButtonElement>('#tm-reset').addEventListener('click', () => {
    focus.round = 0;
    island.classList.remove('focus-on', 'break-on');
    state.timer = { total: 0, remaining: 0, endAt: 0, running: false };
    $$('[data-min]').forEach((b) => b.classList.remove('sel'));
    drawTimer();
    render();
  });

  setInterval(() => {
    if (!state.timer.running) return;
    const rem = drawTimer();
    if (rem <= 0 && state.timer.phase) {
      const wasFocus = state.timer.phase === 'focus';
      island.classList.add('alert');
      setTimeout(() => island.classList.remove('alert'), 1000);
      if (wasFocus) {
        focus.round++;
        startPhase('break');
        const brk = Math.round(state.timer.total / 60);
        const shown =
          feat('novaFocus') &&
          presentation.playScene?.({
            who: 'nova',
            props: ['band'],
            arms: 'rest',
            tone: 'focus',
            badge: '🎯 Focus',
            title: 'Well done! 🎉',
            notification: { kind: 'focus', title: `Focus ${focus.round} done`, detail: `Break ${brk} min` },
            sub: `Focus session <b>${focus.round}</b> done · <b>${brk} min</b> break`,
            ms: 8000,
          });
        if (!shown) showToast('done', `Focus ${focus.round} done`, `Break ${brk} min`, 0, 4500);
        celebrate(['#ff6b6b', '#ffd479', '#ff9f0a']);
        playTones(
          [
            [0, 784],
            [0.2, 988],
          ],
          { peak: 0.2, decay: 0.6 },
        );
      } else {
        setTimer(state.features.focusMin || 25, null);
        island.classList.remove('focus-on', 'break-on');
        showToast('done', 'Break over', 'Focus', 0, 9000);
        state.toastAction = () => startPhase('focus');
        beep();
      }
      return;
    }
    if (rem <= 0) {
      state.timer = { total: 0, remaining: 0, endAt: 0, running: false };
      $$('[data-min]').forEach((b) => b.classList.remove('sel'));
      drawTimer();
      showToast('done', 'Timer Done', '', 0, 4000);
      island.classList.add('alert');
      setTimeout(() => island.classList.remove('alert'), 1000);
      beep();
    }
  }, 250);
  window.addEventListener('island:visibility', () => drawTimer());

  return { drawTimer, focusing };
}
