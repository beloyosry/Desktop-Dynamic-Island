import type { SettingsStore } from '../../../shared/contracts/storage';
import { DEFAULTS, RANGES, type Features } from './features';
import { THEMES, MOTION_PRESETS } from '../../appearance/domain/themes';
import { TABS, tabOrder } from './tabs';
/** Saved JSON and IPC remain runtime inputs, even with a typed preload. */
export function sanitizeFeatures(input: unknown): Partial<Features> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULTS, key)) continue;
    const name = key as keyof Features;
    if (typeof value !== typeof DEFAULTS[name]) continue;
    if (name === 'themePreset' && !THEMES.some((theme) => theme.id === value)) continue;
    if (name === 'motionPreset' && !MOTION_PRESETS.some((motion) => motion === value)) continue;
    if (name === 'customAccent' && value !== '' && !/^#[\da-f]{6}$/i.test(String(value))) continue;
    if (name === 'visualDensity' && !['comfortable', 'compact'].includes(String(value))) continue;
    if (name === 'defaultTab' && !TABS.some((tab) => tab.id === value)) continue;
    if (name === 'tabOrder') {
      out[key] = tabOrder(String(value)).join(',');
      continue;
    }
    const range = RANGES[name];
    if (range) {
      if (typeof value === 'number' && Number.isFinite(value))
        out[key] = Math.min(Math.max(Math.round(value), range[0]), range[1]);
    } else out[key] = value;
  }
  return out as Partial<Features>;
}
export function createFeatureService(store: SettingsStore) {
  let values: Features = { ...DEFAULTS, ...sanitizeFeatures(store.load('features.json', {})) };
  if (!TABS.some((tab) => values[tab.feature])) values.tabTools = true;
  const listeners = new Set<(features: Features) => void>();
  const get = (): Features => ({ ...values });
  const publish = () => {
    if (!TABS.some((tab) => values[tab.feature])) values.tabTools = true;
    store.save('features.json', values);
    listeners.forEach((listener) => listener(get()));
    return get();
  };
  return {
    get,
    set(input: unknown) {
      const clean = sanitizeFeatures(input);
      if (!Object.keys(clean).length) return get();
      values = { ...values, ...clean };
      return publish();
    },
    reset() {
      values = { ...DEFAULTS };
      return publish();
    },
    onChange(listener: (features: Features) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
