import { ipcMain } from 'electron';
import type * as Service from './service';

export function registerNotesIpc(notes: typeof Service) {
  // --- notes & scratchpad ---
  ipcMain.handle('notes-get', () => notes.get());
  ipcMain.handle('notes-save', (_e, data) => notes.save(data));
}
