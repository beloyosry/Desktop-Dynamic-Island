import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrayerClock } from '../../src/modules/prayer/domain/clock';

test('cached prayer clock preserves timezone, date and seasonal offsets', () => {
  const clock = createPrayerClock();
  assert.equal(clock.at('2026-11-02', '12:00', 'UTC').toISOString(), '2026-11-02T12:00:00.000Z');
  assert.equal(clock.at('2026-11-02', '12:00', 'Asia/Kolkata').toISOString(), '2026-11-02T06:30:00.000Z');
  assert.equal(clock.at('2026-01-02', '12:00', 'America/New_York').toISOString(), '2026-01-02T17:00:00.000Z');
  assert.equal(clock.at('2026-07-02', '12:00', 'America/New_York').toISOString(), '2026-07-02T16:00:00.000Z');
  const original = clock.at('2026-11-02', '12:00', 'UTC');
  original.setFullYear(2000);
  assert.equal(clock.at('2026-11-02', '12:00', 'UTC').toISOString(), '2026-11-02T12:00:00.000Z');
  for (let day = 1; day <= 28; day++)
    for (const hour of ['01:00', '12:00', '23:00'])
      clock.at(`2026-02-${String(day).padStart(2, '0')}`, hour, 'UTC');
  assert.equal(clock.at('2026-11-02', '12:00', 'UTC').toISOString(), '2026-11-02T12:00:00.000Z');
});
test('prayer display keeps the locale format and falls back safely for an invalid zone', () => {
  const clock = createPrayerClock();
  const date = new Date('2026-11-02T12:00:00Z');
  assert.equal(
    clock.format(date, 'Asia/Kolkata'),
    date.toLocaleTimeString([], { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }),
  );
  assert.equal(
    clock.format(date, 'invalid-zone'),
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  );
  assert.equal(+clock.at('2026-11-02', '12:00', 'invalid-zone'), +new Date(2026, 10, 2, 12, 0));
});
