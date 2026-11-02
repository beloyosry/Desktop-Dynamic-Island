import { calcDay, dayIn } from '../domain/calculator';
import type { PrayerSnapshot } from '../domain/types';
import type { GeoLocation } from '../../system/domain/types';
import type { EventSender } from '../../../shared/contracts/events';
import { errorMessage } from '../../../shared/errors';
// Prayer times calculated on this PC, no network: the PrayTimes method (praytimes.org, the same
// one the AlAdhan service uses), with the calculation method each country follows (Egyptian
// General Authority of Survey in Egypt, Umm al-Qura in Saudi Arabia, ...). The Hijri date comes
// from the Umm al-Qura calendar built into Chromium. Recalculated just after midnight and when
// the location or the settings change.
import * as settings from '../../../platform/storage/json-store';
import * as features from '../../settings/main/features';

let send: EventSender = () => {};
let getLocation: (() => Promise<GeoLocation>) | null = null;
let data: PrayerSnapshot | null = settings.load('prayer-cache.json', null);
let midnightTimer: ReturnType<typeof setTimeout> | undefined;
let failed = false; // the last run found no location (logged once, until it works again)
let approx = false; // calculated for the time zone's capital, waiting for the real place

async function refresh() {
  clearTimeout(midnightTimer);
  try {
    if (!getLocation) return;
    const loc = await getLocation();
    const zone = loc.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = dayIn(zone, new Date());
    const next = new Date(Date.UTC(today.y, today.m - 1, today.d + 1));
    const tomorrow = { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
    approx = !!loc.approx;
    data = {
      city: `${loc.city || ''}${approx ? ' (approx.)' : ''}`,
      today: calcDay(today, loc, zone, features.get()),
      tomorrow: calcDay(tomorrow, loc, zone, features.get()),
    };
    settings.save('prayer-cache.json', data);
    send('prayer', data);
    if (failed) console.warn('[prayer] back');
    failed = false;
    // next run just after local midnight
    const at = new Date();
    at.setHours(24, 1, 0, 0);
    midnightTimer = setTimeout(refresh, +at - Date.now());
  } catch (err) {
    // only when no location is known yet and the time zone has no fallback city: try again soon
    if (!failed) console.warn('[prayer]', errorMessage(err), '(retrying quietly)');
    failed = true;
    midnightTimer = setTimeout(refresh, 5 * 60 * 1000);
  }
}

// after sleep or a lost connection: recalculate now if the last run failed or was approximate
function retry() {
  if (failed || approx) refresh();
}

function start(sender: EventSender, locate: () => Promise<GeoLocation>) {
  send = sender;
  getLocation = locate;
  refresh();
}

function snapshot() {
  return data;
}

export { start };
export { snapshot };
export { refresh };
export { retry };
export { calcDay };
