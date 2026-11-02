import type * as ical from 'node-ical';
import type { Meeting } from './types';
const MAX_EVENTS = 12;
const JOIN =
  /https:\/\/(?:meet\.google\.com\/[a-z0-9-]+|teams\.(?:microsoft|live)\.com\/[^\s"'<>]+|(?:[\w-]+\.)?zoom\.us\/(?:j|my|w)\/[^\s"'<>]+|[\w-]+\.webex\.com\/[^\s"'<>]+)/i;
function joinLink(ev: ical.VEvent) {
  const fields = [ev.location, ev.url, ev.description, ev['GOOGLE-CONFERENCE'], ev['X-GOOGLE-CONFERENCE']];
  for (const f of fields) {
    const m = typeof f === 'string' && f.match(JOIN);
    if (m) return m[0].replace(/[).,;]+$/, '');
  }
  return '';
}

const text = (v: string | { val: string } | undefined) => (typeof v === 'string' ? v : v?.val || '').trim();

// one entry per occurrence in [from, to): recurring series expanded, moved / cancelled ones honoured
function occurrences(data: ical.CalendarResponse, from: Date, to: Date) {
  const out: Meeting[] = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== 'VEVENT' || !ev.start || ev.status === 'CANCELLED') continue;
    const dur = (ev.end ? +ev.end : +ev.start) - +ev.start;
    const allDay = ev.datetype === 'date';
    const push = (start: Date, src: ical.VEvent) => {
      const end = new Date(+start + dur);
      if (end <= from || start >= to || allDay) return;
      out.push({
        id: `${ev.uid}|${+start}`,
        title: text(src.summary) || '(No title)',
        start: +start,
        end: +end,
        link: joinLink(src),
      });
    };
    if (ev.rrule) {
      const exdates = new Set(Object.values(ev.exdate || {}).map((d) => +d));
      for (const start of ev.rrule.between(new Date(+from - dur), to, true)) {
        const key = start.toISOString().slice(0, 10);
        const moved = ev.recurrences?.[key];
        if (moved) {
          if (moved.status !== 'CANCELLED') push(moved.start as Date, moved as ical.VEvent);
        } else if (!exdates.has(+start)) {
          push(start, ev);
        }
      }
    } else {
      push(ev.start, ev);
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, MAX_EVENTS);
}

export const isJoinLink = (url: string) =>
  typeof url === 'string' && JOIN.test(url) && url.match(JOIN)![0] === url;
export { occurrences };
