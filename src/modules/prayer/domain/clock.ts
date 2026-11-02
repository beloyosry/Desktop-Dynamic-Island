/** Reuse expensive Intl formatters and bound the cache for a long-running desktop process. */
export function createPrayerClock() {
  const zones = new Map<string, { parts: Intl.DateTimeFormat; display: Intl.DateTimeFormat }>();
  const instants = new Map<string, number>();
  function formatters(zone: string) {
    const cached = zones.get(zone);
    if (cached) return cached;
    const options = zone ? { timeZone: zone } : {};
    const value = {
      parts: new Intl.DateTimeFormat('en-US', {
        ...options,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }),
      display: new Intl.DateTimeFormat(undefined, { ...options, hour: 'numeric', minute: '2-digit' }),
    };
    if (zones.size >= 4) zones.clear();
    zones.set(zone, value);
    return value;
  }
  return {
    at(date: string, hhmm: string, zone: string) {
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = hhmm.split(':').map(Number);
      const local = () => new Date(year, month - 1, day, hour, minute);
      if (!zone) return local();
      const key = `${zone}|${date}|${hhmm}`;
      const cached = instants.get(key);
      if (cached !== undefined) return new Date(cached);
      try {
        const guess = Date.UTC(year, month - 1, day, hour, minute);
        const parts = Object.fromEntries(
          formatters(zone)
            .parts.formatToParts(guess)
            .map((part) => [part.type, Number(part.value)]),
        );
        const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
        const instant = guess - (shown - guess);
        if (instants.size >= 64) instants.clear();
        instants.set(key, instant);
        return new Date(instant);
      } catch {
        return local();
      }
    },
    format(date: Date, zone: string) {
      try {
        return formatters(zone).display.format(date);
      } catch {
        return formatters('').display.format(date);
      }
    },
  };
}
