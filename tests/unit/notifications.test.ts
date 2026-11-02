import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotificationHistory,
  notificationInput,
  HISTORY_AGE,
  HISTORY_LIMIT,
} from '../../src/modules/notifications/domain/history';
import type { SettingsStore } from '../../src/shared/contracts/storage';

function fixture() {
  const values = new Map<string, unknown>();
  const store: SettingsStore = {
    load: <T>(key: string, fallback: T) => structuredClone(values.get(key) ?? fallback) as T,
    save: (key, value) => {
      values.set(key, structuredClone(value));
    },
  };
  let timestamp = 2000000000000,
    sequence = 0;
  const now = () => timestamp;
  const ids = () => `notification-${++sequence}`;
  const history = createNotificationHistory(store, now, ids);
  return {
    history,
    store,
    now,
    ids,
    advance: (ms: number) => {
      timestamp += ms;
    },
  };
}
test('notification capture excludes clipboard contents, transient controls and unknown inputs', () => {
  for (const kind of [
    'clip-url',
    'clip-color',
    'clip-math',
    'clip-text',
    'vol',
    'bright',
    'kbd',
    'caps',
    '__proto__',
  ])
    assert.equal(notificationInput({ kind, title: 'Sensitive content' }), null, kind);
  assert.equal(notificationInput({ kind: 'done', title: 'Copied', detail: 'secret' }), null);
  assert.equal(notificationInput(null), null);
  assert.equal(notificationInput({ kind: 'focus', title: ' ' }), null);
  assert.equal(notificationInput({ kind: 'done', title: 'Timer Done' })?.category, 'focus');
  assert.equal(notificationInput({ kind: 'done', title: 'Glass of water ✓' })?.category, 'wellbeing');
});
test('notification preferences and source feature switches gate recording', () => {
  const { history } = fixture();
  assert.equal(history.add({ kind: 'update', title: 'Ready' }, { notificationTray: false }), undefined);
  assert.equal(history.add({ kind: 'net-on', title: 'Online' }, { netToasts: false }), undefined);
  assert.equal(history.add({ kind: 'water', title: 'Drink' }, { water: false }), undefined);
  assert.equal(history.get().items.length, 0);
  assert.ok(history.add({ kind: 'preview', title: 'Preview' }));
});
test('rapid duplicates coalesce, become unread, and expire from the deduplication window', () => {
  const { history, advance } = fixture();
  const input = { kind: 'dl-done', title: 'report.pdf', detail: 'Done' };
  const id = history.add(input)!;
  history.read(id);
  advance(1000);
  assert.equal(history.add(input), id);
  assert.equal(history.get().items[0].count, 2);
  assert.equal(history.get().unread, 1);
  advance(16000);
  history.add(input);
  assert.equal(history.get().items.length, 2);
});
test('read, dismiss and clear persist and snapshots cannot mutate stored history', () => {
  const { history, store, now, ids } = fixture();
  const id = history.add({ kind: 'focus', title: 'Focus done' })!;
  history.add({ kind: 'update', title: 'Update ready' });
  history.read(id);
  const clone = history.get();
  clone.items[0].title = 'Changed';
  const reloaded = createNotificationHistory(store, now, ids);
  assert.equal(reloaded.get().unread, 1);
  assert.equal(reloaded.get().items[0].title, 'Update ready');
  reloaded.readAll();
  assert.equal(reloaded.get().unread, 0);
  reloaded.dismiss(id);
  assert.equal(reloaded.get().items.length, 1);
  reloaded.clear();
  assert.deepEqual(createNotificationHistory(store, now, ids).get(), { items: [], unread: 0 });
});
test('history has a hard size limit and prunes aged entries from disk without a background timer', () => {
  const { history, advance, store, now, ids } = fixture();
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
    history.add({ kind: 'focus', title: `Session ${i}` });
    advance(1);
  }
  assert.equal(history.get().items.length, HISTORY_LIMIT);
  assert.equal(history.get().items[0].title, 'Session 69');
  advance(HISTORY_AGE + 1);
  assert.equal(createNotificationHistory(store, now, ids).get().items.length, 0);
  assert.deepEqual(store.load('notifications.json', []), []);
});
test('corrupt persisted records are removed and timestamps and categories are validated', () => {
  const { store, now, ids } = fixture();
  store.save('notifications.json', [
    {
      id: 'good',
      kind: 'focus',
      title: 'Complete',
      category: 'injected',
      createdAt: now(),
      read: false,
      count: 200,
    },
    { id: 'good', kind: 'focus', title: 'Duplicate ID', createdAt: now() },
    { id: 'future', kind: 'focus', title: 'Future', createdAt: now() + 1 },
    { id: 'secret', kind: 'clip-text', title: 'Secret', createdAt: now() },
    { id: 'nan', kind: 'focus', title: 'Bad', createdAt: NaN },
  ]);
  const snapshot = createNotificationHistory(store, now, ids).get();
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].category, 'focus');
  assert.equal(snapshot.items[0].count, 99);
  assert.equal(store.load<unknown[]>('notifications.json', []).length, 1);
});
test('notification text preserves Unicode, removes controls and caps stored payloads', () => {
  const value = notificationInput({
    kind: 'prayer',
    title: 'حان وقت الصلاة 🌙\n',
    detail: 'a'.repeat(10000),
    action: 'javascript:evil()',
  })!;
  assert.equal(value.title, 'حان وقت الصلاة 🌙');
  assert.equal(value.detail.length, 260);
  assert.equal(Object.hasOwn(value, 'action'), false);
  assert.equal(notificationInput({ kind: 'focus', title: 'x'.repeat(10000) })?.title.length, 160);
});
