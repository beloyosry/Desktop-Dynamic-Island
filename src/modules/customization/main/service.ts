import { BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, shell } from 'electron';
import { readFile, writeFile, stat } from 'node:fs/promises';
import * as store from '../../../platform/storage/json-store';
import * as features from '../../settings/main/features';
import { createProfileService, parseBackup, type CustomizationBackup } from '../domain/service';
import { createToolkitService, safeWebUrl } from '../../toolkit/domain/service';
import type { EventSender } from '../../../shared/contracts/events';
import type { Result } from '../../../shared/contracts/bridge';
import { registerModes } from '../../modes/main/service';
import { modeById } from '../../modes/domain/catalog';

export function registerCustomization(sender: EventSender, openSettings: (page?: string) => void) {
  const modes = registerModes(sender, openSettings);
  const profiles = createProfileService(store, features);
  const toolkit = createToolkitService(store);
  const publishProfiles = () => {
    const values = profiles.get();
    sender('profiles', values);
    return values;
  };
  const publishToolkit = () => {
    const values = toolkit.get();
    sender('toolkit', values);
    return values;
  };
  ipcMain.handle('profiles-get', () => profiles.get());
  ipcMain.handle('profiles-save', (_event, name: unknown) => {
    profiles.save(name);
    return publishProfiles();
  });
  ipcMain.handle('profiles-remove', (_event, id: string) => {
    profiles.remove(id);
    return publishProfiles();
  });
  ipcMain.handle('profiles-apply', (_event, id: string) => {
    if (modeById(id)) modes.apply(id);
    else if (profiles.get().some((profile) => profile.id === id)) {
      modes.clear();
      profiles.apply(id);
    }
    modes.publish();
    return features.get();
  });
  ipcMain.on('personalize-open', () => openSettings('personalize'));
  ipcMain.handle('toolkit-get', () => toolkit.get());
  ipcMain.handle('toolkit-save', (_event, input: unknown) => {
    toolkit.save(input);
    return publishToolkit();
  });
  ipcMain.handle('toolkit-copy', async (_event, text: unknown, sensitive: unknown) => {
    if (typeof text !== 'string' || text.length > 200000)
      return { ok: false, error: 'Text is too long to copy.' };
    try {
      if (sensitive === true)
        await clipboard.write([
          new ClipboardItem({
            'text/plain': text,
            'electron application/osclipboard;format="ExcludeClipboardContentFromMonitorProcessing"':
              new Blob([new Uint8Array([0])]),
            'electron application/osclipboard;format="CanIncludeInClipboardHistory"': new Blob([
              new Uint8Array(4),
            ]),
            'electron application/osclipboard;format="CanUploadToCloudClipboard"': new Blob([
              new Uint8Array(4),
            ]),
          }),
        ]);
      else await clipboard.writeText(text);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Clipboard is unavailable. Try again.' };
    }
  });
  ipcMain.handle('bookmark-open', async (_event, id: string) => {
    const url = safeWebUrl(toolkit.get().bookmarks.find((bookmark) => bookmark.id === id)?.url);
    if (!url) return { ok: false, error: 'This shortcut is no longer available.' };
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Your browser could not open this link.' };
    }
  });
  let transferring = false;
  ipcMain.handle(
    'customization-backup',
    async (event, action: string): Promise<Result & { cancelled?: boolean }> => {
      if (transferring) return { ok: false, error: 'A file dialog is already open.' };
      const parent = BrowserWindow.fromWebContents(event.sender);
      if (!parent || !['import', 'export'].includes(action)) return { ok: false, error: 'Unavailable.' };
      transferring = true;
      try {
        const filters = [{ name: 'Island customization', extensions: ['json'] }];
        if (action === 'export') {
          const result = await dialog.showSaveDialog(parent, {
            title: 'Export your island',
            defaultPath: 'my-island.json',
            filters,
          });
          if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
          const backup: CustomizationBackup = {
            format: 'dynamic-island',
            version: 1,
            features: features.get(),
            profiles: profiles.get(),
            toolkit: toolkit.get(),
            favoriteModes: modes.get().favorites,
          };
          await writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
        } else {
          const result = await dialog.showOpenDialog(parent, {
            title: 'Import island customization',
            filters,
            properties: ['openFile'],
          });
          if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
          const file = result.filePaths[0];
          if ((await stat(file)).size > 512000)
            return { ok: false, error: 'Choose a backup smaller than 500 KB.' };
          const backup = parseBackup(JSON.parse(await readFile(file, 'utf8')));
          // Validate the complete document before changing any persisted values.
          profiles.replace(backup.profiles);
          toolkit.save(backup.toolkit);
          modes.clear();
          if (backup.favoriteModes) modes.replaceFavorites(backup.favoriteModes);
          features.set(backup.features);
          modes.publish();
          publishProfiles();
          publishToolkit();
        }
        return { ok: true };
      } catch {
        return {
          ok: false,
          error:
            action === 'import'
              ? 'Could not import this backup. Choose a valid Dynamic Island JSON file.'
              : 'Could not save the backup. Choose another location.',
        };
      } finally {
        transferring = false;
      }
    },
  );
  return {
    clearModes: () => {
      modes.clear();
      modes.publish();
    },
  };
}
