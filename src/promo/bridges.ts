// Explicit browser demo adapters. This entry is never included in desktop packages.
import { DEFAULTS, type Features } from '../modules/settings/domain/features';
import { createProfileService } from '../modules/customization/domain/service';
import { createToolkitService } from '../modules/toolkit/domain/service';
import type { Profile } from '../modules/customization/domain/service';
import type { ToolkitState } from '../modules/toolkit/domain/types';
import type { SettingsStore } from '../shared/contracts/storage';
import { createModeService, type ModeState } from '../modules/modes/domain/service';
import { modeById } from '../modules/modes/domain/catalog';
import { createNotificationHistory, type NotificationChange } from '../modules/notifications/domain/history';
import { demoQuranCatalog } from './quran-catalog';
import { QURAN_DEFAULTS, sanitizeQuranPreferences } from '../modules/quran/domain/service';
import type { ResourceSnapshot } from '../modules/performance/domain/boost';

const api = window.nova || window.prefs;
const demoResources = (): ResourceSnapshot => ({
  workingSetBytes: 220 * 1048576,
  privateBytes: 180 * 1048576,
  processCount: 4,
  systemFreeBytes: 8.2 * 1073741824,
  systemTotalBytes: 16 * 1073741824,
  cacheBytes: 12.4 * 1048576,
  sampledAt: Date.now(),
});
api.performance = {
  snapshot: async () => demoResources(),
  clean: async (action) => ({
    ok: true,
    action,
    before: demoResources(),
    after: { ...demoResources(), cacheBytes: 0 },
  }),
  open: () => {},
  onRelease: () => () => {},
};
const originalFeatures = api.features.bind(api);
const originalOnFeatures = api.onFeatures.bind(api);
let current: Features = { ...DEFAULTS };
const initialized = originalFeatures().then((value) => {
  current = { ...DEFAULTS, ...value };
});
const listeners = new Set<(value: Features) => void>();
api.features = async () => {
  await initialized;
  return { ...current };
};
api.onFeatures = (callback) => {
  listeners.add(callback);
  const unsubscribe = originalOnFeatures((value) => {
    current = { ...DEFAULTS, ...value };
    callback(current);
  });
  return () => {
    listeners.delete(callback);
    if (typeof unsubscribe === 'function') unsubscribe();
  };
};
api.setFeatures = (patch) => {
  current = { ...current, ...patch };
  listeners.forEach((listener) => listener({ ...current }));
};
const values = new Map<string, unknown>();
const store: SettingsStore = {
  load: <T>(key: string, fallback: T) => structuredClone(values.get(key) ?? fallback) as T,
  save: (key, value) => {
    values.set(key, structuredClone(value));
  },
};
const featurePort = {
  get: () => ({ ...current }),
  set: (patch: unknown) => {
    api.setFeatures(patch as Partial<Features>);
    return { ...current };
  },
};
const profiles = createProfileService(store, featurePort);
const modeService = createModeService(store, featurePort);
const modeListeners = new Set<(value: ModeState) => void>();
const publishModes = () => {
  const next = modeService.get();
  modeListeners.forEach((callback) => callback(next));
  return next;
};
listeners.add(publishModes);
api.modes = {
  get: async () => {
    await initialized;
    return modeService.get();
  },
  apply: async (id) => {
    modeService.apply(id);
    return publishModes();
  },
  setMod: async (id, enabled) => {
    modeService.setMod(id, enabled);
    return publishModes();
  },
  favorite: async (id, enabled) => {
    modeService.favorite(id, enabled);
    return publishModes();
  },
  restore: async () => {
    modeService.restore();
    return publishModes();
  },
  onChange: (callback) => {
    modeListeners.add(callback);
    return () => {
      modeListeners.delete(callback);
    };
  },
  openLibrary: () => {
    if (window.prefs) document.querySelector<HTMLAnchorElement>('[data-page="modes"]')?.click();
  },
};
const profileListeners = new Set<(value: Profile[]) => void>();
api.customization = {
  profiles: async () => profiles.get(),
  saveProfile: async (name) => {
    const next = profiles.save(name);
    profileListeners.forEach((listener) => listener(next));
    return next;
  },
  removeProfile: async (id) => {
    const next = profiles.remove(id);
    profileListeners.forEach((listener) => listener(next));
    return next;
  },
  applyProfile: async (id) => {
    if (modeById(id)) modeService.apply(id);
    else {
      modeService.clear();
      profiles.apply(id);
    }
    publishModes();
    return featurePort.get();
  },
  onProfiles: (callback) => {
    profileListeners.add(callback);
    return () => profileListeners.delete(callback);
  },
  backup: async () => ({ ok: false, cancelled: true }),
  openSettings: () => {},
};
if (window.nova) {
  let quranPreferences = structuredClone(QURAN_DEFAULTS);
  window.nova.quran = {
    catalog: async () => structuredClone(demoQuranCatalog),
    preferences: async () => quranPreferences,
    save: async (patch) => {
      quranPreferences = sanitizeQuranPreferences(patch, quranPreferences);
      return quranPreferences;
    },
    stream: async () => {
      throw new Error('Browser preview does not stream audio');
    },
    openSource: () => {},
  };
  const history = createNotificationHistory(store);
  const notificationListeners = new Set<(value: NotificationChange) => void>();
  const publishNotifications = (arrivalId?: string) => {
    const next = history.get();
    notificationListeners.forEach((callback) => callback({ ...next, arrivalId }));
    return next;
  };
  window.nova.notifications = {
    get: async () => history.get(),
    record: async (input) => {
      const id = history.add(input, current);
      return id ? publishNotifications(id) : history.get();
    },
    read: async (id) => {
      history.read(id);
      return publishNotifications();
    },
    readAll: async () => {
      history.readAll();
      return publishNotifications();
    },
    dismiss: async (id) => {
      history.dismiss(id);
      return publishNotifications();
    },
    clear: async () => {
      history.clear();
      return publishNotifications();
    },
    onChange: (callback) => {
      notificationListeners.add(callback);
      return () => {
        notificationListeners.delete(callback);
      };
    },
  };
  const toolkit = createToolkitService(store);
  toolkit.save({
    bookmarks: [
      { name: 'Project home', url: 'https://github.com/beloyosry/Desktop-Dynamic-Island' },
      { name: 'Design inspiration', url: 'https://www.apple.com' },
      { name: 'Documentation', url: 'https://www.typescriptlang.org' },
      { name: 'My workspace', url: 'https://github.com' },
    ],
    clocks: [
      { name: 'Cairo', zone: 'Africa/Cairo' },
      { name: 'London', zone: 'Europe/London' },
      { name: 'Tokyo', zone: 'Asia/Tokyo' },
      { name: 'New York', zone: 'America/New_York' },
    ],
  });
  const subscribers = new Set<(value: ToolkitState) => void>();
  window.nova.toolkit = {
    get: async () => toolkit.get(),
    save: async (state) => {
      const next = toolkit.save(state);
      subscribers.forEach((callback) => callback(next));
      return next;
    },
    onChange: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    openBookmark: async () => ({ ok: true }),
    copy: async () => ({ ok: true }),
  };
}
