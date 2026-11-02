import type { SettingsStore } from '../../../shared/contracts/storage';
import { DEFAULTS, type Features } from '../../settings/domain/features';
import { sanitizeFeatures } from '../../settings/domain/service';
import { sanitizeToolkit } from '../../toolkit/domain/service';
import type { ToolkitState } from '../../toolkit/domain/types';
import { MODES, favoriteIds } from '../../modes/domain/catalog';
import { layoutFeatures, parseProfilePack, ProfilePackError } from './profile-pack';

export interface Profile {
  id: string;
  name: string;
  features: Partial<Features>;
  kind?: 'layout';
}
export const PRESETS = MODES.filter((mode) => ['everyday', 'focus', 'creator', 'minimal'].includes(mode.id));
export interface CustomizationBackup {
  format: 'dynamic-island';
  version: 1;
  features: Partial<Features>;
  profiles: Profile[];
  toolkit: ToolkitState;
  favoriteModes?: string[];
}
function cleanProfiles(input: unknown): Profile[] {
  if (!Array.isArray(input)) return [];
  const names = new Set<string>();
  return input.slice(0, 12).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 48) : '';
    if (!name || names.has(name.toLowerCase())) return [];
    names.add(name.toLowerCase());
    return [
      {
        id: `profile-${index}`,
        name,
        ...(row.kind === 'layout' ? { kind: 'layout' as const } : {}),
        features:
          row.kind === 'layout'
            ? layoutFeatures(row.features)
            : { ...DEFAULTS, ...sanitizeFeatures(row.features) },
      },
    ];
  });
}
export function parseBackup(input: unknown): CustomizationBackup {
  if (!input || typeof input !== 'object') throw new Error('Choose a Dynamic Island customization backup.');
  const data = input as Record<string, unknown>;
  if (data.format !== 'dynamic-island' || data.version !== 1)
    throw new Error('This backup format is not supported.');
  if (
    !data.features ||
    typeof data.features !== 'object' ||
    !data.toolkit ||
    typeof data.toolkit !== 'object' ||
    !Array.isArray(data.profiles)
  )
    throw new Error('This backup is incomplete.');
  return {
    format: 'dynamic-island',
    version: 1,
    features: sanitizeFeatures(data.features),
    profiles: cleanProfiles(data.profiles),
    toolkit: sanitizeToolkit(data.toolkit),
    ...(Array.isArray(data.favoriteModes) ? { favoriteModes: favoriteIds(data.favoriteModes) } : {}),
  };
}
export function createProfileService(
  store: SettingsStore,
  features: { get(): Features; set(patch: unknown): Features },
) {
  let profiles = cleanProfiles(store.load('profiles.json', []));
  const get = () => structuredClone(profiles);
  const persist = (next: unknown) => {
    profiles = cleanProfiles(next);
    store.save('profiles.json', profiles);
    return get();
  };
  return {
    get,
    replace: persist,
    importPack(input: unknown) {
      const pack = parseProfilePack(input);
      const additions: Profile[] = [];
      for (const entry of pack.profiles) {
        const existing = profiles.find((profile) => profile.name.toLowerCase() === entry.name.toLowerCase());
        if (existing) {
          if (
            existing.kind === 'layout' &&
            JSON.stringify(existing.features) === JSON.stringify(entry.features)
          )
            continue;
          throw new ProfilePackError(
            `A profile named "${entry.name}" already exists. Rename the pack profile or export your setup before removing the existing one.`,
          );
        }
        additions.push({ id: '', kind: 'layout', ...entry });
      }
      if (profiles.length + additions.length > 12)
        throw new ProfilePackError(
          `This pack needs ${additions.length} free profile slots; ${12 - profiles.length} available. Export your setup before removing profiles, or import individual pack files.`,
        );
      return additions.length ? persist([...profiles, ...additions]) : get();
    },
    save(name: unknown) {
      if (typeof name !== 'string' || !name.trim()) return get();
      const normalized = name.trim().slice(0, 48);
      const existing = profiles.findIndex(
        (profile) => profile.name.toLowerCase() === normalized.toLowerCase(),
      );
      const next = { id: '', name: normalized, features: features.get() };
      if (existing >= 0) profiles[existing] = next;
      else if (profiles.length < 12) profiles.push(next);
      else throw new Error('You can save up to 12 profiles.');
      return persist(profiles);
    },
    remove(id: string) {
      return persist(profiles.filter((profile) => profile.id !== id));
    },
    apply(id: string) {
      const profile =
        profiles.find((profile) => profile.id === id) || PRESETS.find((profile) => profile.id === id);
      return profile ? features.set(profile.features) : features.get();
    },
  };
}
