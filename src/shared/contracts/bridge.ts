import type { Events, Subscribe, GeneralState, BridgeStatus, IslandRect } from './events';
import type { QuranCatalog } from '../../modules/quran/domain/catalog';
import type { QuranPreferences } from '../../modules/quran/domain/service';
import type { ResourceSnapshot, CleanupResult } from '../../modules/performance/domain/boost';
export interface QuranBridge {
  catalog(refresh?: boolean): Promise<QuranCatalog>;
  preferences(): Promise<QuranPreferences>;
  save(patch: Partial<QuranPreferences>): Promise<QuranPreferences>;
  stream(reciter: number, moshaf: number, surah: number): Promise<string>;
  openSource(): void;
}
export interface PerformanceBridge {
  snapshot(): Promise<ResourceSnapshot>;
  clean(action: 'cache' | 'memory'): Promise<CleanupResult>;
  open(): void;
  onRelease: Subscribe<undefined>;
}
import type { Features } from '../../modules/settings/domain/features';
import type { Notes } from '../../modules/notes/domain/types';
import type { AppEntry } from '../../modules/apps/domain/types';
import type { ShelfItem } from '../../modules/shelf/domain/types';
import type { SystemSnapshot, City, LocationInfo } from '../../modules/system/domain/types';
import type { PrayerSnapshot } from '../../modules/prayer/domain/types';
import type { DownloadsSnapshot, DownloadFolder } from '../../modules/downloads/domain/types';
import type { CalendarSnapshot } from '../../modules/calendar/domain/types';
import type { NetworkSnapshot } from '../../modules/network/domain/types';
import type { MiniRequest, MiniResult } from '../../modules/media/domain/types';
import type { UpdateState } from '../../modules/updates/domain/types';
import type { Profile } from '../../modules/customization/domain/service';
import type { ToolkitState } from '../../modules/toolkit/domain/types';
import type { ModeState } from '../../modules/modes/domain/service';
import type {
  NotificationInput,
  NotificationSnapshot,
  NotificationChange,
} from '../../modules/notifications/domain/history';
export interface NotificationsBridge {
  get(): Promise<NotificationSnapshot>;
  record(input: NotificationInput): Promise<NotificationSnapshot>;
  read(id: string): Promise<NotificationSnapshot>;
  readAll(): Promise<NotificationSnapshot>;
  dismiss(id: string): Promise<NotificationSnapshot>;
  clear(): Promise<NotificationSnapshot>;
  onChange: Subscribe<NotificationChange>;
}
export interface ModesBridge {
  get(): Promise<ModeState>;
  apply(id: string): Promise<ModeState>;
  setMod(id: string, enabled: boolean): Promise<ModeState>;
  favorite(id: string, enabled: boolean): Promise<ModeState>;
  restore(): Promise<ModeState>;
  onChange: Subscribe<ModeState>;
  openLibrary(): void;
}
export interface CustomizationBridge {
  profiles(): Promise<Profile[]>;
  saveProfile(name: string): Promise<Profile[]>;
  removeProfile(id: string): Promise<Profile[]>;
  applyProfile(id: string): Promise<Features>;
  onProfiles: Subscribe<Profile[]>;
  backup(action: 'import' | 'export'): Promise<Result & { cancelled?: boolean }>;
  openSettings(): void;
}
export interface ToolkitBridge {
  get(): Promise<ToolkitState>;
  save(state: ToolkitState): Promise<ToolkitState>;
  onChange: Subscribe<ToolkitState>;
  openBookmark(id: string): Promise<Result>;
  copy(text: string, sensitive?: boolean): Promise<Result>;
}
export interface UpdatesBridge {
  status(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  install(): void;
  openReleases(): void;
  openCenter(): void;
  onState: Subscribe<UpdateState>;
}
export interface Result {
  ok: boolean;
  error?: string;
}
export interface IslandBridge {
  quran: QuranBridge;
  performance: PerformanceBridge;
  notifications: NotificationsBridge;
  modes: ModesBridge;
  customization: CustomizationBridge;
  toolkit: ToolkitBridge;
  updates: UpdatesBridge;
  onMedia: Subscribe<Events['media']>;
  onToggle: Subscribe<undefined>;
  onHover: Subscribe<boolean>;
  onBackdrop: Subscribe<string>;
  onStats: Subscribe<Events['stats']>;
  onClipboard: Subscribe<string[]>;
  onWeather: Subscribe<Events['weather']>;
  onApps: Subscribe<AppEntry[]>;
  onShelf: Subscribe<ShelfItem[]>;
  onAnchor: Subscribe<Events['anchor']>;
  onPrayer: Subscribe<PrayerSnapshot>;
  prayerSnapshot(): Promise<PrayerSnapshot | null>;
  onDownloads: Subscribe<DownloadsSnapshot>;
  onDownloadThumb: Subscribe<Events['dl-thumb']>;
  onFeatures: Subscribe<Features>;
  features(): Promise<Features>;
  setFeatures(patch: Partial<Features>): void;
  openSettings(): void;
  ready(): void;
  onReminderNow: Subscribe<undefined>;
  onVisibility: Subscribe<boolean>;
  onPrivacy: Subscribe<Events['privacy']>;
  onCalendar: Subscribe<CalendarSnapshot>;
  onScreenshot: Subscribe<Events['screenshot']>;
  onNetwork: Subscribe<NetworkSnapshot>;
  onClipSmart: Subscribe<Events['clip-smart']>;
  onNear: Subscribe<Events['near']>;
  clipAction(action: string): void;
  network(): Promise<NetworkSnapshot>;
  onShotSaved: Subscribe<Events['shot-saved']>;
  shotToShelf(): void;
  onUpdate: Subscribe<Events['update']>;
  installUpdate(): void;
  calendar(): Promise<CalendarSnapshot>;
  openMeeting(link: string): void;
  downloads: { snapshot(): Promise<DownloadsSnapshot>; control(id: string, action: string): void };
  dragStart(): void;
  dragEnd(): void;
  setRect(rect: IslandRect): void;
  mediaCmd(command: string): void;
  focusInput(value: boolean): void;
  contextMenu(): void;
  miniOpen(request: MiniRequest): Promise<MiniResult>;
  apps: {
    list(): Promise<AppEntry[]>;
    all(): Promise<AppEntry[]>;
    add(id: string): void;
    remove(id: string): void;
    launch(id: string): void;
    reorder(ids: string[]): void;
  };
  shelf: {
    list(): Promise<ShelfItem[]>;
    addFiles(files: File[]): number;
    remove(path: string): void;
    clear(): void;
    open(path: string): void;
    reveal(path: string): void;
    startDrag(path: string): void;
  };
  system: { snapshot(): Promise<SystemSnapshot>; copyClip(index: number): void; clearClips(): void };
  notes: { get(): Promise<Notes>; save(data: Notes): Promise<Notes> };
  tools: {
    snip(): Promise<Result>;
    captureFull(): Promise<Result>;
    emptyBin(): Promise<Result>;
    lockPc(): Promise<Result>;
    sleepPc(): Promise<Result>;
  };
}
export interface SettingsBridge {
  performance: PerformanceBridge;
  modes: ModesBridge;
  customization: CustomizationBridge;
  updates: UpdatesBridge;
  onPage: Subscribe<string>;
  features(): Promise<Features>;
  setFeatures(patch: Partial<Features>): void;
  resetFeatures(): void;
  onFeatures: Subscribe<Features>;
  general(): Promise<GeneralState>;
  setGeneral(key: string, value: boolean): void;
  onGeneral: Subscribe<GeneralState>;
  window(action: string): void;
  previewReminder(): void;
  bridgeStatus(): Promise<BridgeStatus>;
  openLog(): void;
  copyReport(): Promise<boolean>;
  location(): Promise<LocationInfo>;
  searchCity(query: string): Promise<City[] | null>;
  setLocation(city: City | null): void;
  onLocation: Subscribe<LocationInfo>;
  calendar(): Promise<CalendarSnapshot>;
  setCalendar(url: string): Promise<Result>;
  onCalendar: Subscribe<CalendarSnapshot>;
  openSupport(key: string): void;
  downloadFolders(): Promise<DownloadFolder[]>;
  addDownloadFolder(): Promise<DownloadFolder[]>;
  removeDownloadFolder(path: string): Promise<DownloadFolder[]>;
}
export interface MiniBridge {
  onHover: Subscribe<boolean>;
  time(seconds: number): void;
  close(time: number, resume: boolean): void;
  resizeStart(corner: string): void;
  resizeEnd(): void;
}
