import type { SettingsStore } from '../../../shared/contracts/storage';
import type { ToolkitState } from './types';

export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function validZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
const defaults: ToolkitState = {
  bookmarks: [],
  clocks: [
    { id: 'london', name: 'London', zone: 'Europe/London' },
    { id: 'new-york', name: 'New York', zone: 'America/New_York' },
  ],
};
export function sanitizeToolkit(input: unknown): ToolkitState {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const rows = (key: string, max: number) =>
    (Array.isArray(source[key]) ? source[key] : [])
      .slice(0, max)
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  const seenLinks = new Set<string>();
  const seenClocks = new Set<string>();
  return {
    bookmarks: rows('bookmarks', 24).flatMap((row, index) => {
      const url = safeWebUrl(row.url);
      const name = typeof row.name === 'string' ? row.name.trim().slice(0, 48) : '';
      if (!url || !name || seenLinks.has(url)) return [];
      seenLinks.add(url);
      return [{ id: `link-${index}`, name, url }];
    }),
    clocks: rows('clocks', 8).flatMap((row, index) => {
      const name = typeof row.name === 'string' ? row.name.trim().slice(0, 32) : '';
      if (!name || !validZone(row.zone) || seenClocks.has(row.zone)) return [];
      seenClocks.add(row.zone);
      return [{ id: `clock-${index}`, name, zone: row.zone }];
    }),
  };
}
export function createToolkitService(store: SettingsStore) {
  let state = sanitizeToolkit(store.load('toolkit.json', defaults));
  const get = () => structuredClone(state);
  return {
    get,
    save(input: unknown) {
      state = sanitizeToolkit(input);
      store.save('toolkit.json', state);
      return get();
    },
  };
}
