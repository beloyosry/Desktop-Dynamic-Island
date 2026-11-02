import { motionAllowed } from '../../appearance/renderer/theme';
import { $$ } from '../../../shared/renderer/dom';
import { presentation } from '../../../shared/renderer/presentation';
import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | 'bridge' | 'island' | 'state' | 'feat' | 'lastMode' | 'anchor'>;

export function initializeNova(context: Context) {
  const { $, bridge, island, state, feat } = context;
  // Nova: two eyes in the idle pill that look at the cursor and blink. They appear only when the
  // cursor lingers beside the island for a few seconds, and never stand in the way of opening it:
  // once the cursor is on the island (hover), the island opens as usual and the eyes are gone.

  const DWELL_MS = 3000;
  const eyes = $('.eyes');
  const pupils = [...$$('.eye b')];
  let near: { dx: number; dy: number } | null = null;
  let nearSince = 0;
  let dwellTimer: ReturnType<typeof setTimeout> | undefined;

  function apply() {
    const lingered = near && Date.now() - nearSince >= DWELL_MS;
    const show =
      feat('novaEyes') && !context.anchor.vertical && lingered && !state.hover && context.lastMode === 'idle';
    island.classList.toggle('eyes', !!show);
  }

  bridge.onNear((n) => {
    if (!n) {
      near = null;
      nearSince = 0;
      clearTimeout(dwellTimer);
      apply();
      return;
    }
    if (!near) {
      nearSince = Date.now();
      clearTimeout(dwellTimer);
      dwellTimer = setTimeout(apply, DWELL_MS + 20);
    }
    near = n;
    // pupils move up to 2.5px toward the cursor
    const d = Math.hypot(n.dx, n.dy) || 1;
    const k = Math.min(1, d / 120);
    const px = (n.dx / d) * 2.5 * k;
    const py = (n.dy / d) * 2.5 * k;
    pupils.forEach((p) => {
      p.style.setProperty('--px', `${px.toFixed(2)}px`);
      p.style.setProperty('--py', `${py.toFixed(2)}px`);
    });
    apply();
  });

  // natural blinking, now and then a double blink
  function blink() {
    eyes.classList.add('blink');
    setTimeout(() => eyes.classList.remove('blink'), 130);
  }

  // Petting Nova: heart sparkles & joyful wink
  const TIPS = [
    'You are doing great today! ✨',
    'Stay hydrated and keep shining! 💧',
    'Small steps lead to giant leaps! 🚀',
    'Take a deep breath and smile! 😊',
    'Focus is your superpower! ⚡',
  ];

  function petNova() {
    if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1300, 0.05);
    eyes.classList.add('wink');
    setTimeout(() => eyes.classList.remove('wink'), 450);

    // Floating heart particles
    const r = eyes.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; motionAllowed() && i < 6; i++) {
      const h = document.createElement('span');
      h.className = 'nova-heart';
      h.textContent = ['💖', '✨', '⭐', '🌸'][Math.floor(Math.random() * 4)];
      h.style.left = `${cx + (Math.random() - 0.5) * 40}px`;
      h.style.top = `${cy}px`;
      document.body.append(h);
      h.animate(
        [
          { transform: 'translateY(0) scale(0.6)', opacity: 1 },
          { transform: `translateY(-${30 + Math.random() * 40}px) scale(1.2)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
      ).onfinish = () => h.remove();
    }

    if (typeof presentation.toast === 'function') {
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      presentation.toast('ico-bolt', tip, 4000);
    }
  }

  eyes.addEventListener('click', (e) => {
    e.stopPropagation();
    petNova();
  });

  (function loop() {
    if (state.visible && !document.hidden && island.classList.contains('eyes')) {
      blink();
      if (Math.random() < 0.2) setTimeout(blink, 260);
    }
    setTimeout(loop, 2400 + Math.random() * 3600);
  })();

  bridge.onHover(apply);
  window.addEventListener('island:features', apply);
  window.addEventListener('island:mode', apply);
}
