import { errorMessage } from '../../../shared/errors';
// Quick Desktop Utilities and Control Center for Dynamic Island Pro
import { spawn } from 'child_process';
import { desktopCapturer, clipboard, ClipboardItem } from 'electron';

function takeSnip() {
  try {
    spawn('explorer.exe', ['ms-screenclip:']);
    return { ok: true, mode: 'snip' };
  } catch (err) {
    console.error('[tools] snip error:', errorMessage(err));
    return { ok: false, error: errorMessage(err) };
  }
}

async function captureFullScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources && sources.length > 0) {
      const img = sources[0].thumbnail;
      await clipboard.write([
        new ClipboardItem({ 'image/png': new Blob([new Uint8Array(img.toPNG())], { type: 'image/png' }) }),
      ]);
      return { ok: true, mode: 'full' };
    }
    return { ok: false, error: 'No screen source found' };
  } catch (err) {
    console.error('[tools] capture error:', errorMessage(err));
    return { ok: false, error: errorMessage(err) };
  }
}

function emptyRecycleBin() {
  try {
    spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[tools] empty trash error:', errorMessage(err));
    return { ok: false, error: errorMessage(err) };
  }
}

function lockPc() {
  try {
    spawn('rundll32.exe', ['user32.dll,LockWorkStation']);
    return { ok: true };
  } catch (err) {
    console.error('[tools] lock error:', errorMessage(err));
    return { ok: false, error: errorMessage(err) };
  }
}

function sleepPc() {
  try {
    spawn('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']);
    return { ok: true };
  } catch (err) {
    console.error('[tools] sleep error:', errorMessage(err));
    return { ok: false, error: errorMessage(err) };
  }
}

export { takeSnip };
export { captureFullScreen };
export { emptyRecycleBin };
export { lockPc };
export { sleepPc };
