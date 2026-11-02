import { app, BrowserWindow, ipcMain, session } from 'electron';
import { freemem, totalmem } from 'node:os';
import type { ResourceSnapshot, CleanupResult } from '../domain/boost';

export function registerPerformance(deps: {
  clearCatalog(): void;
  releaseCatalog(): void;
  refreshBackdrop(): void;
  openSettings(page: string): void;
}) {
  async function snapshot(): Promise<ResourceSnapshot> {
    const metrics = app.getAppMetrics();
    return {
      workingSetBytes: metrics.reduce((sum, p) => sum + p.memory.workingSetSize * 1024, 0),
      privateBytes: metrics.reduce((sum, p) => sum + (p.memory.privateBytes || 0) * 1024, 0),
      processCount: metrics.length,
      systemFreeBytes: freemem(),
      systemTotalBytes: totalmem(),
      cacheBytes: await session.defaultSession.getCacheSize(),
      sampledAt: Date.now(),
    };
  }
  let pending: Promise<CleanupResult> | undefined;
  ipcMain.handle('performance-snapshot', snapshot);
  ipcMain.on('performance-open', () => deps.openSettings('performance'));
  ipcMain.handle('performance-clean', (_event, action: unknown) => {
    if (action !== 'cache' && action !== 'memory') throw new Error('Unknown cleanup action');
    if (pending) return pending;
    pending = (async (): Promise<CleanupResult> => {
      const before = await snapshot();
      let error: string | undefined;
      try {
        if (action === 'cache') {
          await session.defaultSession.clearCache();
          deps.clearCatalog();
        } else {
          deps.releaseCatalog();
          for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) window.webContents.send('memory-release');
          }
          // Give the renderer a turn to release canvases and idle audio resources.
          await new Promise((resolve) => setTimeout(resolve, 250));
          deps.refreshBackdrop();
        }
      } catch {
        error = 'Some temporary resources could not be released. Try again.';
      }
      return { ok: !error, error, before, after: await snapshot(), action };
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  });
}
