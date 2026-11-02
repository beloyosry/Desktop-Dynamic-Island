import type { IslandBridge, SettingsBridge, MiniBridge } from '../contracts/bridge';
import type { Features } from '../../modules/settings/domain/features';
declare global {
  interface BatteryManager extends EventTarget {
    charging: boolean;
    level: number;
  }
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
  interface Window {
    nova: IslandBridge;
    prefs: SettingsBridge;
    mini: MiniBridge;
    webkitAudioContext?: typeof AudioContext;
  }
  interface WindowEventMap {
    'island:overlay-open': CustomEvent<'commands' | 'notifications'>;
    'island:overlay-close': Event;
    'island:mode': CustomEvent<{ mode: string; prev: string }>;
    'island:features': CustomEvent<Features>;
    'island:tab': CustomEvent<string>;
    'island:visibility': CustomEvent<boolean>;
    'island:tool': CustomEvent<string>;
  }
}
export {};
