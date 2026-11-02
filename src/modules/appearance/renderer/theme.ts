import { themeById } from '../domain/themes';
import { effectiveFeatures } from '../../performance/domain/boost';
import type { Features } from '../../settings/domain/features';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
export function applyAppearance(features: Partial<Features>) {
  features = effectiveFeatures(features);
  const root = document.documentElement;
  const theme = themeById(features.themePreset);
  const accentColor = features.customAccent || theme.accent;
  root.dataset.density = features.visualDensity || 'comfortable';
  root.dataset.theme = theme.id;
  root.dataset.motion =
    features.motionPreset === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduced'
      : features.motionPreset || 'auto';
  root.dataset.glow = String(features.colorGlow !== false);
  root.dataset.reflections = String(features.liquidReflections !== false);
  root.dataset.transparency =
    features.reduceTransparency ||
    matchMedia('(prefers-reduced-transparency: reduce)').matches ||
    matchMedia('(prefers-contrast: more)').matches
      ? 'reduced'
      : 'glass';
  const accent = rgb(accentColor);
  const base = rgb(theme.base);
  const tokens: Record<string, string> = {
    '--theme-rgb': accent,
    '--secondary-rgb': rgb(theme.secondary),
    '--accent-rgb': accent,
    '--accent': accentColor,
    '--accent-2': theme.secondary,
    '--glass-tint': `rgba(${base}, ${(features.glassOpacity || 48) / 100})`,
    '--glass-tint-strong': `rgba(${base}, ${Math.min(0.98, (features.glassOpacity || 48) / 100 + 0.22)})`,
    '--theme-base-rgb': base,
    '--glass-stroke': `rgba(${accent}, .32)`,
    '--fill-1': `rgba(${accent}, .08)`,
    '--fill-2': `rgba(${accent}, .16)`,
    '--fill-3': `rgba(${accent}, .24)`,
    '--card': `rgba(${accent}, .06)`,
    '--card-stroke': `rgba(${accent}, .15)`,
    '--bg': theme.base,
    '--panel': `rgba(${accent}, .055)`,
    '--stroke': `rgba(${accent}, .13)`,
  };
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value);
  document.dispatchEvent(new Event('appearance:change'));
}

export const motionAllowed = () =>
  document.documentElement.dataset.motion !== 'reduced' &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches;
