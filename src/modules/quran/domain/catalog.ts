export interface QuranMoshaf {
  id: number;
  name: string;
  server: string;
  surahs: number[];
}
export interface QuranReciter {
  id: number;
  name: string;
  english: string;
  moshafs: QuranMoshaf[];
}
export interface QuranSurah {
  id: number;
  name: string;
  english: string;
}
export interface QuranCatalog {
  reciters: QuranReciter[];
  surahs: QuranSurah[];
  fetchedAt: number;
  stale: boolean;
}
export const CATALOG_TTL = 7 * 24 * 60 * 60 * 1000;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const array = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);
const label = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f]/g, ' ')
        .trim()
        .slice(0, 180)
    : '';
const integer = (value: unknown, max = 100000) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;
export function safeAudioServer(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !/^(cdn|server\d+)\.mp3quran\.net$/.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^\/[a-z\d/_-]*\/$/i.test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function normalizeCatalog(
  ar: unknown,
  en: unknown,
  suwar: unknown,
  englishSuwar: unknown,
  fetchedAt: number,
): QuranCatalog {
  const names = new Map(
    array(object(en).reciters).map((value) => {
      const row = object(value);
      return [row.id, label(row.name)] as const;
    }),
  );
  const seen = new Set<number>();
  const reciters: QuranReciter[] = [];
  for (const value of array(object(ar).reciters).slice(0, 1500)) {
    const row = object(value);
    if (!integer(row.id) || seen.has(Number(row.id)) || !label(row.name)) continue;
    const moshafs: QuranMoshaf[] = [];
    for (const input of array(row.moshaf).slice(0, 50)) {
      const m = object(input),
        server = safeAudioServer(m.server);
      const surahs = [
        ...new Set(
          String(m.surah_list || '')
            .split(',')
            .map(Number)
            .filter((id) => integer(id, 114)),
        ),
      ].sort((a, b) => a - b);
      if (
        !integer(m.id) ||
        !server ||
        !surahs.length ||
        !label(m.name) ||
        moshafs.some((item) => item.id === m.id)
      )
        continue;
      moshafs.push({ id: Number(m.id), name: label(m.name), server, surahs });
    }
    if (!moshafs.length) continue;
    seen.add(Number(row.id));
    reciters.push({ id: Number(row.id), name: label(row.name), english: names.get(row.id) || '', moshafs });
  }
  const surahNames = new Map(
    array(object(englishSuwar).suwar).map((value) => {
      const row = object(value);
      return [row.id, label(row.name)] as const;
    }),
  );
  const surahs: QuranSurah[] = [];
  for (const value of array(object(suwar).suwar)) {
    const row = object(value);
    if (integer(row.id, 114) && label(row.name) && !surahs.some((item) => item.id === row.id))
      surahs.push({ id: Number(row.id), name: label(row.name), english: surahNames.get(row.id) || '' });
  }
  if (!reciters.length || surahs.length !== 114)
    throw new Error('The Quran catalog is incomplete. Please retry.');
  surahs.sort((a, b) => a.id - b.id);
  return { reciters, surahs, fetchedAt, stale: false };
}
export function restoreCatalog(input: unknown): QuranCatalog | null {
  const value = object(input);
  if (!Number.isFinite(value.fetchedAt) || Number(value.fetchedAt) <= 0) return null;
  try {
    return normalizeCatalog(
      {
        reciters: array(value.reciters).map((item) => {
          const r = object(item);
          return {
            ...r,
            moshaf: array(r.moshafs).map((item) => {
              const m = object(item);
              return { ...m, surah_list: array(m.surahs).join(',') };
            }),
          };
        }),
      },
      {
        reciters: array(value.reciters).map((item) => {
          const r = object(item);
          return { id: r.id, name: r.english };
        }),
      },
      { suwar: value.surahs },
      {
        suwar: array(value.surahs).map((item) => {
          const s = object(item);
          return { id: s.id, name: s.english };
        }),
      },
      Number(value.fetchedAt),
    );
  } catch {
    return null;
  }
}
export function audioUrl(catalog: QuranCatalog, reciterId: unknown, moshafId: unknown, surah: unknown) {
  const moshaf = catalog.reciters.find((r) => r.id === reciterId)?.moshafs.find((m) => m.id === moshafId);
  const server = safeAudioServer(moshaf?.server);
  if (!server || !integer(surah, 114) || !moshaf?.surahs.includes(Number(surah)))
    throw new Error('This recitation is unavailable. Choose another surah or reciter.');
  return `${server}${String(surah).padStart(3, '0')}.mp3`;
}
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase()
    .trim();
