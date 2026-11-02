import { app, clipboard, nativeImage, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { errorMessage } from '../../../shared/errors';
import type { EventSender } from '../../../shared/contracts/events';
import type { Features } from '../../settings/domain/features';
interface Dependencies {
  send: EventSender;
  features: { get(): Features };
  system: Pick<typeof import('../../system/main/service'), 'clipboardChanged'>;
  shelf: Pick<typeof import('../../shelf/main/service'), 'add' | 'list'>;
}
export function createScreenshotService({ send, features, system, shelf }: Dependencies) {
  // --- copied images (Win+Shift+S and friends) ---
  // The bridge reports Windows' clipboard sequence number; the image is only read when it
  // changes, so a big screenshot sitting on the clipboard costs nothing.
  let clipSeq: number | null = null;
  let lastShot: Electron.NativeImage | null = null; // nativeImage of the last copied image, until it is saved or replaced
  async function onClipboardSeq(seq: number, isPrivate: boolean) {
    if (clipSeq === null) {
      clipSeq = seq;
      return;
    } // whatever was there at startup is old news
    if (seq === clipSeq) return;
    clipSeq = seq;
    system.clipboardChanged(isPrivate); // text: history and smart actions
    if (isPrivate || !features.get().screenshotToast) return;
    // Electron 44: images come from clipboard.read() items as blobs
    let img = null;
    try {
      for (const item of await clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        if (!(blob instanceof Blob)) continue;
        img = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
        break;
      }
    } catch (err) {
      console.error('[screenshot] read', errorMessage(err));
    }
    if (!img || img.isEmpty()) return;
    lastShot = img;
    const { width, height } = img.getSize();
    const f = features.get();
    const auto = f.shotAutoShelf && f.tabShelf;
    send('screenshot', {
      thumb: img.resize({ height: 72, quality: 'good' }).toDataURL(),
      width,
      height,
      auto,
    });
    if (auto) shotToShelf(Date.now() + f.shotShelfMinutes * 60 * 1000);
  }

  // The Snipping Tool saves every capture to Pictures\Screenshots by itself: that file goes on the
  // shelf (no second copy). Any other copied image is saved to Pictures\Nova Island first.
  const SNIP_WAIT_MS = 2500;
  async function windowsScreenshot(since: number) {
    const dir = path.join(app.getPath('pictures'), 'Screenshots');
    for (let waited = 0; waited <= SNIP_WAIT_MS; waited += 250) {
      try {
        const fresh = fs
          .readdirSync(dir)
          .filter((n) => /\.(png|jpe?g)$/i.test(n))
          .map((n) => path.join(dir, n))
          .map((p) => [p, fs.statSync(p)] as const)
          .filter(([, s]) => s.size > 0 && s.mtimeMs >= since - 1500)
          .sort((a, b) => b[1].mtimeMs - a[1].mtimeMs)[0];
        if (fresh) return fresh[0];
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }
  async function shotToShelf(until = 0) {
    if (!lastShot) return;
    const shot = lastShot;
    const copiedAt = Date.now();
    try {
      let file = until ? await windowsScreenshot(copiedAt) : null;
      if (!file) {
        const dir = path.join(app.getPath('pictures'), 'Nova Island');
        const pad = (n: number) => String(n).padStart(2, '0');
        const d = new Date();
        file = path.join(
          dir,
          `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`,
        );
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, shot.toPNG());
      }
      shelf.add([file], until);
      send('shelf', await shelf.list());
      if (!until) send('shot-saved', { name: path.basename(file) });
    } catch (err) {
      console.error('[screenshot]', errorMessage(err));
    }
  }
  ipcMain.on('shot-to-shelf', () => shotToShelf());

  return { onClipboardSeq };
}
