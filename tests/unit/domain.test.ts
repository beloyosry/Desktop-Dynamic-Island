import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as ical from 'node-ical';
import { createJsonStore, type SettingsStore } from '../../src/platform/storage/store';
import { createFeatureService, sanitizeFeatures } from '../../src/modules/settings/domain/service';
import { createNotesService } from '../../src/modules/notes/domain/service';
import { calc, classify } from '../../src/modules/clipboard/domain/classify';
import { calcDay } from '../../src/modules/prayer/domain/calculator';
import { occurrences, isJoinLink } from '../../src/modules/calendar/domain/occurrences';

function memoryStore(): SettingsStore {
  const values = new Map<string, unknown>();
  return {
    load: <T>(name: string, fallback: T) => structuredClone((values.get(name) ?? fallback) as T),
    save: (name, value) => {
      values.set(name, structuredClone(value));
    },
  };
}

test('feature settings reject wrong types, unknown keys, non-finite values and inherited keys', () => {
  assert.deepEqual(
    sanitizeFeatures({
      tabNotes: 'false',
      themePreset: true,
      unknown: true,
      focusMin: Infinity,
      toString: true,
    }),
    {},
  );
  assert.deepEqual(sanitizeFeatures({ focusMin: 200, remindFor: 2, hijriAdjust: -1.7, tabNotes: false }), {
    focusMin: 120,
    remindFor: 5,
    hijriAdjust: -2,
    tabNotes: false,
  });
});
test('feature updates persist, publish copies, unsubscribe and reset', () => {
  const store = memoryStore();
  const features = createFeatureService(store);
  let notifications = 0;
  const stop = features.onChange((value) => {
    notifications++;
    value.tabNotes = true;
  });
  features.set({ tabNotes: false });
  assert.equal(features.get().tabNotes, false);
  assert.equal(createFeatureService(store).get().tabNotes, false);
  stop();
  features.reset();
  assert.equal(features.get().tabNotes, true);
  assert.equal(notifications, 1);
});
test('notes retain text and todos across service instances', () => {
  const store = memoryStore();
  const notes = createNotesService(store);
  const data = { text: 'مرحبا\nA second line', todos: [{ id: 'a', text: 'Task', done: false }] };
  assert.deepEqual(notes.save(data), data);
  assert.deepEqual(createNotesService(store).get(), data);
  assert.deepEqual(notes.save(null), data);
});
test('notes sanitize malformed todos and apply existing limits', () => {
  const notes = createNotesService(memoryStore(), () => 1000);
  assert.deepEqual(notes.save({ text: 5, todos: [null, { text: 'x'.repeat(400) }] }), {
    text: '',
    todos: [{ id: '1000', text: 'x'.repeat(300), done: false }],
  });
  assert.equal(
    notes.save({ todos: Array.from({ length: 75 }, (_, id) => ({ id, text: 'task' })) }).todos.length,
    50,
  );
});
test('JSON storage retains existing file names and recovers from corrupt data', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'nova-store-'));
  try {
    const store = createJsonStore(() => dir);
    assert.deepEqual(store.load('notes.json', { text: '' }), { text: '' });
    store.save('notes.json', { text: 'saved' });
    assert.deepEqual(store.load('notes.json', {}), { text: 'saved' });
    writeFileSync(path.join(dir, 'notes.json'), '{broken');
    assert.deepEqual(store.load('notes.json', []), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('clipboard calculator preserves precedence, percentages and rejects code', () => {
  assert.equal(calc('(1500 - 200) × 15%'), 195);
  assert.equal(calc('2 + 3 * 4'), 14);
  assert.equal(calc('2^3^2'), 512);
  assert.throws(() => calc('process.exit()'));
  assert.throws(() => calc('1/0'));
});
test('clipboard classification distinguishes URLs, colors and arithmetic from dates/phones', () => {
  assert.equal(classify('https://example.com/watch')?.type, 'url');
  assert.deepEqual(classify('#ff6b6b'), { type: 'color', color: '#ff6b6b' });
  assert.deepEqual(classify('2+3*4'), { type: 'math', expr: '2+3*4', result: '14' });
  assert.equal(classify('29/10/2026'), null);
  assert.equal(classify('010-1234-5678'), null);
});
const cairo = { city: 'Cairo', lat: 30.0444, lon: 31.2357, country: 'EG', timezone: 'Africa/Cairo' };
test('prayer times retain country method, chronological daily times and Hanafi adjustment', () => {
  const day = { y: 2026, m: 11, d: 2 };
  const standard = calcDay(day, cairo, cairo.timezone, { asrHanafi: false, hijriAdjust: 0 });
  const hanafi = calcDay(day, cairo, cairo.timezone, { asrHanafi: true, hijriAdjust: 0 });
  assert.equal(standard.date, '2026-11-02');
  assert.equal(standard.method, 'Egyptian General Authority of Survey');
  assert.ok(standard.times.fajr < standard.times.sunrise);
  assert.ok(standard.times.sunrise < standard.times.dhuhr);
  assert.ok(standard.times.dhuhr < standard.times.asr);
  assert.ok(standard.times.asr < standard.times.maghrib);
  assert.ok(standard.times.maghrib < standard.times.isha);
  assert.ok(hanafi.times.asr > standard.times.asr);
  assert.equal(hanafi.times.fajr, standard.times.fajr);
});
test('Hijri date adjustment does not move calculated prayer times', () => {
  const day = { y: 2026, m: 11, d: 2 };
  const a = calcDay(day, cairo, cairo.timezone, { asrHanafi: false, hijriAdjust: 0 });
  const b = calcDay(day, cairo, cairo.timezone, { asrHanafi: false, hijriAdjust: 1 });
  assert.notEqual(a.hijri, b.hijri);
  assert.deepEqual(a.times, b.times);
});
test('calendar expands recurrences, honors exclusions and filters all-day events', () => {
  const source = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:meeting',
    'DTSTART:20261102T090000Z',
    'DTEND:20261102T100000Z',
    'SUMMARY:Daily standup',
    'RRULE:FREQ=DAILY;COUNT=3',
    'EXDATE:20261103T090000Z',
    'LOCATION:https://meet.google.com/abc-defg-hij',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:holiday',
    'DTSTART;VALUE=DATE:20261102',
    'DTEND;VALUE=DATE:20261103',
    'SUMMARY:Holiday',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const events = occurrences(
    ical.sync.parseICS(source),
    new Date('2026-11-02T00:00:00Z'),
    new Date('2026-11-05T00:00:00Z'),
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].title, 'Daily standup');
  assert.equal(events[1].start, Date.parse('2026-11-04T09:00:00Z'));
  assert.equal(events[0].link, 'https://meet.google.com/abc-defg-hij');
});
test('meeting links allow known HTTPS providers only', () => {
  assert.equal(isJoinLink('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(isJoinLink('https://example.com/abc'), false);
  assert.equal(isJoinLink('javascript:alert(1)'), false);
  assert.equal(isJoinLink('https://example.com/?next=https://meet.google.com/abc-defg-hij'), false);
});
