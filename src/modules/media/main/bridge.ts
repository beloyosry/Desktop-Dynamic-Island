import { ipcMain } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { helperPath } from '../../../platform/electron/paths';
import { errorMessage } from '../../../shared/errors';
import * as mini from '../../mini-player/main/window';
import type { EventSender } from '../../../shared/contracts/events';
import type { AddressBar } from '../domain/types';
interface Dependencies {
  send: EventSender;
  onClipboardSeq(sequence: number, isPrivate: boolean): void;
  onOmni(bar: AddressBar | null): void;
  onFullscreen(hidden: boolean): void;
}
export function createMediaBridge({ send, onClipboardSeq, onOmni, onFullscreen }: Dependencies) {
  let media: ChildProcessWithoutNullStreams | null = null;
  let quitting = false;
  // --- system bridge: helper/nova-helper.exe (SMTC media, volume, brightness, fullscreen,
  // window in front, keyboard, clipboard sequence, idle time). Compiled C#, no PowerShell. ---
  const HELPER = helperPath;

  // Health of the bridge, shown in Settings (antivirus may block the helper).
  const bridge = { state: 'starting', detail: '', lastLine: 0, engine: 'helper' };
  function bridgeStatus() {
    const fresh = Date.now() - bridge.lastLine < 10000;
    return {
      state: fresh ? 'ok' : bridge.state === 'starting' ? 'starting' : 'failed',
      detail: bridge.detail,
      engine: bridge.engine,
    };
  }

  function startMedia() {
    media = spawn(HELPER(), [], { windowsHide: true });
    let buffer = '';
    media.on('error', (err) => {
      console.error('[media] failed to start:', errorMessage(err));
      bridge.state = 'failed';
      bridge.detail = errorMessage(err);
    });
    media.stderr.setEncoding('utf8');
    media.stderr.on('data', (d) => {
      console.error('[media]', d.trim());
      bridge.detail = d.trim().split('\n')[0].slice(0, 200);
    });
    media.stdout.setEncoding('utf8');
    media.stdout.on('data', (chunk) => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).replace(/^﻿/, '').trim();
        buffer = buffer.slice(i + 1);
        if (!line.startsWith('{')) continue;
        try {
          const data = JSON.parse(line);
          bridge.lastLine = Date.now();
          bridge.state = 'ok';
          if (data.error) console.error('[media]', data.error);
          if (typeof data.clip === 'number') onClipboardSeq(data.clip, !!data.clipPriv);
          if ('omni' in data) onOmni(data.omni);
          if (typeof data.fs === 'boolean') onFullscreen(data.fs);
          send('media', data);
        } catch {}
      }
    });
    media.on('exit', (code) => {
      media = null;
      if (Date.now() - bridge.lastLine > 10000) {
        bridge.state = 'failed';
        bridge.detail ||= `helper exited (code ${code})`;
      }
      if (!quitting) setTimeout(startMedia, 3000);
    });
  }

  const MEDIA_CMD = /^(toggle|next|prev|mute|seek \d+(\.\d+)?|vol [01](\.\d+)?|bright \d{1,3})$/;
  ipcMain.on('media-cmd', (_e, cmd) => {
    if (media && typeof cmd === 'string' && MEDIA_CMD.test(cmd)) media.stdin.write(cmd + '\n');
  });

  function mediaWrite(cmd: string) {
    if (media) media.stdin.write(cmd + '\n');
  }

  // --- mini player (pop a YouTube video out of the browser) ---
  const BROWSER_PROCS = ['chrome', 'msedge', 'brave', 'vivaldi', 'opera'];
  const APP_ID = /^[\w.!-]+$/;

  function browserProc(appId: string) {
    const id = String(appId || '').toLowerCase();
    return BROWSER_PROCS.find((p) => id.includes(p)) || null;
  }

  function findTabUrl(proc: string, title: string) {
    return new Promise<string>((resolve) => {
      const ps = spawn(HELPER(), ['yturl', proc, String(title || '').slice(0, 200)], { windowsHide: true });
      let out = '';
      const timer = setTimeout(() => ps.kill(), 10000);
      ps.on('error', () => resolve(''));
      ps.stdout.setEncoding('utf8');
      ps.stdout.on('data', (d) => (out += d));
      ps.on('exit', () => {
        clearTimeout(timer);
        try {
          const r = JSON.parse(out.replace(/^﻿/, '').trim());
          resolve(r.url || '');
        } catch {
          resolve('');
        }
      });
    });
  }

  function youtubeId(url: string) {
    const m = String(url).match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  ipcMain.handle('mini-open', async (_e, req) => {
    const appId = String(req?.app || '');
    const proc = browserProc(appId);
    if (!proc || !APP_ID.test(appId)) return { ok: false, error: 'not-browser' };
    const pos = Math.max(0, Number(req.pos) || 0);
    const wasPlaying = !!req.playing;

    // pause first so the tab stops exactly where the mini player will pick up
    mediaWrite(`pauseapp ${appId}`);
    const url = await findTabUrl(proc, req.title);
    const id = youtubeId(url);
    if (!id) {
      if (wasPlaying) mediaWrite(`playapp ${appId}`);
      return { ok: false, error: 'no-url' };
    }

    await mini.open({
      id,
      t: pos,
      appId,
      title: String(req.title || ''),
      onClose: (time, resume) => {
        // back in the tab at the second the mini player reached
        mediaWrite(`seekapp ${appId} ${Math.max(0, time).toFixed(2)}`);
        if (resume) setTimeout(() => mediaWrite(`playapp ${appId}`), 250);
      },
    });
    return { ok: true };
  });

  return {
    start: startMedia,
    write: mediaWrite,
    status: bridgeStatus,
    stop() {
      quitting = true;
      media?.kill();
    },
  };
}
