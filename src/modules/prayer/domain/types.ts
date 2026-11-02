export interface CivilDay {
  y: number;
  m: number;
  d: number;
}
export interface PrayerDay {
  date: string;
  times: Record<string, string>;
  hijri: string;
  hijriMonth: number;
  method: string;
  tz: string;
}
export interface PrayerSnapshot {
  city: string;
  today: PrayerDay;
  tomorrow: PrayerDay;
}
export interface PrayerMethod {
  name: string;
  fajr: number;
  isha: number | string;
  maghrib?: number | string;
  tune?: Record<string, number>;
}
