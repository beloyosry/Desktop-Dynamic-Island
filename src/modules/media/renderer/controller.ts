import type { IslandContext } from '../../../renderer/island/context';
import type { MediaSnapshot } from '../domain/types';
import { makeSlider, throttle } from '../../../shared/renderer/slider';
import { volIconClass } from './volume-icon';

type Context = Pick<
  IslandContext,
  '$' | '$$' | 'bridge' | 'island' | 'state' | 'feat' | 'render' | 'lastMode' | 'fmt' | 'showToast'
> & { showHud(kind: string, value: number, muted?: boolean): void };
export function initializeMedia(context: Context) {
  const { $, $$, bridge, island, state, feat, render, fmt, showHud } = context;
  // ---------------- media ----------------
  const APP_NAMES: Record<string, string> = {
    spotify: 'Spotify',
    chrome: 'Chrome',
    msedge: 'Edge',
    firefox: 'Firefox',
    opera: 'Opera',
    vlc: 'VLC',
    zunemusic: 'Media Player',
    microsoftmediaplayer: 'Media Player',
    applemusic: 'Apple Music',
    brave: 'Brave',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    youtube: 'YouTube',
  };
  function appName(id: string | undefined) {
    if (!id) return '';
    const raw = id
      .split('!')
      .pop()!
      .split('\\')
      .pop()!
      .replace(/\.exe$/i, '');
    const key = raw.toLowerCase().replace(/[^a-z]/g, '');
    for (const k of Object.keys(APP_NAMES)) if (key.includes(k)) return APP_NAMES[k];
    return raw.split('.').pop()!;
  }

  function setAccent(r: number, g: number, b: number) {
    document.documentElement.style.setProperty(
      '--accent-rgb',
      `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`,
    );
  }

  function setAccentFromImage(img: HTMLImageElement) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 24;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 24, 24);
      const px = ctx.getImageData(0, 0, 24, 24).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < px.length; i += 4) {
        const max = Math.max(px[i], px[i + 1], px[i + 2]);
        const min = Math.min(px[i], px[i + 1], px[i + 2]);
        if (max < 50 || max - min < 30) continue; // skip dark / grey pixels
        const wgt = max - min; // favour saturated pixels
        r += px[i] * wgt;
        g += px[i + 1] * wgt;
        b += px[i + 2] * wgt;
        n += wgt;
      }
      if (!n) return setAccent(220, 220, 230);
      r /= n;
      g /= n;
      b /= n;
      const k = 235 / Math.max(r, g, b); // lift so the accent reads on dark glass
      setAccent(Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k));
    } catch {}
  }

  // Gradient tile with a note, used until (or when) the player provides no artwork.
  function placeholderArt(seed: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const ctx = c.getContext('2d')!;
    let h = 210;
    for (const ch of seed || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
    const g = ctx.createLinearGradient(0, 0, 160, 160);
    g.addColorStop(0, `hsl(${h}, 70%, 58%)`);
    g.addColorStop(1, `hsl(${(h + 45) % 360}, 65%, 28%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 160);
    ctx.translate(32, 32);
    ctx.scale(4, 4);
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.fill(new Path2D('M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z'));
    return c.toDataURL('image/png');
  }

  function setArt(url: string) {
    ['#c-art', '#vc-art', '#p-art', '#m-art', '#m-art-glow'].forEach(
      (s) => ($<HTMLImageElement>(s).src = url),
    );
    const img = new Image();
    img.onload = () => setAccentFromImage(img);
    img.src = url;
  }

  function setPlayingUI(playing: boolean) {
    const view = $('#v-media');
    view.classList.toggle('playing', playing);
    view.classList.toggle('paused', state.media.has && !playing);
    $$('.eq').forEach((e) => e.classList.toggle('paused', !playing));
  }

  // True while the user is looking at the player itself (e.g. the YouTube tab in Chrome),
  // so the island doesn't repeat what is already on screen.
  const BROWSERS = ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi'];
  const norm = (s: unknown) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  function isMediaInFront(m: MediaSnapshot) {
    if (!m.has || !m.fgProc) return false;
    const proc = m.fgProc.toLowerCase();
    const appId = (m.app || '').toLowerCase();
    const sameApp = appId.includes(proc) || (proc === 'firefox' && appId === '308046b0af4a39cb');
    if (!sameApp) return false;
    if (!BROWSERS.includes(proc)) return true;
    // browsers: only when the active tab is the one playing
    const title = norm(m.fgTitle);
    return (!!m.title && title.includes(norm(m.title))) || title.includes('youtube');
  }

  let lastTrack: string | null = null;
  bridge.onMedia((m) => {
    if (m.error) return;
    const lock = state.playLock;
    if (lock && Date.now() < lock.until && m.has && m.playing !== lock.value) {
      m.playing = lock.value;
      m.pos = mediaPos();
    } else if (lock && m.playing === lock.value) {
      state.playLock = null;
    }
    state.media = m;
    state.mediaAt = performance.now();
    state.mediaFront = isMediaInFront(m);

    const key = m.has ? `${m.title}|${m.artist}|${m.app}` : null;
    if (key !== lastTrack) {
      if (key && lastTrack && m.title && !state.mediaFront && feat('trackPeek')) {
        state.peekUntil = Date.now() + 3200;
        setTimeout(render, 3300);
      }
      lastTrack = key;
      if (key) setArt(placeholderArt((m.title || '') + (m.app || '')));
    }
    if (m.thumb) {
      setArt(`data:image/png;base64,${m.thumb}`);
    }

    if (m.has) {
      $('#m-title').textContent = $('#p-title').textContent = m.title || 'Unknown';
      const sub = m.artist || m.album || appName(m.app);
      $('#m-artist').textContent = $('#p-artist').textContent = sub;
      $('#p-eyebrow').textContent = appName(m.app) ? `Now Playing · ${appName(m.app)}` : 'Now Playing';
    }
    $('#x-app-name').textContent = m.has ? appName(m.app) || 'Media' : 'Idle';
    $('#v-media').classList.toggle(
      'browser-src',
      m.has &&
        BROWSERS.some((b) => (m.app || '').toLowerCase().includes(b)) &&
        !(m.app || '').toLowerCase().includes('firefox'),
    );
    $('#v-media').classList.toggle('none', !m.has);
    setPlayingUI(!!m.playing);
    $('#m-progress').classList.toggle('hidden', !(m.dur && m.dur > 0));

    handleVolume(m);
    handleBrightness(m);
    render();
  });

  function mediaPos() {
    const m = state.media;
    let pos = m.pos || 0;
    if (m.playing) pos += (performance.now() - state.mediaAt) / 1000;
    return Math.min(pos, m.dur || 0);
  }

  const seek = makeSlider($('#m-bar'), {
    onCommit: (v) => {
      const m = state.media;
      if (!m.has || !(m.dur && m.dur > 0)) return;
      const sec = v * m.dur;
      bridge.mediaCmd(`seek ${sec.toFixed(1)}`);
      state.media.pos = sec;
      state.mediaAt = performance.now();
    },
  });

  function tickProgress() {
    const m = state.media;
    if (!m.has || !(m.dur && m.dur > 0)) return;
    const pos = seek.dragging
      ? (parseFloat($('#m-bar').getAttribute('aria-valuenow') || '0') / 100) * m.dur
      : mediaPos();
    $('#m-pos').textContent = fmt(pos);
    $('#m-dur').textContent = `-${fmt(m.dur - pos)}`;
    if (!seek.dragging) seek.set(pos / m.dur);
  }

  $$('[data-cmd]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd!;
      bridge.mediaCmd(cmd);
      if (cmd === 'toggle' && state.media.has) {
        // optimistic UI; hold it until the player reports the new state (it lags ~0.5 s),
        // otherwise the island morphs back and forth for a moment
        state.media.pos = mediaPos();
        state.mediaAt = performance.now();
        state.media.playing = !state.media.playing;
        state.playLock = { value: state.media.playing, until: Date.now() + 1800 };
        setPlayingUI(state.media.playing);
        render();
      }
    }),
  );

  // ---------------- mini player ----------------
  const pipBtn = $<HTMLButtonElement>('#pip-btn');
  function flashError(text: string) {
    const el = $('#m-artist');
    const prev = el.textContent;
    el.textContent = text;
    el.classList.add('err');
    setTimeout(() => {
      el.classList.remove('err');
      el.textContent = prev;
    }, 3500);
  }
  pipBtn.addEventListener('click', async () => {
    const m = state.media;
    if (!m.has || pipBtn.classList.contains('busy')) return;
    pipBtn.classList.add('busy');
    const res = await bridge.miniOpen({ app: m.app, title: m.title, pos: mediaPos(), playing: !!m.playing });
    pipBtn.classList.remove('busy');
    if (!res?.ok) {
      flashError(
        res?.error === 'no-url'
          ? "Couldn't find this video's YouTube link"
          : 'Works with YouTube in Chrome, Edge or Brave',
      );
      return;
    }
    state.hover = false;
    state.pinned = false;
    render();
  });

  // ---------------- volume ----------------
  const sendVol = throttle((v) => bridge.mediaCmd(`vol ${v.toFixed(3)}`), 60);
  function setVolume(v: number) {
    state.vol = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
    state.muted = false;
    state.volLockUntil = Date.now() + 900;
    volSlider.set(state.vol);
    showVolPct(state.vol, false);
    sendVol(state.vol);
  }
  function showVolPct(vol: number, muted: boolean) {
    volIconClass($('.vol'), vol, muted);
    $('#vol-pct').textContent = muted ? 'Muted' : `${Math.round(vol * 100)}%`;
  }
  const volSlider = makeSlider($('#vol-slider'), { onInput: setVolume });

  $<HTMLButtonElement>('#vol-btn').addEventListener('click', () => {
    state.muted = !state.muted;
    state.volLockUntil = Date.now() + 900;
    showVolPct(state.vol ?? 0, state.muted);
    bridge.mediaCmd('mute');
  });

  island.addEventListener(
    'wheel',
    (e) => {
      if (
        !feat('wheelVolume') ||
        (e.target as Element).closest<HTMLElement>(
          '.picker-list, .clip-list, .shelf-items, .todo-list, .notes-textarea, .sw-laps',
        ) ||
        state.vol === null
      )
        return;
      e.preventDefault();
      // proportional to the scroll distance: one mouse notch ≈ 3%, touchpads move in fine steps
      const perPx = e.deltaMode === 1 ? 0.01 : 0.0003;
      const step = Math.max(-0.05, Math.min(0.05, -e.deltaY * perPx));
      setVolume(state.vol + step);
      if (state.tab !== 'media' || context.lastMode !== 'expanded') showHud('vol', state.vol, false);
    },
    { passive: false },
  );

  function handleVolume(m: MediaSnapshot) {
    if (typeof m.vol !== 'number') return;
    const locked = Date.now() < state.volLockUntil;
    const changed = state.vol !== null && (Math.abs(m.vol - state.vol) > 0.004 || !!m.muted !== state.muted);
    if (locked) return;
    state.vol = m.vol;
    state.muted = !!m.muted;
    if (!volSlider.dragging) volSlider.set(m.vol);
    showVolPct(m.vol, state.muted);
    if (changed && !(context.lastMode === 'expanded' && state.tab === 'media'))
      showHud('vol', m.vol, state.muted);
  }

  // ---------------- brightness ----------------
  const sendBright = throttle((v) => bridge.mediaCmd(`bright ${Math.round(v * 100)}`), 150);
  const brightSlider = makeSlider($('#bright-slider'), {
    onInput: (v) => {
      state.bright = Math.round(v * 100);
      state.brightLockUntil = Date.now() + 2500;
      $('#bright-val').textContent = `${state.bright}%`;
      sendBright(v);
    },
  });

  function handleBrightness(m: MediaSnapshot) {
    if (typeof m.bright !== 'number') return;
    $('#bright-row').hidden = m.bright < 0;
    if (m.bright < 0 || Date.now() < state.brightLockUntil) return;
    const changed = state.bright >= 0 && m.bright !== state.bright;
    state.bright = m.bright;
    if (!brightSlider.dragging) brightSlider.set(m.bright / 100);
    $('#bright-val').textContent = `${m.bright}%`;
    if (changed && context.lastMode !== 'expanded') showHud('bright', m.bright / 100);
  }

  return { tickProgress };
}
