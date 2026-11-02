// Explicit small preview fixture, never shipped in desktop packages.
import type { QuranCatalog } from '../modules/quran/domain/catalog';
const names = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'الأنفال',
  'التوبة',
  'يونس',
];
export const demoQuranCatalog: QuranCatalog = {
  fetchedAt: Date.now(),
  stale: false,
  reciters: [
    {
      id: 1,
      name: 'مشاري العفاسي',
      english: 'Mishary Alafasi',
      moshafs: [
        {
          id: 1,
          name: 'حفص عن عاصم - مرتل',
          server: 'https://cdn.mp3quran.net/audio/mishary/r1/',
          surahs: Array.from({ length: 114 }, (_, i) => i + 1),
        },
      ],
    },
    {
      id: 2,
      name: 'محمود خليل الحصري',
      english: 'Mahmoud Khalil Al-Hussary',
      moshafs: [
        {
          id: 2,
          name: 'حفص عن عاصم - مرتل',
          server: 'https://cdn.mp3quran.net/audio/hussary/r1/',
          surahs: Array.from({ length: 114 }, (_, i) => i + 1),
        },
      ],
    },
    {
      id: 3,
      name: 'محمد صديق المنشاوي',
      english: 'Muhammad Siddiq Al-Minshawi',
      moshafs: [
        {
          id: 3,
          name: 'حفص عن عاصم - مجود',
          server: 'https://cdn.mp3quran.net/audio/minshawi/r1/',
          surahs: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    },
    {
      id: 4,
      name: 'عبد الباسط عبد الصمد',
      english: 'Abdul Basit Abdul Samad',
      moshafs: [
        {
          id: 4,
          name: 'حفص عن عاصم - مجود',
          server: 'https://cdn.mp3quran.net/audio/basit/r1/',
          surahs: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    },
  ],
  surahs: names.map((name, index) => ({
    id: index + 1,
    name,
    english: [
      'Al-Fatihah',
      'Al-Baqarah',
      'Aal-Imran',
      'An-Nisa',
      'Al-Maidah',
      'Al-Anam',
      'Al-Araf',
      'Al-Anfal',
      'At-Tawbah',
      'Yunus',
    ][index],
  })),
};
