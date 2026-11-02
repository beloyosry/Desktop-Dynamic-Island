import type { SettingsStore } from '../../../shared/contracts/storage';
import type { Notes } from './types';
const DEFAULTS: Notes = {
  text: '',
  todos: [
    { id: '1', text: 'Welcome to Dynamic Island Pro!', done: true },
    { id: '2', text: 'Scroll over island to adjust system volume', done: false },
    { id: '3', text: 'Middle-click island to play/pause media', done: false },
    { id: '4', text: 'Check out the Quick Tools tab for screen snips', done: false },
  ],
};
export function createNotesService(store: SettingsStore, now = Date.now) {
  const sanitize = (data: unknown): Notes | null => {
    if (!data || typeof data !== 'object') return null;
    const input = data as Record<string, unknown>;
    return {
      text: typeof input.text === 'string' ? input.text : '',
      todos: Array.isArray(input.todos)
        ? input.todos
            .slice(0, 50)
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item, index) => ({
              id: String(item.id || now() + index),
              text: String(item.text || '').slice(0, 300),
              done: Boolean(item.done),
            }))
        : [],
    };
  };
  const get = (): Notes => sanitize(store.load<unknown>('notes.json', DEFAULTS)) ?? structuredClone(DEFAULTS);
  return {
    get,
    save(data: unknown): Notes {
      const clean = sanitize(data);
      if (!clean) return get();
      store.save('notes.json', clean);
      return clean;
    },
  };
}
