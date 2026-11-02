import type { AppEntry } from '../../modules/apps/domain/types';
import type { ShelfItem } from '../../modules/shelf/domain/types';
import type { Stats, Weather, LocationInfo } from '../../modules/system/domain/types';
import type { PrayerSnapshot } from '../../modules/prayer/domain/types';
import type { DownloadsSnapshot } from '../../modules/downloads/domain/types';
import type { Features } from '../../modules/settings/domain/features';
import type { MediaSnapshot } from '../../modules/media/domain/types';
import type { CalendarSnapshot } from '../../modules/calendar/domain/types';
import type { NetworkSnapshot } from '../../modules/network/domain/types';
import type { SmartClip } from '../../modules/clipboard/domain/types';
import type { UpdateState } from '../../modules/updates/domain/types';
import type { Profile } from '../../modules/customization/domain/service';
import type { ToolkitState } from '../../modules/toolkit/domain/types';
import type { ModeState } from '../../modules/modes/domain/service';
import type { NotificationChange } from '../../modules/notifications/domain/history';
export interface Anchor {
  x: number;
  y: number;
  docked: boolean;
  vertical: boolean;
  side: string;
  addr?: string;
  sw?: number;
  sh?: number;
}
export interface IslandRect {
  x: number;
  y: number;
  width: number;
  height: number;
  active?: boolean;
  radius?: number;
}
export interface GeneralState {
  shown: boolean;
  vertical: boolean;
  startWithWindows: boolean;
  version: string;
}
export interface BridgeStatus {
  state: string;
  detail: string;
  engine: string;
}
export interface Events {
  'memory-release': undefined;
  notifications: NotificationChange;
  'modes-state': ModeState;
  profiles: Profile[];
  toolkit: ToolkitState;
  media: MediaSnapshot;
  toggle: undefined;
  hover: boolean;
  backdrop: string;
  stats: Stats;
  clipboard: string[];
  weather: Weather;
  apps: AppEntry[];
  shelf: ShelfItem[];
  anchor: Anchor;
  prayer: PrayerSnapshot;
  downloads: DownloadsSnapshot;
  'dl-thumb': { url: string; data: string };
  features: Features;
  'reminder-now': undefined;
  visibility: boolean;
  privacy: { mic: string[]; cam: string[] };
  calendar: CalendarSnapshot;
  screenshot: { thumb: string; width: number; height: number; auto: boolean };
  network: NetworkSnapshot;
  'clip-smart': SmartClip;
  near: { dx: number; dy: number } | null;
  'shot-saved': { name: string };
  update: { version: string };
  'update-state': UpdateState;
  'settings-page': string;
  general: GeneralState;
  location: LocationInfo;
  'mini-hover': boolean;
}
export type EventSender = <K extends keyof Events>(
  channel: K,
  ...args: Events[K] extends undefined ? [data?: Events[K]] : [data: Events[K]]
) => void;
export type Subscribe<T> = (callback: (data: T) => void) => () => void;
