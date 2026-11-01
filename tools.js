// Quick Desktop Utilities and Control Center for Dynamic Island Pro
const { spawn } = require('child_process');
const { shell, desktopCapturer, clipboard, nativeImage } = require('electron');

function takeSnip() {
  try {
    spawn('explorer.exe', ['ms-screenclip:']);
    return { ok: true, mode: 'snip' };
  } catch (err) {
    console.error('[tools] snip error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function captureFullScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    if (sources && sources.length > 0) {
      const img = sources[0].thumbnail;
      clipboard.writeImage(img);
      return { ok: true, mode: 'full' };
    }
    return { ok: false, error: 'No screen source found' };
  } catch (err) {
    console.error('[tools] capture error:', err.message);
    return { ok: false, error: err.message };
  }
}

function emptyRecycleBin() {
  try {
    spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
    ]);
    return { ok: true };
  } catch (err) {
    console.error('[tools] empty trash error:', err.message);
    return { ok: false, error: err.message };
  }
}

function lockPc() {
  try {
    spawn('rundll32.exe', ['user32.dll,LockWorkStation']);
    return { ok: true };
  } catch (err) {
    console.error('[tools] lock error:', err.message);
    return { ok: false, error: err.message };
  }
}

function sleepPc() {
  try {
    spawn('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']);
    return { ok: true };
  } catch (err) {
    console.error('[tools] sleep error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  takeSnip,
  captureFullScreen,
  emptyRecycleBin,
  lockPc,
  sleepPc
};
