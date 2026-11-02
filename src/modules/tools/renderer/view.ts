import { presentation } from '../../../shared/renderer/presentation';
import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | 'bridge' | 'state' | 'feat' | 'celebrate' | 'render'>;

export function initializeTools(context: Context) {
  const { $, bridge, state, feat, celebrate, render } = context;
  // Tools and Control Center tab for Dynamic Island Pro

  const toolSnip = $<HTMLButtonElement>('#tool-snip');
  const toolFull = $<HTMLButtonElement>('#tool-fullshot');
  const toolPin = $<HTMLButtonElement>('#tool-pin');
  const toolMute = $<HTMLButtonElement>('#tool-mute');
  const toolTrash = $<HTMLButtonElement>('#tool-trash');
  const toolLock = $<HTMLButtonElement>('#tool-lock');

  // Sound feedback synthesizer (Apple style micro-pop)
  let audioCtx: AudioContext | null = null;
  function playClick(freq = 800, dur = 0.035, type: OscillatorType = 'sine') {
    if (!feat('soundEffects')) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch {}
  }
  presentation.playClickSound = playClick;

  // Snip Tool
  if (toolSnip) {
    toolSnip.addEventListener('click', async () => {
      playClick(1000, 0.04);
      if (typeof presentation.toast === 'function') presentation.toast('ico-cam', 'Snipping Tool launched');
      try {
        await bridge.tools.snip();
      } catch (err) {
        console.error('[tools] snip:', err);
      }
    });
  }

  // Fullscreen Screenshot
  if (toolFull) {
    toolFull.addEventListener('click', async () => {
      playClick(1200, 0.05);
      try {
        const res = await bridge.tools.captureFull();
        if (res.ok) {
          if (typeof presentation.toast === 'function')
            presentation.toast('ico-check', 'Screenshot copied to clipboard');
          if (typeof celebrate === 'function') celebrate(['#8ab4ff', '#ffffff', '#38bdf8']);
        }
      } catch (err) {
        console.error('[tools] fullshot:', err);
      }
    });
  }

  // Pin Island open
  function updatePinButton() {
    if (!toolPin) return;
    const pinned = !!state.pinned;
    toolPin.classList.toggle('active', pinned);
    const title = $('#tool-pin-title');
    const desc = $('#tool-pin-desc');
    if (title) title.textContent = pinned ? 'Island Pinned' : 'Pin Island';
    if (desc) desc.textContent = pinned ? 'Stays Open' : 'Keep Expanded';
  }

  if (toolPin) {
    toolPin.addEventListener('click', () => {
      playClick(900, 0.04);
      state.pinned = !state.pinned;
      if (!state.pinned) state.hover = false;
      updatePinButton();
      render();
    });
  }

  // Mute Toggle
  if (toolMute) {
    toolMute.addEventListener('click', () => {
      playClick(750, 0.04);
      bridge.mediaCmd('mute');
    });
  }

  function updateMuteState(muted: boolean) {
    if (!toolMute) return;
    toolMute.classList.toggle('active', !!muted);
    const title = $('#tool-mute-title');
    if (title) title.textContent = muted ? 'Unmute' : 'Mute';
  }

  bridge.onMedia((m) => {
    if (typeof m.muted === 'boolean') updateMuteState(m.muted);
  });

  // Empty Recycle Bin
  if (toolTrash) {
    toolTrash.addEventListener('click', async () => {
      playClick(600, 0.06);
      try {
        await bridge.tools.emptyBin();
        if (typeof presentation.toast === 'function') presentation.toast('ico-check', 'Recycle Bin Cleared');
        if (typeof celebrate === 'function') celebrate(['#30d158', '#ffd479', '#8ab4ff']);
      } catch (err) {
        console.error('[tools] trash:', err);
      }
    });
  }

  // Lock Workstation
  if (toolLock) {
    toolLock.addEventListener('click', async () => {
      playClick(500, 0.08);
      try {
        await bridge.tools.lockPc();
      } catch (err) {
        console.error('[tools] lock:', err);
      }
    });
  }

  window.addEventListener('island:features', updatePinButton);
  updatePinButton();
}
