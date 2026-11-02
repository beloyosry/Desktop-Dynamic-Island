import { DEFAULTS, type Features } from '../../settings/domain/features';
import { sanitizeFeatures } from '../../settings/domain/service';
import type { SettingsStore } from '../../../shared/contracts/storage';
import { MODIFIERS, favoriteIds, modeById } from './catalog';

export interface ModeState {
  activeId: string | null;
  mods: string[];
  favorites: string[];
  customized: boolean;
  canRestore: boolean;
  activation: number;
}
export function createModeService(
  store: SettingsStore,
  features: { get(): Features; set(patch: unknown): Features },
) {
  const raw = store.load<unknown>('modes.json', {});
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let baseline: Features | null =
    saved.baseline && typeof saved.baseline === 'object' && !Array.isArray(saved.baseline)
      ? { ...DEFAULTS, ...sanitizeFeatures(saved.baseline) }
      : null;
  let activeId: string | null = baseline && modeById(saved.activeId) ? String(saved.activeId) : null;
  let mods =
    baseline && Array.isArray(saved.mods)
      ? MODIFIERS.filter((mod) => (saved.mods as unknown[]).includes(mod.id)).map((mod) => mod.id)
      : [];
  let favorites =
    saved.favorites === undefined
      ? ['everyday', 'focus', 'creator', 'minimal']
      : favoriteIds(saved.favorites);
  let activation = 0;
  if (!activeId && !mods.length) baseline = null;
  const patch = (id = activeId, ids = mods): Partial<Features> =>
    Object.assign(
      {},
      modeById(id)?.features || {},
      ...MODIFIERS.filter((mod) => ids.includes(mod.id)).map((mod) => mod.features),
    );
  const persist = () => store.save('modes.json', { activeId, mods, favorites, baseline });
  const get = (): ModeState => {
    const current = features.get();
    return {
      activeId,
      mods: [...mods],
      favorites: [...favorites],
      activation,
      canRestore: !!baseline,
      customized: Object.entries(patch()).some(([key, value]) => current[key as keyof Features] !== value),
    };
  };
  function applyLayers(id: string | null, ids: string[]) {
    const previous = patch();
    baseline ??= features.get();
    const next = patch(id, ids);
    const restore = Object.fromEntries(
      [...new Set([...Object.keys(previous), ...Object.keys(next)])].map((key) => [
        key,
        baseline![key as keyof Features],
      ]),
    );
    activeId = id;
    mods = [...ids];
    if (!activeId && !mods.length) baseline = null;
    persist();
    features.set({ ...restore, ...next });
    return get();
  }
  return {
    get,
    apply(id: unknown) {
      if (!modeById(id)) return get();
      activation++;
      return applyLayers(String(id), mods);
    },
    setMod(id: unknown, enabled: unknown) {
      if (typeof enabled !== 'boolean' || !MODIFIERS.some((mod) => mod.id === id)) return get();
      const next = enabled ? [...new Set([...mods, String(id)])] : mods.filter((mod) => mod !== id);
      if (next.join(',') === mods.join(',')) return get();
      return applyLayers(activeId, next);
    },
    favorite(id: unknown, enabled: unknown) {
      if (!modeById(id) || typeof enabled !== 'boolean') return get();
      favorites = enabled ? favoriteIds([...favorites, id]) : favorites.filter((item) => item !== id);
      persist();
      return get();
    },
    replaceFavorites(input: unknown) {
      favorites = favoriteIds(input);
      persist();
      return get();
    },
    restore() {
      return baseline ? applyLayers(null, []) : get();
    },
    clear() {
      activeId = null;
      mods = [];
      baseline = null;
      persist();
      return get();
    },
  };
}
export type ModeService = ReturnType<typeof createModeService>;
