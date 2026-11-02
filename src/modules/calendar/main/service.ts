import { occurrences, isJoinLink } from '../domain/occurrences';
import type { CalendarSnapshot } from '../domain/types';
import type { EventSender } from '../../../shared/contracts/events';
import { errorMessage } from '../../../shared/errors';
// Upcoming meetings from a private iCal link (Google Calendar, Outlook.com, iCloud: "secret
// address in iCal format"). No sign-in: the link itself is the key, so it is stored only in
// calendar.json in the app's data folder and never logged.
import * as ical from 'node-ical';
import * as settings from '../../../platform/storage/json-store';

const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;
const AHEAD_MS = 24 * 60 * 60 * 1000;
// meeting links worth a Join button

let send: EventSender = () => {};
let cfg = settings.load('calendar.json', { url: '' });
let state: CalendarSnapshot = { events: [], error: '', updated: 0 };
let timer: ReturnType<typeof setTimeout> | undefined;

const normalize = (url: string) =>
  String(url || '')
    .trim()
    .replace(/^webcal:\/\//i, 'https://');
const validUrl = (url: string) => /^https:\/\/[^\s]+$/i.test(url);

async function refresh() {
  clearTimeout(timer);
  const url = normalize(cfg.url);
  if (!url) {
    state = { events: [], error: '', updated: 0 };
    send('calendar', state);
    return;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'text/calendar' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.text();
    if (!body.includes('BEGIN:VCALENDAR')) throw new Error('not an iCal file');
    const now = new Date();
    state = {
      events: occurrences(ical.sync.parseICS(body), now, new Date(+now + AHEAD_MS)),
      error: '',
      updated: Date.now(),
    };
    timer = setTimeout(refresh, REFRESH_MS);
  } catch (err) {
    state = {
      ...state,
      error:
        err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : errorMessage(err).slice(0, 120),
    };
    timer = setTimeout(refresh, RETRY_MS);
  }
  send('calendar', state);
}

function setUrl(url: string) {
  const clean = normalize(url);
  if (clean && !validUrl(clean)) return { ok: false };
  cfg = { url: clean };
  settings.save('calendar.json', cfg);
  refresh();
  return { ok: true };
}

function start(sender: EventSender) {
  send = sender;
  refresh();
}

export { start };
export { refresh };
export { setUrl };
export { occurrences };
export { isJoinLink };
export const snapshot = () => state;
export const hasUrl = () => !!cfg.url;
