import fs from 'node:fs';
import path from 'node:path';
import { errorMessage } from '../../shared/errors';
import type { SettingsStore } from '../../shared/contracts/storage';
export type { SettingsStore } from '../../shared/contracts/storage';
export function createJsonStore(directory: () => string): SettingsStore {
  return {
    load<T>(name: string, fallback: T): T {
      try {
        return JSON.parse(fs.readFileSync(path.join(directory(), name), 'utf8')) as T;
      } catch {
        return fallback;
      }
    },
    save(name, data) {
      try {
        fs.mkdirSync(directory(), { recursive: true });
        fs.writeFileSync(path.join(directory(), name), JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('[settings]', errorMessage(error));
      }
    },
  };
}
