import type { SettingsStore } from '../../../shared/contracts/storage';
import type { Features } from '../../settings/domain/features';

export const CATEGORIES = {
  system: 'System',
  downloads: 'Downloads',
  focus: 'Focus',
  wellbeing: 'Wellbeing',
  reminders: 'Reminders',
  updates: 'Updates',
} as const;
export type NotificationCategory = keyof typeof CATEGORIES;
export interface NotificationInput {
  kind: string;
  title: string;
  detail?: string;
}
export interface IslandNotification extends NotificationInput {
  id: string;
  category: NotificationCategory;
  detail: string;
  createdAt: number;
  read: boolean;
  count: number;
}
export interface NotificationSnapshot {
  items: IslandNotification[];
  unread: number;
}
export interface NotificationChange extends NotificationSnapshot {
  arrivalId?: string;
}
export const HISTORY_LIMIT = 60;
export const HISTORY_AGE = 7 * 24 * 60 * 60 * 1000;
const routes: Record<string, { category: NotificationCategory; feature?: keyof Features }> = {
  charging: { category: 'system', feature: 'battery' },
  battery: { category: 'system', feature: 'battery' },
  low: { category: 'system', feature: 'battery' },
  'net-off': { category: 'system', feature: 'netToasts' },
  'net-on': { category: 'system', feature: 'netToasts' },
  'privacy-cam': { category: 'system', feature: 'privacyDots' },
  'privacy-mic': { category: 'system', feature: 'privacyDots' },
  'dl-start': { category: 'downloads', feature: 'dlToasts' },
  'dl-done': { category: 'downloads', feature: 'dlToasts' },
  'dl-error': { category: 'downloads', feature: 'dlToasts' },
  'shot-auto': { category: 'system', feature: 'screenshotToast' },
  shot: { category: 'system', feature: 'screenshotToast' },
  'shot-saved': { category: 'system', feature: 'screenshotToast' },
  prayer: { category: 'reminders', feature: 'prayerAlerts' },
  'prayer-soon': { category: 'reminders', feature: 'prayerAlerts' },
  reminder: { category: 'reminders', feature: 'reminders' },
  meet: { category: 'reminders', feature: 'meetings' },
  'meet-now': { category: 'reminders', feature: 'meetings' },
  water: { category: 'wellbeing', feature: 'water' },
  focus: { category: 'focus' },
  update: { category: 'updates' },
  preview: { category: 'system' },
};
const cleanText = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, max)
    : '';
export function notificationInput(input: unknown, features?: Partial<Features>) {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const title = cleanText(value.title, 160);
  let kind = value.kind;
  // Transient HUD/keyboard changes and clipboard contents never enter history.
  if (kind === 'done')
    kind = /^(Timer|Focus|Break)\b/i.test(title)
      ? 'focus'
      : /^(Water goal|Glass of water)/i.test(title)
        ? 'water'
        : '';
  if (!title || typeof kind !== 'string' || !Object.hasOwn(routes, kind)) return null;
  const route = routes[kind];
  if (features?.notificationTray === false || (route.feature && features?.[route.feature] === false))
    return null;
  return { kind, title, detail: cleanText(value.detail, 260), category: route.category };
}
export function createNotificationHistory(
  store: SettingsStore,
  now = Date.now,
  id: () => string = () => crypto.randomUUID(),
) {
  const source = store.load<unknown>('notifications.json', []);
  let items: IslandNotification[] = [];
  if (Array.isArray(source)) {
    const seen = new Set<string>();
    for (const row of source.slice(0, HISTORY_LIMIT * 2)) {
      if (!row || typeof row !== 'object') continue;
      const parsed = notificationInput(row);
      if (
        !parsed ||
        typeof row.id !== 'string' ||
        !/^[a-z\d-]{1,64}$/i.test(row.id) ||
        seen.has(row.id) ||
        !Number.isFinite(row.createdAt) ||
        row.createdAt > now() ||
        row.createdAt < now() - HISTORY_AGE
      )
        continue;
      seen.add(row.id);
      items.push({
        ...parsed,
        id: row.id,
        createdAt: row.createdAt,
        read: row.read === true,
        count: Number.isInteger(row.count) ? Math.min(99, Math.max(1, row.count)) : 1,
      });
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    items = items.slice(0, HISTORY_LIMIT);
  }
  const persist = () => store.save('notifications.json', items);
  if (Array.isArray(source) && JSON.stringify(source) !== JSON.stringify(items)) persist();
  function prune() {
    const next = items.filter((item) => item.createdAt >= now() - HISTORY_AGE);
    if (next.length !== items.length) {
      items = next;
      persist();
    }
  }
  const get = (): NotificationSnapshot => {
    prune();
    return { items: structuredClone(items), unread: items.filter((item) => !item.read).length };
  };
  return {
    get,
    add(input: unknown, features?: Partial<Features>): string | undefined {
      const parsed = notificationInput(input, features);
      if (!parsed) return;
      prune();
      const at = now();
      const repeated = items.find(
        (item) =>
          item.kind === parsed.kind &&
          item.title === parsed.title &&
          item.detail === parsed.detail &&
          at - item.createdAt < 15000,
      );
      const entry: IslandNotification = {
        ...parsed,
        id: repeated?.id || id(),
        createdAt: at,
        read: false,
        count: Math.min(99, (repeated?.count || 0) + 1),
      };
      items = [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
      persist();
      return entry.id;
    },
    read(id: unknown) {
      const item = items.find((item) => item.id === id);
      if (item && !item.read) {
        item.read = true;
        persist();
      }
      return get();
    },
    readAll() {
      if (items.some((item) => !item.read)) {
        items.forEach((item) => {
          item.read = true;
        });
        persist();
      }
      return get();
    },
    dismiss(id: unknown) {
      const next = items.filter((item) => item.id !== id);
      if (next.length !== items.length) {
        items = next;
        persist();
      }
      return get();
    },
    clear() {
      items = [];
      persist();
      return get();
    },
  };
}
