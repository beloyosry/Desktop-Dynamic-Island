import type { ShelfEntry } from '../domain/types';
// File shelf: files dropped on the island, kept as paths (nothing is copied). Screenshots added
// on their own carry an expiry time: they leave the shelf then (the file itself is never touched).
import * as fs from 'fs';
import * as path from 'path';
import { app, shell, nativeImage } from 'electron';
import * as settings from '../../../platform/storage/json-store';

const MAX_ITEMS = 24;
const EXPIRE_CHECK_MS = 30 * 1000;
// { path, until? } (older versions saved plain paths)
let items: ShelfEntry[] = settings
  .load<(string | ShelfEntry)[]>('shelf.json', [])
  .map((x) => (typeof x === 'string' ? { path: x } : x))
  .filter((x) => x && typeof x.path === 'string' && fs.existsSync(x.path));
const icons: Map<string, Electron.NativeImage> = new Map();
let onExpire = () => {};

async function iconFor(p: string) {
  if (!icons.has(p)) {
    let img = nativeImage.createEmpty();
    try {
      img = await app.getFileIcon(p, { size: 'large' });
    } catch {}
    icons.set(p, img);
  }
  return icons.get(p)!;
}

const has = (p: string) => items.some((x) => x.path === p);

async function list() {
  items = items.filter((x) => fs.existsSync(x.path));
  return Promise.all(
    items.map(async ({ path: p, until }) => {
      const img = await iconFor(p);
      return {
        path: p,
        name: path.basename(p) || p,
        icon: img.isEmpty() ? '' : img.toDataURL(),
        until: until || 0,
      };
    }),
  );
}

function save() {
  settings.save('shelf.json', items);
}

// until: when the file leaves the shelf on its own (ms); none = it stays
function add(paths: unknown[], until = 0) {
  for (const p of paths) {
    if (typeof p !== 'string' || !p || !fs.existsSync(p)) continue;
    items = [until ? { path: p, until } : { path: p }, ...items.filter((x) => x.path !== p)];
  }
  // over the limit: the oldest timed screenshots go first, then the oldest files
  while (items.length > MAX_ITEMS) {
    const i = items.map((x) => !!x.until).lastIndexOf(true);
    items.splice(i >= 0 ? i : items.length - 1, 1);
  }
  save();
}

function remove(p: string) {
  items = items.filter((x) => x.path !== p);
  save();
}

function clear() {
  items = [];
  save();
}

// timed items whose time is up leave the shelf (also those that ran out while the app was closed)
function expire() {
  const now = Date.now();
  const left = items.filter((x) => !x.until || x.until > now);
  if (left.length === items.length) return;
  items = left;
  save();
  onExpire();
}

function start(changed: () => void) {
  onExpire = changed;
  expire();
  setInterval(expire, EXPIRE_CHECK_MS);
}

function open(p: string) {
  if (has(p)) shell.openPath(p);
}

function reveal(p: string) {
  if (has(p)) shell.showItemInFolder(p);
}

function startDrag(webContents: Electron.WebContents, p: string) {
  if (!has(p)) return;
  let icon = icons.get(p);
  if (!icon || icon.isEmpty())
    icon = nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 });
  webContents.startDrag({ file: p, icon });
}

export { start };
export { list };
export { add };
export { remove };
export { clear };
export { open };
export { reveal };
export { startDrag };
