import { motionAllowed } from '../../modules/appearance/renderer/theme';
import { effectiveFeatures } from '../../modules/performance/domain/boost';
import { tabOrder } from '../../modules/settings/domain/tabs';
import type { IslandContext } from './context';
import { playTones, releaseIdleAudio } from '../../shared/renderer/audio';
import { initializeMedia } from '../../modules/media/renderer/controller';
import { initializeNotifications } from '../../modules/notifications/renderer/presenter';
import { initializeFocusTimer } from '../../modules/timer/renderer/focus';
import type { IslandState } from './state';
import type { Anchor } from '../../shared/contracts/events';

import type { Features, FeatureKey } from '../../modules/settings/domain/features';
import { presentation } from '../../shared/renderer/presentation';
import { $, $$ } from '../../shared/renderer/dom';

export function initializeIsland(): IslandContext {
  const bridge = window.nova;
  const esc = (s: unknown) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );

  const island = $('#island');
  const ICON_X = '<svg class="s" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  const state: IslandState = {
    overlay: null,
    hover: false,
    pinned: false,
    moving: false,
    mediaFront: false, // the player showing the media is the window in front
    dragging: false,
    tab: 'media',
    media: { has: false },
    mediaAt: 0,
    vol: null,
    muted: false,
    bright: -1,
    volLockUntil: 0,
    brightLockUntil: 0,
    peekUntil: 0,
    toast: null,
    toastUntil: 0,
    timer: { total: 0, remaining: 0, endAt: 0, running: false },
    dl: { active: false, title: '', tab: false }, // IDM Nova, filled by views/downloads.js
    features: {}, // switches from the Settings window; a missing key means on
    visible: true, // false while hidden (fullscreen app, or hidden from the menu)
    reminderUntil: 0, // a dhikr / du'a / verse card is on screen until then (views/reminders.js)
    reminderSize: [500, 140],
    sceneUntil: 0, // the island is a character (views/scene.js) until then
  };
  const feat = (key: string | undefined) => state.features[key as FeatureKey] !== false;

  // Good news: sparkles fly out of the island's edges.
  function celebrate(colors = ['#ffd479', '#30d158', '#8ab4ff', '#ff6b9d']) {
    if (!feat('celebrate') || anchor.vertical || !motionAllowed()) return;
    const r = island.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
      // start on the pill's outline, fly outward
      const sx = cx + (Math.cos(a) * r.width) / 2;
      const sy = cy + (Math.sin(a) * r.height) / 2;
      const dist = 18 + Math.random() * 34;
      const p = document.createElement('i');
      p.className = 'spark';
      p.style.cssText = `left:${sx}px;top:${sy}px;background:${colors[i % colors.length]};--s:${(3 + Math.random() * 3).toFixed(1)}px`;
      document.body.append(p);
      p.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(.2)`,
            opacity: 0,
          },
        ],
        { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' },
      ).onfinish = () => p.remove();
    }
  }

  // Things worth telling the user when they come back to the computer (views call note()).
  const happenings: { at: number; icon: string; text: string }[] = [];
  function note(icon: string, text: string) {
    happenings.push({ at: Date.now(), icon, text });
    if (happenings.length > 40) happenings.shift();
  }
  let internalDrag = false; // set by the shelf while dragging a file out

  const fmt = (sec: number) => {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };

  // ---------------- mode ----------------
  const SIZE: Record<string, number> = {
    idle: 1,
    compact: 2,
    toast: 3,
    peek: 4,
    reminder: 4,
    scene: 4,
    expanded: 5,
  };

  function timerActive() {
    return state.timer.running || state.timer.remaining > 0;
  }

  // What the compact pill shows, by priority: timer, playing media, a running download.
  function compactKind() {
    if (timerActive()) return 'timer';
    if (feat('mediaPill') && state.media.has && state.media.playing && !state.mediaFront) return 'media';
    if (state.dl.active) return 'dl';
    return '';
  }

  function currentMode() {
    const now = Date.now();
    if (state.overlay && !state.moving) return 'expanded';
    // a character scene (adhan, water, focus) owns the island until it ends or is closed
    if (state.sceneUntil > now && !anchor.vertical) return 'scene';
    // a presentation.toast with a button (Join) stays under the cursor so it can be clicked
    if (state.toastAction && state.toast && now < state.toastUntil && !state.pinned) return 'toast';
    // a reminder stays put under the cursor so it can be read (hovering pauses it)
    if (state.reminderUntil > now && !state.pinned && !state.dragging) {
      return state.toast && now < state.toastUntil ? 'toast' : 'reminder';
    }
    if (!state.moving && (state.hover || state.pinned || state.dragging)) return 'expanded';
    if (state.toast && now < state.toastUntil) return 'toast';
    if (now < state.peekUntil && !state.mediaFront) return 'peek';
    if (compactKind()) return 'compact';
    return 'idle';
  }

  let lastMode = '';
  function render() {
    island.classList.toggle('overlay-open', !!state.overlay);
    const mode = currentMode();
    if (mode !== lastMode) {
      island.classList.toggle('shrinking', !!lastMode && SIZE[mode] < SIZE[lastMode]);
      island.classList.remove('idle', 'compact', 'toast', 'peek', 'reminder', 'scene', 'expanded');
      island.classList.add(mode);
      const prev = lastMode;
      lastMode = mode;
      if (typeof positionIsland === 'function') positionIsland();
      if (typeof wake === 'function') wake();
      window.dispatchEvent(new CustomEvent('island:mode', { detail: { mode, prev } }));
    }
    island.classList.toggle('has-media', !!state.media.has);
    island.classList.toggle('playing', !!state.media.playing);
    const kind = compactKind();
    for (const el of [$('.l-compact'), $('.l-vcompact')]) {
      el.classList.toggle('timer', kind === 'timer');
      el.classList.toggle('dl', kind === 'dl');
    }
    const showTitle = kind === 'dl' || (kind === 'media' && feat('mediaTitle'));
    const wide = showTitle;
    if (wide !== island.classList.contains('c-wide')) {
      island.classList.toggle('c-wide', wide);
      if (typeof positionIsland === 'function') positionIsland();
    }
    setCompactTitle(!showTitle ? '' : kind === 'media' ? state.media.title : state.dl.title);
    $('.c-title').hidden = !showTitle;
  }

  // Title between the art and the equalizer; scrolls back and forth when it doesn't fit.
  let cTitle: string | null = null;
  let fitTimer: ReturnType<typeof setTimeout> | undefined;
  function setCompactTitle(text: string | undefined) {
    text = text || '';
    if (text === cTitle) return;
    cTitle = text;
    $('#c-title').textContent = text;
    fitCompactTitle();
  }
  function fitCompactTitle() {
    const box = $('.c-title');
    box.classList.remove('scroll');
    clearTimeout(fitTimer);
    // measure once the pill has finished morphing to its width
    fitTimer = setTimeout(() => {
      const span = $('#c-title');
      const over = span.scrollWidth - box.clientWidth;
      if (over <= 2 || lastMode !== 'compact') return;
      box.style.setProperty('--dist', `${-over - 12}px`);
      box.style.setProperty('--dur', `${Math.max(5, over / 22 + 3)}s`);
      box.classList.toggle('rtl', getComputedStyle(span).direction === 'rtl');
      box.classList.add('scroll');
    }, 560);
  }
  window.addEventListener('island:mode', (e) => {
    if (e.detail.mode === 'compact') fitCompactTitle();
  });

  // ---------------- hover (main process polls the cursor with hover intent) ----------------
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  bridge.onHover((v) => {
    clearTimeout(hoverTimer);
    if (v) {
      if (state.features.hoverExpand === false) return;
      state.hover = true;
      render();
    } else {
      hoverTimer = setTimeout(() => {
        state.hover = false;
        render();
      }, 160);
    }
  });

  let lastRect = '';
  function reportRect() {
    let r: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> = island.getBoundingClientRect();
    // during a scene the card beside the character must take the mouse too
    if (lastMode === 'scene') {
      const c = $('#scene-card').getBoundingClientRect();
      const left = Math.min(r.left, c.left);
      const top = Math.min(r.top, c.top);
      r = {
        left,
        top,
        width: Math.max(r.left + r.width, c.right) - left,
        height: Math.max(r.top + r.height, c.bottom) - top,
      };
    }
    const rect = {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
    const key = JSON.stringify(rect);
    if (key !== lastRect) {
      lastRect = key;
      bridge.setRect(rect);
    }
  }
  // Hit-test bounds only change during a morph, drag, or layout change (handled by frame()).

  bridge.onToggle(() => {
    if (state.overlay) {
      window.dispatchEvent(new Event('island:overlay-close'));
      state.pinned = false;
      state.hover = false;
      render();
      return;
    }
    state.pinned = !state.pinned;
    if (!state.pinned) state.hover = false;
    render();
  });

  // ---------------- drag to move (docks when dropped at the top edge) ----------------
  const NO_DRAG =
    'button, input, textarea, .slider, .file, .app, .pick, .picker, .clip-item, .shelf-items, .todo-item, .notes-textarea, .todo-list, .sw-laps, .tool-btn, .notification-center, .command-panel';
  let press: { x: number; y: number; id: number } | null = null;
  let justMoved = false;

  let pointerStartY = 0;
  let pointerStartX = 0;
  let isSwipeActive = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  island.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest<HTMLElement>(NO_DRAG)) return;
    press = { x: e.screenX, y: e.screenY, id: e.pointerId };
    pointerStartX = e.screenX;
    pointerStartY = e.screenY;
    isSwipeActive = true;

    if (lastMode !== 'expanded') {
      island.classList.add('holding');
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (isSwipeActive && !state.moving) {
          state.hover = true;
          island.classList.remove('holding');
          if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1100, 0.05);
          render();
        }
      }, 280);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!press || state.moving) {
      if (state.moving) isSwipeActive = false;
      return;
    }
    const dist = Math.hypot(e.screenX - press.x, e.screenY - press.y);
    if (dist < 5) return;

    const dy = e.screenY - pointerStartY;
    const dx = e.screenX - pointerStartX;

    if (isSwipeActive && Math.abs(dy) > Math.abs(dx) * 1.4) {
      if (lastMode !== 'expanded' && dy > 10) {
        island.style.transform = `scale(${1 + Math.min(dy * 0.002, 0.08)}, ${1 + Math.min(dy * 0.006, 0.25)}) translateY(${Math.min(dy * 0.5, 24)}px)`;
        return;
      }
      if (lastMode === 'expanded' && dy < -10) {
        island.style.transform = `scale(${1 + Math.max(dy * 0.001, -0.06)}) translateY(${Math.max(dy * 0.4, -20)}px)`;
        return;
      }
    }

    state.moving = true;
    isSwipeActive = false;
    clearTimeout(holdTimer);
    island.classList.remove('holding');
    island.style.transform = '';
    island.setPointerCapture(press.id);
    island.classList.add('moving');
    render();
    bridge.dragStart();
  });

  function endMove(e: PointerEvent) {
    clearTimeout(holdTimer);
    island.classList.remove('holding');
    if (isSwipeActive) {
      const dy = (e?.screenY ?? pointerStartY) - pointerStartY;
      island.style.transform = '';
      if (lastMode !== 'expanded' && dy > 28 && !state.moving) {
        state.hover = true;
        if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1050, 0.04);
        render();
      } else if (lastMode === 'expanded' && dy < -28 && !state.moving) {
        state.hover = false;
        state.pinned = false;
        if (typeof presentation.playClickSound === 'function') presentation.playClickSound(750, 0.04);
        render();
      }
    }
    isSwipeActive = false;

    if (state.moving) {
      state.moving = false;
      state.hover = false;
      justMoved = true;
      setTimeout(() => (justMoved = false), 50);
      island.classList.remove('moving');
      bridge.dragEnd();
      render();
    }
    press = null;
  }
  window.addEventListener('pointerup', endMove);
  island.addEventListener('lostpointercapture', endMove);

  // a plain click on the collapsed island opens it (also right after a move)
  island.addEventListener('click', (e) => {
    if (!justMoved && lastMode === 'toast' && state.toastAction) {
      const act = state.toastAction;
      state.toastAction = null;
      state.toastUntil = 0;
      render();
      act();
      return;
    }
    if (
      justMoved ||
      lastMode === 'expanded' ||
      lastMode === 'reminder' ||
      lastMode === 'scene' ||
      (e.target as Element).closest<HTMLElement>(NO_DRAG)
    )
      return;
    state.hover = true;
    render();
  });

  // --- middle click quick action ---
  island.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      // middle click
      e.preventDefault();
      if (state.media && state.media.has) {
        bridge.mediaCmd('toggle');
        if (typeof presentation.playClickSound === 'function') presentation.playClickSound(900, 0.04);
      } else {
        state.pinned = !state.pinned;
        if (!state.pinned) state.hover = false;
        render();
      }
    }
  });

  // --- double click to toggle expand / collapse ---
  island.addEventListener('dblclick', (e) => {
    if ((e.target as Element).closest<HTMLElement>(NO_DRAG)) return;
    state.pinned = !state.pinned;
    if (!state.pinned) state.hover = false;
    if (typeof presentation.playClickSound === 'function') presentation.playClickSound(950, 0.03);
    render();
  });

  // ---------------- placement inside the window ----------------
  // Main sends the pill's anchor (top-center) in window coordinates. Each mode is centered
  // on it, then pushed back inside the window, so near the bottom or the sides the island
  // opens upward / inward instead of off screen. Sizes mirror style.css.
  const DIMS: Record<string, number[]> = {
    idle: [226, 36],
    compact: [330, 38],
    toast: [380, 44],
    peek: [460, 92],
    expanded: [660, 350],
  };
  const COMPACT_WIDE = 420; // compact with a title (media / download)
  const VDIMS: Record<string, number[]> = { ...DIMS, idle: [44, 244], compact: [44, 136], toast: [44, 168] };
  let anchor: Anchor = { x: window.innerWidth / 2, y: 8, docked: false, vertical: false, side: 'right' };

  function positionIsland() {
    let [w, h] = (anchor.vertical ? VDIMS : DIMS)[lastMode] || DIMS.idle;
    if (lastMode === 'expanded')
      [w, h] = [state.features.panelWidth || 660, state.features.panelHeight || 350];
    if (lastMode === 'compact' && !anchor.vertical && island.classList.contains('c-wide')) w = COMPACT_WIDE;
    if (lastMode === 'reminder') [w, h] = state.reminderSize;
    // in the browser's address bar: a slim pill, or a thin line while the user types there
    if (anchor.addr && !anchor.vertical && (lastMode === 'idle' || lastMode === 'compact')) {
      [w, h] = anchor.addr === 'line' ? [90, 3] : [anchor.sw || 120, anchor.sh || 30];
    }
    if (lastMode === 'scene') {
      // the body on the right, the card on its left: [card 430][gap 22][body 64], kept inside the window
      const CW = 516;
      const left = Math.min(Math.max(anchor.x - CW / 2, 8), window.innerWidth - CW - 8);
      const top = anchor.docked ? 30 : Math.min(Math.max(anchor.y + 22, 10), window.innerHeight - 130);
      island.style.setProperty('--x', `${Math.round(left + CW - 64)}px`);
      island.style.setProperty('--y', `${Math.round(top)}px`);
      const card = $('#scene-card');
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top - 14)}px`;
      wake();
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    let x;
    let y;
    if (anchor.vertical) {
      // flush against the screen edge, centered on the anchor, kept inside the window
      x = anchor.side === 'left' ? 0 : W - w;
      y = clamp(anchor.y - h / 2, 4, H - h - 4);
    } else {
      x = clamp(anchor.x - w / 2, 4, W - w - 4);
      y = anchor.docked ? 0 : clamp(anchor.y, 0, H - h - 6);
    }
    island.style.setProperty('--x', `${Math.round(x)}px`);
    island.style.setProperty('--y', `${Math.round(y)}px`);
    wake(); // the glass must follow the island while it slides into place
  }

  bridge.onAnchor((a) => {
    anchor = a;
    island.classList.toggle('addr-slim', a.addr === 'slim');
    island.classList.toggle('addr-line', a.addr === 'line');
    if (a.addr) {
      island.style.setProperty('--sw', `${a.sw}px`);
      island.style.setProperty('--sh', `${a.sh}px`);
    }
    island.classList.toggle('docked', !!a.docked);
    island.classList.toggle('vertical', !!a.vertical);
    island.classList.toggle('side-left', !!a.vertical && a.side === 'left');
    island.classList.toggle('side-right', !!a.vertical && a.side === 'right');
    positionIsland();
  });

  island.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if ((e.target as Element).closest<HTMLElement>('.apps-grid, .file, input')) return;
    bridge.contextMenu();
  });

  // ---------------- glass backdrop ----------------
  const bd = $<HTMLCanvasElement>('#bd');
  const bdCtx = bd.getContext('2d')!;
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d')!;
  let fadeFrames = 0;

  function sizeCanvases() {
    [bd, off].forEach((c) => {
      // A blurred material needs half-resolution color, not a second full-resolution desktop.
      const solid = document.documentElement.dataset.transparency === 'reduced';
      c.width = solid ? 1 : Math.ceil(window.innerWidth / 2);
      c.height = solid ? 1 : Math.ceil(window.innerHeight / 2);
    });
    bd.style.width = `${window.innerWidth}px`;
    bd.style.height = `${window.innerHeight}px`;
  }
  sizeCanvases();
  window.addEventListener('resize', sizeCanvases);
  const releaseCanvases = () => {
    releaseIdleAudio();
    fadeFrames = 0;
    for (const canvas of [bd, off]) {
      canvas.width = 1;
      canvas.height = 1;
    }
  };
  bridge.performance.onRelease(releaseCanvases);
  document.addEventListener('appearance:change', () => {
    if (document.documentElement.dataset.transparency === 'reduced') releaseCanvases();
  });

  bridge.onBackdrop((url) => {
    if (!state.visible || document.hidden || document.documentElement.dataset.transparency === 'reduced')
      return;
    const img = new Image();
    img.onload = () => {
      if (!state.visible || document.hidden || document.documentElement.dataset.transparency === 'reduced')
        return;
      if (off.width === 1) sizeCanvases();
      const { width: w, height: h } = off;
      offCtx.filter = 'none';
      offCtx.drawImage(img, 0, 0, w, h);
      offCtx.filter = 'blur(11px) saturate(180%) brightness(.92)';
      offCtx.drawImage(img, -12, -12, w + 24, h + 24);
      fadeFrames = 10;
      wake(180);
    };
    img.src = url;
  });

  const segThumb = $('.seg-thumb');
  function placeSegThumb() {
    const a = $('.tab.active');
    if (!a) return;
    const width = `${a.offsetWidth}px`;
    const transform = `translateX(${a.offsetLeft}px)`;
    if (segThumb.style.width !== width) segThumb.style.width = width;
    if (segThumb.style.transform !== transform) segThumb.style.transform = transform;
  }

  // Opening a panel does not need an endless frame loop. Animate only while geometry or
  // glass changes; media time has its own low-frequency update below.
  let frameRunning = false;
  let frameId = 0;
  let awakeUntil = 0;
  function wake(ms = 900) {
    awakeUntil = Math.max(awakeUntil, performance.now() + (motionAllowed() ? ms : Math.min(ms, 32)));
    if (!frameRunning && state.visible && !document.hidden) {
      frameRunning = true;
      frameId = requestAnimationFrame(frame);
    }
  }

  function frame() {
    frameRunning = false;
    if (!state.visible || document.hidden) return;
    const r = island.getBoundingClientRect();
    bd.style.transform = `translate(${-r.left}px, ${-r.top}px)`;
    reportRect();
    if (fadeFrames > 0) {
      bdCtx.globalAlpha = fadeFrames === 1 ? 1 : 0.22;
      bdCtx.drawImage(off, 0, 0);
      fadeFrames--;
    }
    if (lastMode === 'expanded') {
      placeSegThumb();
    }
    if (fadeFrames > 0 || state.moving || performance.now() < awakeUntil) {
      frameRunning = true;
      frameId = requestAnimationFrame(frame);
    }
  }
  new ResizeObserver(() => wake()).observe(island);
  function syncVisibility() {
    const hidden = !state.visible || document.hidden;
    document.documentElement.dataset.pageHidden = String(hidden);
    if (hidden) {
      cancelAnimationFrame(frameId);
      frameRunning = false;
    } else {
      tickClock();
      wake();
    }
    window.dispatchEvent(new CustomEvent('island:visibility', { detail: !hidden }));
  }
  document.addEventListener('visibilitychange', syncVisibility);
  setInterval(() => {
    if (state.visible && !document.hidden && lastMode === 'expanded' && state.tab === 'media') tickProgress();
  }, 500);

  // ---------------- tabs ----------------
  $('.topbar .seg').addEventListener(
    'wheel',
    (event) => {
      const wheel = event as WheelEvent,
        nav = event.currentTarget as HTMLElement;
      if (nav.scrollWidth <= nav.clientWidth) return;
      event.preventDefault();
      event.stopPropagation();
      nav.scrollLeft += wheel.deltaX || wheel.deltaY;
    },
    { passive: false },
  );
  $$<HTMLButtonElement>('.tab').forEach((btn) =>
    btn.addEventListener('click', () => selectTab(btn.dataset.tab!)),
  );
  function selectTab(tab: string) {
    state.tab = tab;
    $$<HTMLButtonElement>('.tab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `v-${tab}`));
    wake(500);
    window.dispatchEvent(new CustomEvent('island:tab', { detail: tab }));
  }

  // ---------------- clock ----------------
  let lastClockKey = '';
  function tickClock() {
    if (!state.visible || document.hidden) return;
    const d = new Date();
    const key = `${Math.floor(+d / (state.features.clockSeconds ? 1000 : 60000))}:${state.features.clock24}`;
    if (key === lastClockKey) return;
    lastClockKey = key;
    const time = d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      ...(state.features.clock24 ? { hour12: false } : {}),
      ...(state.features.clockSeconds ? { second: '2-digit' } : {}),
    });
    const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    $('#x-clock').textContent = $('#i-time').textContent = time;
    $('#x-date').textContent = $('#i-date').textContent = date;
    $('#v-time').textContent = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    $('#v-day').textContent = d.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------- idle pill: rotates clock/weather, CPU/RAM and the next prayer ----------------
  let infoSlide = 0;
  setInterval(() => {
    if (!state.visible || document.hidden || lastMode !== 'idle') return;
    showSlide(infoSlide + 1);
  }, 6000);

  // Shows the n-th slide among those turned on; with all of them off the clock stays.
  function showSlide(n: number) {
    const all = [...$$('.info-slide')];
    let slides = all.filter((s) => !s.hidden && !s.classList.contains('off'));
    if (!slides.length) slides = [all[0]];
    infoSlide = n % slides.length;
    all.forEach((s) => s.classList.toggle('on', s === slides[infoSlide]));
  }

  bridge.onStats((s) => {
    const set = (id: string, v: number) => {
      $(`#i-${id}`).textContent = `${Math.round(v * 100)}%`;
      const bar = $(`#i-${id}-bar`);
      bar.style.width = `${Math.round(v * 100)}%`;
      bar.classList.toggle('warn', v >= 0.7 && v < 0.9);
      bar.classList.toggle('hot', v >= 0.9);
    };
    set('cpu', s.cpu);
    set('ram', s.ram);
    $('#v-cpu').textContent = `${Math.round(s.cpu * 100)}%`;
    $('#v-ram').textContent = `${Math.round(s.ram * 100)}%`;
  });

  const { showToast, showHud } = initializeNotifications({ $, state, render, feat });
  const { tickProgress } = initializeMedia({
    $,
    $$,
    bridge,
    island,
    state,
    feat,
    render,
    fmt,
    showToast,
    showHud,
    get lastMode() {
      return lastMode;
    },
  });

  // ---------------- file drag & drop (routes to the shelf) ----------------
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  function endDrop() {
    state.dragging = false;
    island.classList.remove('dropping');
    render();
  }
  window.addEventListener('dragenter', (e) => {
    // with the Shelf tab switched off the island doesn't take files at all
    if (internalDrag || !hasFiles(e) || !feat('tabShelf')) return;
    e.preventDefault();
    if (!state.dragging) {
      state.dragging = true;
      island.classList.add('dropping');
      selectTab('shelf');
      render();
    }
  });
  window.addEventListener('dragover', (e) => {
    if (internalDrag || !hasFiles(e) || !feat('tabShelf')) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) endDrop();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    endDrop();
    if (internalDrag || !files.length) return;
    if (!bridge.shelf.addFiles(files))
      showToast('dl-error', "Couldn't add these files to the shelf", '', 0, 3500);
  });
  document.addEventListener('pointermove', (e) => {
    if (internalDrag && e.buttons === 0) internalDrag = false;
  });

  const { drawTimer, focusing } = initializeFocusTimer({
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
  });

  // ---------------- settings ----------------
  const TAB_FEATURE: Record<string, string> = {
    media: 'tabMedia',
    apps: 'tabApps',
    shelf: 'tabShelf',
    tools: 'tabTools',
    notes: 'tabNotes',
    prayer: 'tabPrayer',
    quran: 'tabQuran',
    timer: 'tabTimer',
    system: 'tabSystem',
    toolkit: 'tabToolkit',
  };

  // Hide tabs that are switched off (Downloads shows itself only around download activity).
  function refreshTabs() {
    let changed = false;
    $$<HTMLButtonElement>('.tab').forEach((b) => {
      const t = b.dataset.tab;
      const hide = t === 'downloads' ? !state.dl.tab : !feat(TAB_FEATURE[t || '']);
      if (b.hidden !== hide) {
        b.hidden = hide;
        changed = true;
      }
    });
    if ($(`.tab[data-tab="${state.tab}"]`)?.hidden) {
      const first = [...$$<HTMLButtonElement>('.tab')].find((b) => !b.hidden);
      if (first) selectTab(first.dataset.tab!);
    } else if (changed) {
      placeSegThumb();
    }
  }

  let initialFeatures = true;
  function applyFeatures(f: Features) {
    f = effectiveFeatures(f);
    const defaultChanged = state.features.defaultTab !== f.defaultTab;
    state.features = f || {};
    island.style.setProperty('--panel-width', `${f.panelWidth || 660}px`);
    island.style.setProperty('--panel-height', `${f.panelHeight || 350}px`);
    island.style.setProperty('--panel-radius', `${f.cornerRadius || 40}px`);
    const tabs = $('.topbar .seg');
    tabOrder(f.tabOrder || '').forEach((id) => {
      const tab = tabs.querySelector(`[data-tab="${id}"]`);
      if (tab) tabs.append(tab);
    });
    $$('[data-feat]').forEach((el) => el.classList.toggle('off', !feat(el.dataset.feat)));
    if ($('.info-slide.on')?.classList.contains('off')) showSlide(0);
    refreshTabs();
    if (initialFeatures || defaultChanged) {
      initialFeatures = false;
      const preferred = document.querySelector<HTMLButtonElement>(`.tab[data-tab="${f.defaultTab}"]`);
      if (preferred && !preferred.hidden) selectTab(f.defaultTab);
    }
    render();
    positionIsland();
    tickClock();
    window.dispatchEvent(new CustomEvent('island:features', { detail: state.features }));
  }
  bridge.onFeatures(applyFeatures);
  bridge.onVisibility((v) => {
    state.visible = !!v;
    syncVisibility();
  });
  bridge.features().then(applyFeatures);
  $<HTMLButtonElement>('#open-settings').addEventListener('click', () => bridge.openSettings());

  selectTab('media');
  drawTimer();
  render();
  wake(1500);

  return {
    $,
    bridge,
    esc,
    island,
    ICON_X,
    get internalDrag() {
      return internalDrag;
    },
    set internalDrag(value: boolean) {
      internalDrag = value;
    },
    $$,
    state,
    feat,
    celebrate,
    render,
    note,
    showToast,
    playTones,
    fmt,
    compactKind,
    selectTab,
    refreshTabs,
    get lastMode() {
      return lastMode;
    },
    get anchor() {
      return anchor;
    },
    positionIsland,
    focusing,
    happenings,
  };
}
