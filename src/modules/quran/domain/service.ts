import type { SettingsStore } from '../../../shared/contracts/storage';
import { normalizeCatalog, restoreCatalog, audioUrl, CATALOG_TTL, type QuranCatalog } from './catalog';
export interface QuranPreferences {
  reciterId: number;
  moshafId: number;
  surah: number;
  position: number;
  volume: number;
  repeat: 'off' | 'one' | 'all';
  autoNext: boolean;
  favorites: number[];
}
export const QURAN_DEFAULTS: QuranPreferences = {
  reciterId: 0,
  moshafId: 0,
  surah: 1,
  position: 0,
  volume: 0.7,
  repeat: 'off',
  autoNext: true,
  favorites: [],
};
export function sanitizeQuranPreferences(input: unknown, base = QURAN_DEFAULTS): QuranPreferences {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const next = { ...base, favorites: [...base.favorites] };
  for (const key of ['reciterId', 'moshafId', 'surah', 'position', 'volume'] as const) {
    const n = raw[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) continue;
    const max = key === 'volume' ? 1 : key === 'position' ? 43200 : key === 'surah' ? 114 : 100000;
    const value = Math.max(key === 'surah' ? 1 : 0, Math.min(max, n));
    next[key] = key === 'position' || key === 'volume' ? value : Math.floor(value);
  }
  if (['off', 'one', 'all'].includes(String(raw.repeat)))
    next.repeat = raw.repeat as QuranPreferences['repeat'];
  if (typeof raw.autoNext === 'boolean') next.autoNext = raw.autoNext;
  if (Array.isArray(raw.favorites))
    next.favorites = [
      ...new Set(
        raw.favorites.filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 100000,
        ),
      ),
    ].slice(0, 100);
  return next;
}
export function createQuranService(
  store: SettingsStore,
  request: (endpoint: string) => Promise<unknown>,
  now = Date.now,
) {
  let cached = restoreCatalog(store.load('quran-catalog.json', null));
  let prefs = sanitizeQuranPreferences(store.load('quran.json', {}));
  let pending: Promise<QuranCatalog> | undefined;
  let generation = 0;
  const getPreferences = () => structuredClone(prefs);
  async function catalog(refresh = false): Promise<QuranCatalog> {
    if (pending) return pending;
    cached ??= restoreCatalog(store.load('quran-catalog.json', null));
    if (!refresh && cached && cached.fetchedAt <= now() && now() - cached.fetchedAt < CATALOG_TTL)
      return structuredClone({ ...cached, stale: false });
    const version = generation;
    pending = (async () => {
      try {
        const [ar, en, suwar, englishSuwar] = await Promise.all([
          request('reciters?language=ar'),
          request('reciters?language=eng').catch(() => null),
          request('suwar?language=ar'),
          request('suwar?language=eng').catch(() => null),
        ]);
        const next = normalizeCatalog(ar, en, suwar, englishSuwar, now());
        if (version === generation) {
          cached = next;
          store.save('quran-catalog.json', next);
        }
        return structuredClone(next);
      } catch {
        if (cached) return structuredClone({ ...cached, stale: true });
        throw new Error('Could not load reciters. Check your connection and try again.');
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }
  return {
    catalog,
    getPreferences,
    savePreferences(input: unknown) {
      prefs = sanitizeQuranPreferences(input, prefs);
      store.save('quran.json', prefs);
      return getPreferences();
    },
    async stream(reciter: unknown, moshaf: unknown, surah: unknown) {
      return audioUrl(await catalog(), reciter, moshaf, surah);
    },
    clearCache() {
      generation++;
      cached = null;
      store.save('quran-catalog.json', null);
    },
    releaseMemory() {
      generation++;
      cached = null;
    },
  };
}
