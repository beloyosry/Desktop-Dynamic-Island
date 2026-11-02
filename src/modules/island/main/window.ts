import { BrowserWindow, screen, ipcMain, shell, desktopCapturer, nativeTheme } from 'electron';
import path from 'node:path';
import { errorMessage } from '../../../shared/errors';
import { appPath, rendererPath, preloadPath } from '../../../platform/electron/paths';
import type { SettingsStore } from '../../../shared/contracts/storage';
import type { Features } from '../../settings/domain/features';
import type { EventSender } from '../../../shared/contracts/events';
import type { AddressBar } from '../../media/domain/types';

interface Dependencies {
  settings: SettingsStore;
  features: { get(): Features };
  onGeneralChange(): void;
}
export function createIslandWindow({ settings, features, onGeneralChange }: Dependencies) {
  const WIN_W = 760;
  const WIN_H = 440;
  const hoverIntentMs = () => features.get().hoverDelay;

  let win: BrowserWindow | null = null;
  let userHidden = false;
  let fullscreenHidden = false;
  let systemPaused = false;
  let onBattery = false;
  let cursorDirty = true;
  let lastCursor: Electron.Point | null = null;
  let lastPointerMovement = 0;
  let prefs: {
    ax: number | null;
    ay: number | null;
    docked: boolean;
    vertical: boolean;
    side: string;
    placed?: boolean;
  } = Object.assign(
    { ax: null, ay: null, docked: false, vertical: false, side: 'right' },
    settings.load('settings.json', {}),
  );

  // The island's position is an "anchor": the top-center of the collapsed pill, in screen
  // coordinates. The window (always fully on screen) follows it, and the renderer places the
  // island inside the window so it expands toward the free space near screen edges.
  const PILL_HALF_W = 120; // half of the widest collapsed pill (keep in sync with style.css)
  const PILL_H = 34;
  const FLOAT_TOP = 8; // gap above a floating island inside the window
  const SNAP_PX = 28; // distance from the top edge that docks the island
  const CENTER_SNAP_PX = 40; // horizontal magnet to the screen center while docked
  // In vertical mode the anchor is the middle of the pill on the left or right screen edge.
  const V_PILL_HALF_H = 124;

  let anchor: Electron.Point | null = null;
  let lastLayout = '';

  // Pages never open windows or navigate inside the app; web links go to the default browser.
  function lockNavigation(contents: Electron.WebContents, isOwnPage: (url: string) => boolean) {
    const external = (url: string) => {
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    };
    contents.setWindowOpenHandler(({ url }) => {
      external(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (e, url) => {
      if (isOwnPage(url)) return;
      e.preventDefault();
      external(url);
    });
  }

  const send: EventSender = (channel, data?) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  function defaultAnchor() {
    const { bounds } = screen.getPrimaryDisplay();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + FLOAT_TOP };
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.min(Math.max(v, lo), hi);
  }

  // Clamp the anchor to the display, position the window around it and tell the renderer
  // where the pill sits inside the window.
  // --- the address bar slot ---
  // While a Chromium browser is in front the island takes the right third of its address bar
  // (the user's split: two thirds for the address, one third for the island); it shrinks to a
  // thin line while the user types there. The user's own position is untouched and comes back
  // as soon as the browser isn't in front.
  // Only from the island's default place: never while vertical or after the user put it somewhere.
  let omni: AddressBar | null = null;
  let omniKey = '';
  const omniAllowed = () => features.get().addrIsland && !prefs.vertical && !prefs.placed;
  function onOmni(o: AddressBar | null) {
    const next = o && omniAllowed() ? o : null;
    const key = next ? `${next.x},${next.y},${next.w},${next.h},${next.focus}` : '';
    if (key === omniKey) return;
    omniKey = key;
    omni = next;
    layout();
  }

  function layoutAddressBar() {
    if (!win || !omni) return;
    // the helper reports physical pixels; Electron places windows in DIPs
    const r = screen.screenToDipRect(null, { x: omni.x, y: omni.y, width: omni.w, height: omni.h });
    const b = screen.getDisplayMatching(r).bounds;
    const third = r.width / 3;
    const sh = Math.round(Math.min(30, Math.max(22, r.height + 6)));
    const sw = Math.round(Math.min(third - 12, 380));
    const cx = r.x + r.width - third / 2; // centre of the right third
    const top = Math.round(r.y + r.height / 2 - sh / 2);
    const wx = Math.round(clamp(cx - WIN_W / 2, b.x, b.x + b.width - WIN_W));
    const wy = Math.round(clamp(top - FLOAT_TOP, b.y, b.y + b.height - WIN_H));
    const cur = win.getBounds();
    if (cur.x !== wx || cur.y !== wy || cur.width !== WIN_W || cur.height !== WIN_H) {
      win.setBounds({ x: wx, y: wy, width: WIN_W, height: WIN_H });
    }
    const msg = {
      x: Math.round(cx - wx),
      y: top - wy,
      docked: false,
      vertical: false,
      side: prefs.side,
      addr: omni.focus ? 'line' : 'slim',
      sw,
      sh,
    };
    const key = JSON.stringify(msg);
    if (key !== lastLayout) {
      lastLayout = key;
      send('anchor', msg);
    }
  }

  function layout() {
    if (!win || !anchor) return;
    // not while the user drags the island somewhere else
    if (omni && !drag && omniAllowed()) {
      layoutAddressBar();
      return;
    }
    const display = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: Math.round(anchor.y) });
    const b = display.bounds;
    const wa = display.workArea;
    let wx;
    let wy;
    if (prefs.vertical) {
      anchor.x = prefs.side === 'left' ? b.x : b.x + b.width;
      anchor.y = clamp(anchor.y, wa.y + V_PILL_HALF_H, wa.y + wa.height - V_PILL_HALF_H);
      wx = prefs.side === 'left' ? b.x : b.x + b.width - WIN_W;
      wy = Math.round(clamp(anchor.y - WIN_H / 2, wa.y, wa.y + wa.height - WIN_H));
    } else {
      anchor.x = clamp(anchor.x, b.x + PILL_HALF_W, b.x + b.width - PILL_HALF_W);
      anchor.y = prefs.docked ? b.y : clamp(anchor.y, b.y, wa.y + wa.height - PILL_H - 6);
      wx = Math.round(clamp(anchor.x - WIN_W / 2, b.x, b.x + b.width - WIN_W));
      wy = Math.round(prefs.docked ? b.y : clamp(anchor.y - FLOAT_TOP, b.y, wa.y + wa.height - WIN_H));
    }
    const cur = win.getBounds();
    if (cur.x !== wx || cur.y !== wy || cur.width !== WIN_W || cur.height !== WIN_H) {
      win.setBounds({ x: wx, y: wy, width: WIN_W, height: WIN_H });
    }
    const msg = {
      x: Math.round(anchor.x - wx),
      y: Math.round(anchor.y - wy),
      docked: !prefs.vertical && prefs.docked,
      vertical: prefs.vertical,
      side: prefs.side,
    };
    const key = JSON.stringify(msg);
    if (key !== lastLayout) {
      lastLayout = key;
      send('anchor', msg);
    }
  }

  function placeWindow() {
    if (!win) return;
    anchor =
      Number.isFinite(prefs.ax) && Number.isFinite(prefs.ay)
        ? { x: prefs.ax!, y: prefs.ay! }
        : defaultAnchor();
    // settings from before "placed" existed: judge by where the island is
    if (typeof prefs.placed !== 'boolean') prefs.placed = !atDefaultPlace();
    layout();
  }

  // the island's own spot: horizontal, at the top, centered on its display
  function atDefaultPlace() {
    if (prefs.vertical || !anchor) return false;
    const b = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: Math.round(anchor.y) }).bounds;
    return Math.abs(anchor.x - (b.x + b.width / 2)) < 2 && anchor.y - b.y <= FLOAT_TOP + 2;
  }

  function savePosition() {
    if (!anchor) return;
    prefs.ax = Math.round(anchor.x);
    prefs.ay = Math.round(anchor.y);
    settings.save('settings.json', prefs);
  }

  function resetPosition() {
    prefs.docked = false;
    prefs.vertical = false;
    prefs.placed = false;
    anchor = defaultAnchor();
    layout();
    savePosition();
    onGeneralChange();
  }

  // Switch between the horizontal island and a vertical one docked to the nearest side.
  function setVertical(on: boolean) {
    if (!anchor || on === prefs.vertical) return;
    const b = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: Math.round(anchor.y) }).bounds;
    if (on) {
      prefs.side = anchor.x < b.x + b.width / 2 ? 'left' : 'right';
      anchor = { x: anchor.x, y: anchor.y + V_PILL_HALF_H };
    } else {
      prefs.docked = false;
      const x = prefs.side === 'left' ? b.x + 260 : b.x + b.width - 260;
      anchor = { x, y: anchor.y - V_PILL_HALF_H };
    }
    prefs.vertical = on;
    // leaving the address bar at once (it would otherwise stay until the bar itself changes)
    if (on) {
      omni = null;
      omniKey = '';
    }
    layout();
    savePosition();
    onGeneralChange();
  }

  // --- dragging ---
  // The renderer reports drag start/end; while dragging the window follows the cursor.
  let drag: { ox: number; oy: number; timer: ReturnType<typeof setInterval> } | null = null;
  let dragFrom: Electron.Point | null = null;
  ipcMain.on('drag-start', () => {
    if (!win || drag || !anchor) return;
    const p = screen.getCursorScreenPoint();
    dragFrom = { ...anchor };
    // grab the (shrinking) pill near where it was pressed so it stays under the cursor
    const ox = clamp(p.x - anchor.x, -PILL_HALF_W + 16, PILL_HALF_W - 16);
    const oy = prefs.vertical
      ? clamp(p.y - anchor.y, -V_PILL_HALF_H + 20, V_PILL_HALF_H - 20)
      : clamp(p.y - anchor.y, 4, PILL_H - 6);
    drag = { ox, oy, timer: setInterval(followCursor, 8) };
  });

  function followCursor() {
    if (!drag || !win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = screen.getDisplayNearestPoint(p).bounds;
    if (prefs.vertical) {
      // slides along the edge; crossing the middle of the screen moves it to the other side
      prefs.side = p.x < b.x + b.width / 2 ? 'left' : 'right';
      anchor = { x: p.x, y: p.y - drag.oy };
      layout();
      return;
    }
    const next = { x: p.x - drag.ox, y: p.y - drag.oy };
    const docked = next.y - b.y < SNAP_PX;
    if (docked) {
      next.y = b.y;
      const center = b.x + b.width / 2;
      if (Math.abs(next.x - center) < CENTER_SNAP_PX) next.x = center;
    }
    prefs.docked = docked;
    anchor = next;
    layout();
  }

  ipcMain.on('drag-end', () => {
    if (!drag) return;
    clearInterval(drag.timer);
    drag = null;
    // a real move decides whether the island stays where the user put it (no address-bar jump)
    if (anchor && dragFrom && Math.hypot(anchor.x - dragFrom.x, anchor.y - dragFrom.y) > 20)
      prefs.placed = !atDefaultPlace();
    dragFrom = null;
    savePosition();
    captureBackdrop(); // refresh the glass for the new spot right away
    // don't pop the island open right after a move; re-arm when the cursor leaves
    suppressUntilLeave = true;
    send('hover', false);
  });

  function updateVisibility() {
    if (!win) return;
    const shouldShow = !systemPaused && !userHidden && !(fullscreenHidden && features.get().hideFullscreen);
    if (shouldShow && !win.isVisible()) win.showInactive();
    if (!shouldShow && win.isVisible()) win.hide();
    send('visibility', shouldShow);
    scheduleCapture(300);
  }

  function createWindow() {
    win = new BrowserWindow({
      width: WIN_W,
      height: WIN_H,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      backgroundColor: '#00000000',
      icon: appPath('build', 'icon.ico'),
      webPreferences: {
        preload: preloadPath('island'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);
    win.setIgnoreMouseEvents(true);
    // keep the island out of screen captures so the glass backdrop shows what is behind it
    win.setContentProtection(true);
    placeWindow();
    win.webContents.on('preload-error', (_e, p, err) => console.error('[preload-error]', p, err));
    win.webContents.on('console-message', (e, level, message, line, source) => {
      // Electron 35+ passes one event object with string levels; older versions passed arguments
      const lv = typeof e.level === 'string' ? e.level : level;
      const msg = e.message ?? message;
      const src = e.sourceId ?? source;
      const ln = e.lineNumber ?? line;
      if (lv === 'warning' || lv === 'error' || (typeof lv === 'number' && lv >= 2))
        console.error('[renderer]', msg, src ? `(${path.basename(src)}:${ln})` : '');
    });
    // absolute: when started through the resources/app stub the app root isn't this folder
    lockNavigation(win.webContents, (url) => url.startsWith('file:'));
    win.loadFile(rendererPath('island'));
    win.webContents.on('did-finish-load', () => {
      lastLayout = '';
      layout();
    });
    win.on('show', () => {
      cursorDirty = true;
      send('visibility', true);
      scheduleCapture(300);
    });
    win.on('hide', () => {
      send('visibility', false);
      scheduleCapture(0);
    });
    win.on('move', () => {
      cursorDirty = true;
    });
    win.on('closed', () => {
      clearTimeout(captureTimer);
      captureGeneration++;
      clearInterval(drag?.timer);
      win = null;
    });
    win.once('ready-to-show', updateVisibility);
    nativeTheme.on('updated', () => scheduleCapture(300));
  }

  // --- glass backdrop ---
  // CSS backdrop-filter cannot see other windows, so capture the screen area under the
  // island at low resolution and let the renderer blur it.
  // The backdrop is re-captured often while the island is open or changing shape, rarely while
  // it sits collapsed, and not at all while hidden; an unchanged picture is not re-sent.
  const CAPTURE_ACTIVE_MS = 1500;
  const CAPTURE_IDLE_MS = 15000;
  let capturing = false;
  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let captureGeneration = 0;
  let lastCaptureKey = '';
  let busyUntil = 0; // shape changed recently
  const canCapture = () =>
    !!win &&
    !win.isDestroyed() &&
    win.isVisible() &&
    !systemPaused &&
    !features.get().boostMode &&
    !features.get().reduceTransparency &&
    !nativeTheme.prefersReducedTransparency &&
    !nativeTheme.shouldUseHighContrastColors;
  function scheduleCapture(ms: number) {
    clearTimeout(captureTimer);
    const generation = ++captureGeneration;
    if (!canCapture()) return;
    captureTimer = setTimeout(async () => {
      await captureBackdrop();
      if (generation !== captureGeneration) return;
      const interacting = active && Date.now() - lastPointerMovement < 2000;
      scheduleCapture(
        (interacting || Date.now() < busyUntil ? CAPTURE_ACTIVE_MS : CAPTURE_IDLE_MS) * (onBattery ? 2 : 1),
      );
    }, ms);
  }
  async function captureBackdrop() {
    // skipped while dragging: a capture blocks the main thread and makes the move stutter
    if (capturing || drag || !canCapture() || !win) return;
    capturing = true;
    try {
      const display = screen.getDisplayMatching(win.getBounds());
      // Glass needs color and light, not desktop detail. Bound the capture even on 4K/8K displays.
      const scale = Math.min(1 / 4, 960 / Math.max(display.bounds.width, display.bounds.height));
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false,
        thumbnailSize: {
          width: Math.round(display.bounds.width * scale),
          height: Math.round(display.bounds.height * scale),
        },
      });
      if (!canCapture() || !win || drag) return;
      const src = sources.find((s) => s.display_id === String(display.id)) || sources[0];
      if (!src || src.thumbnail.isEmpty()) return;
      const k = src.thumbnail.getSize().width / display.bounds.width;
      const b = win.getBounds();
      const crop = src.thumbnail.crop({
        x: Math.round((b.x - display.bounds.x) * k),
        y: Math.round((b.y - display.bounds.y) * k),
        width: Math.round(b.width * k),
        height: Math.round(b.height * k),
      });
      // cheap fingerprint: sample the small bitmap instead of hashing all of it
      const bmp = crop.toBitmap();
      let key = `${bmp.length}`;
      for (let i = 0; i < bmp.length; i += 997) key += bmp[i].toString(36);
      if (key === lastCaptureKey) return;
      lastCaptureKey = key;
      send('backdrop', crop.toDataURL());
    } catch (err) {
      console.error('[backdrop]', errorMessage(err));
    } finally {
      capturing = false;
    }
  }

  // --- hover detection with intent ---
  // Forwarded mouse events are unreliable on transparent windows, so poll the cursor.
  // The island only becomes interactive after the cursor rests on it, so a quick sweep
  // to a browser tab underneath never gets caught.
  let islandRect = { x: 0, y: 0, width: 0, height: 0 };
  let inside = false;
  let active = false;
  let enteredAt = 0;
  let suppressUntilLeave = false;

  ipcMain.on('island-rect', (_e, r) => {
    cursorDirty = true;
    const resized = r.width !== islandRect.width || r.height !== islandRect.height;
    islandRect = r;
    if (resized) {
      busyUntil = Date.now() + 2000;
      scheduleCapture(120);
    }
  });

  function setActive(on: boolean) {
    if (!win) return;
    if (on === active) return;
    active = on;
    win.setIgnoreMouseEvents(!on);
    if (on) scheduleCapture(60);
    if (!on && win.isFocusable()) win.setFocusable(false);
    send('hover', on);
  }

  // Nova's eyes follow the cursor while it is near the island (sent only on real movement).
  const NEAR_PX = 260;
  let nearSent: { dx: number; dy: number } | null = null;
  function sendNear(x: number, y: number) {
    if (features.get().boostMode || !features.get().novaEyes || !islandRect.width) return;
    const dx = Math.round(x - (islandRect.x + islandRect.width / 2));
    const dy = Math.round(y - (islandRect.y + islandRect.height / 2));
    const near = Math.hypot(dx, dy) < NEAR_PX;
    if (!near) {
      if (nearSent) send('near', null);
      nearSent = null;
      return;
    }
    if (nearSent && Math.abs(nearSent.dx - dx) < 3 && Math.abs(nearSent.dy - dy) < 3) return;
    nearSent = { dx, dy };
    send('near', nearSent);
  }

  function pollCursor() {
    if (!win || win.isDestroyed() || !win.isVisible() || drag) return;
    const p = screen.getCursorScreenPoint();
    const moved = !lastCursor || p.x !== lastCursor.x || p.y !== lastCursor.y;
    if (moved) lastPointerMovement = Date.now();
    if (!moved && !cursorDirty) {
      // A stationary cursor still completes hover intent, but needs no native bounds lookup.
      if (inside && !active && !suppressUntilLeave && Date.now() - enteredAt >= hoverIntentMs())
        setActive(true);
      return;
    }
    cursorDirty = false;
    lastCursor = p;
    const b = win.getBounds();
    const x = p.x - b.x;
    const y = p.y - b.y;
    sendNear(x, y);
    const pad = active ? 8 : 2;
    const now =
      x >= islandRect.x - pad &&
      x <= islandRect.x + islandRect.width + pad &&
      y >= islandRect.y - pad &&
      y <= islandRect.y + islandRect.height + pad;
    if (now && !inside) enteredAt = Date.now();
    inside = now;
    if (!now) {
      suppressUntilLeave = false;
      setActive(false);
    } else if (!active && !suppressUntilLeave && Date.now() - enteredAt >= hoverIntentMs()) {
      setActive(true);
    }
  }

  // Text inputs (app search) need keyboard focus; the window is otherwise non-focusable.
  ipcMain.on('focus-input', (_e, on) => {
    if (!win) return;
    win.setFocusable(!!on);
    if (on) win.focus();
  });

  return {
    send,
    createWindow,
    layout,
    setVertical,
    resetPosition,
    pollCursor,
    scheduleCapture,
    invalidateBackdrop() {
      lastCaptureKey = '';
      scheduleCapture(300);
    },
    onOmni,
    get window() {
      return win;
    },
    get prefs() {
      return prefs;
    },
    get hidden() {
      return userHidden;
    },
    setHidden(hidden: boolean) {
      userHidden = hidden;
      updateVisibility();
    },
    setFullscreen(hidden: boolean) {
      if (hidden !== fullscreenHidden) {
        fullscreenHidden = hidden;
        updateVisibility();
      }
    },
    setSystemPaused(paused: boolean) {
      systemPaused = paused;
      updateVisibility();
    },
    setOnBattery(value: boolean) {
      onBattery = value;
      scheduleCapture(300);
    },
    updateFeatures() {
      cursorDirty = true;
      if (!features.get().addrIsland && omni) {
        omni = null;
        omniKey = '';
        layout();
      }
      updateVisibility();
    },
  };
}
