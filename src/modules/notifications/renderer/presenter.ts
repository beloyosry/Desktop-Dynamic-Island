import type { IslandContext } from '../../../renderer/island/context';
import { volIconClass } from '../../media/renderer/volume-icon';
import { presentation } from '../../../shared/renderer/presentation';

type Context = Pick<IslandContext, '$' | 'state' | 'render' | 'feat'>;
export function initializeNotifications({ $, state, render, feat }: Context) {
  // ---------------- toasts & HUD ----------------
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  // state.toastAction: what a click on the current presentation.toast does (set right after showToast)
  function showToast(kind: string, label: string, value: string, pct: number, ms = 3200) {
    presentation.recordNotification?.({ kind, title: label, detail: value });
    state.toastAction = null;
    const t = $('.l-toast');
    t.className = `layer l-toast ${kind}`;
    $('#t-label').textContent = label;
    $('#t-value').textContent = value;
    $('.l-toast .batt b').style.width = `${Math.round((pct ?? 0) * 100)}%`;
    $('.t-bar b').style.width = `${Math.round((pct ?? 0) * 100)}%`;
    // vertical variant
    $('.l-vtoast').className = `layer vlayer l-vtoast ${kind}`;
    $('#vt-value').textContent = kind === 'done' ? 'Done' : value;
    $('.v-bar b').style.height = `${Math.round((pct ?? 0) * 100)}%`;
    state.toast = kind;
    state.toastUntil = Date.now() + ms;
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(render, ms + 50);
  }

  function showHud(kind: string, value: number, muted = false) {
    if (!feat(kind === 'vol' ? 'hudVolume' : 'hudBrightness')) return;
    const pct = muted ? 0 : value;
    showToast(kind, '', muted ? 'Muted' : `${Math.round(value * 100)}%`, pct, 1600);
    if (kind === 'vol') {
      volIconClass($('.l-toast'), value, !!muted);
      volIconClass($('.l-vtoast'), value, !!muted);
    }
  }

  // ---------------- battery ----------------
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      let lowShown = false;
      const pct = () => `${Math.round(b.level * 100)}%`;
      b.addEventListener('chargingchange', () => {
        if (!feat('battery')) return;
        if (b.charging) showToast('charging', 'Charging', pct(), b.level);
        else showToast(b.level <= 0.2 ? 'low' : 'battery', 'On Battery', pct(), b.level);
      });
      b.addEventListener('levelchange', () => {
        if (!b.charging && b.level <= 0.2 && !lowShown && feat('battery')) {
          lowShown = true;
          showToast('low', 'Low Battery', pct(), b.level, 4500);
        }
        if (b.level > 0.2) lowShown = false;
      });
    });
  }

  return { showToast, showHud };
}
