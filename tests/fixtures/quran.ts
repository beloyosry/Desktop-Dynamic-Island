import type { QuranCatalog } from '../../src/modules/quran/domain/catalog';
export function quranFixture(now = Date.now()): QuranCatalog {
  return {
    fetchedAt: now,
    stale: false,
    reciters: [
      {
        id: 1,
        name: 'مشاري العفاسي',
        english: 'Mishary Alafasi',
        moshafs: [
          {
            id: 10,
            name: 'حفص عن عاصم',
            server: 'https://cdn.mp3quran.net/audio/test/r1/',
            surahs: [1, 2, 3],
          },
          { id: 11, name: 'رواية أخرى', server: 'https://server15.mp3quran.net/test/', surahs: [1, 3] },
        ],
      },
      {
        id: 2,
        name: 'محمود خليل الحصري',
        english: 'Mahmoud Khalil Al-Hussary',
        moshafs: [
          {
            id: 20,
            name: 'حفص عن عاصم',
            server: 'https://cdn.mp3quran.net/audio/test2/r1/',
            surahs: [1, 2, 3, 4],
          },
        ],
      },
    ],
    surahs: Array.from({ length: 114 }, (_, i) => ({
      id: i + 1,
      name: ['الفاتحة', 'البقرة', 'آل عمران', 'النساء'][i] || `سورة اختبار ${i + 1}`,
      english: ['Al-Fatihah', 'Al-Baqarah', 'Aal-Imran', 'An-Nisa'][i] || `Test Surah ${i + 1}`,
    })),
  };
}
export function apiFixture(endpoint: string) {
  const catalog = quranFixture();
  const english = endpoint.endsWith('eng');
  if (endpoint.startsWith('suwar'))
    return { suwar: catalog.surahs.map((s) => ({ id: s.id, name: english ? s.english : s.name })) };
  return {
    reciters: catalog.reciters.map((r) => ({
      id: r.id,
      name: english ? r.english : r.name,
      moshaf: r.moshafs.map((m) => ({ ...m, surah_list: m.surahs.join(',') })),
    })),
  };
}
