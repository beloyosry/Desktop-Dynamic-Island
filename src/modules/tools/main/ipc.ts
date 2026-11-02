import { ipcMain } from 'electron';
import type * as Service from './service';

export function registerToolsIpc(tools: typeof Service) {
  // --- quick tools & control center ---
  ipcMain.handle('tools-snip', () => tools.takeSnip());
  ipcMain.handle('tools-capture-full', () => tools.captureFullScreen());
  ipcMain.handle('tools-empty-bin', () => tools.emptyRecycleBin());
  ipcMain.handle('tools-lock-pc', () => tools.lockPc());
  ipcMain.handle('tools-sleep-pc', () => tools.sleepPc());
}
