import type { Features } from '../../settings/domain/features';
/** A runtime layer; the user's saved appearance stays intact underneath. */
export function effectiveFeatures<T extends Partial<Features>>(features: T): T {
  return features.boostMode
    ? {
        ...features,
        reduceTransparency: true,
        liquidReflections: false,
        motionPreset: 'reduced',
        colorGlow: false,
        notificationDrop: false,
        novaEyes: false,
        novaFocus: false,
        novaPrayer: false,
        celebrate: false,
        clockSeconds: false,
      }
    : { ...features };
}
export interface ResourceSnapshot {
  workingSetBytes: number;
  privateBytes: number;
  processCount: number;
  systemFreeBytes: number;
  systemTotalBytes: number;
  cacheBytes: number;
  sampledAt: number;
}
export interface CleanupResult {
  ok: boolean;
  error?: string;
  before: ResourceSnapshot;
  after: ResourceSnapshot;
  action: 'cache' | 'memory';
}
