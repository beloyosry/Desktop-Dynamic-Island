import { ipcMain, shell } from 'electron';
import * as store from '../../../platform/storage/json-store';
import { createQuranService } from '../domain/service';

async function request(endpoint: string) {
  const response = await fetch(`https://www.mp3quran.net/api/v3/${endpoint}`, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok || !response.body) throw new Error('Catalog unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) throw new Error('Catalog too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function registerQuran() {
  const service = createQuranService(store, request);
  ipcMain.handle('quran-catalog', (_event, refresh: unknown) => service.catalog(refresh === true));
  ipcMain.handle('quran-preferences', () => service.getPreferences());
  ipcMain.handle('quran-save', (_event, input: unknown) => service.savePreferences(input));
  ipcMain.handle('quran-stream', (_event, reciter: unknown, moshaf: unknown, surah: unknown) =>
    service.stream(reciter, moshaf, surah),
  );
  ipcMain.on('quran-source', () => void shell.openExternal('https://www.mp3quran.net/ar'));
  return service;
}
