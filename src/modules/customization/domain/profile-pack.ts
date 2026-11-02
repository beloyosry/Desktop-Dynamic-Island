import { sanitizeFeatures } from '../../settings/domain/service';
import type { Features } from '../../settings/domain/features';

// Packs only style the island. They cannot enable tracking, alerts, updates or services.
export const LAYOUT_KEYS = [
  'panelWidth',
  'panelHeight',
  'cornerRadius',
  'glassOpacity',
  'customAccent',
  'themePreset',
  'motionPreset',
  'colorGlow',
  'liquidReflections',
  'reduceTransparency',
  'visualDensity',
  'defaultTab',
  'tabOrder',
  'tabMedia',
  'tabApps',
  'tabShelf',
  'tabTools',
  'tabNotes',
  'tabPrayer',
  'tabQuran',
  'tabTimer',
  'tabSystem',
  'tabToolkit',
] as const satisfies readonly (keyof Features)[];

export class ProfilePackError extends Error {}
export interface LayoutProfile {
  name: string;
  features: Partial<Features>;
}
export interface ProfilePack {
  format: 'dynamic-island-profile-pack';
  version: 1;
  profiles: LayoutProfile[];
}
export function layoutFeatures(input: unknown): Partial<Features> {
  const clean = sanitizeFeatures(input);
  return Object.fromEntries(
    LAYOUT_KEYS.filter((key) => Object.hasOwn(clean, key)).map((key) => [key, clean[key]]),
  );
}
export function parseProfilePack(input: unknown): ProfilePack {
  const fail = (): never => {
    throw new ProfilePackError('Choose a valid island profile pack (version 1).');
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail();
  const data = input as Record<string, unknown>;
  if (
    data.format !== 'dynamic-island-profile-pack' ||
    data.version !== 1 ||
    !Array.isArray(data.profiles) ||
    !data.profiles.length ||
    data.profiles.length > 12
  )
    return fail();
  const names = new Set<string>();
  const profiles = data.profiles.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
    const row = value as Record<string, unknown>;
    if (
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      row.name.trim().length > 48 ||
      !row.features ||
      typeof row.features !== 'object' ||
      Array.isArray(row.features)
    )
      return fail();
    const name = row.name.trim();
    if (names.has(name.toLowerCase())) return fail();
    names.add(name.toLowerCase());
    const features = layoutFeatures(row.features);
    const entries = Object.entries(row.features);
    if (!entries.length || entries.some(([key, value]) => features[key as keyof Features] !== value))
      return fail();
    return { name, features };
  });
  return { format: 'dynamic-island-profile-pack', version: 1, profiles };
}
