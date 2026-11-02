export interface Stats {
  cpu: number;
  ram: number;
  ramUsed: number;
  ramTotal: number;
}
export interface Weather {
  humidity?: number;
  wind?: number;
  city: string;
  temp: number;
  code: number;
  isDay: boolean;
  hi: number;
  lo: number;
}
export interface GeoLocation {
  city: string;
  lat: number;
  lon: number;
  country: string;
  timezone: string;
  approx?: boolean;
}
export interface City {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  admin?: string;
}
export interface LocationInfo {
  mode: string;
  name: string;
  country?: string;
}
export interface SystemSnapshot {
  clips: string[];
  weather: Weather | null;
}
