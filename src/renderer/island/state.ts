import type { MediaSnapshot } from '../../modules/media/domain/types';
import type { Features } from '../../modules/settings/domain/features';
export interface TimerState {
  total: number;
  remaining: number;
  endAt: number;
  running: boolean;
  phase?: string | null;
}
export interface IslandState {
  overlay: 'commands' | 'notifications' | null;
  hover: boolean;
  pinned: boolean;
  moving: boolean;
  mediaFront: boolean;
  dragging: boolean;
  tab: string;
  playLock?: { until: number; value: boolean } | null;
  media: MediaSnapshot;
  mediaAt: number;
  vol: number | null;
  muted: boolean;
  bright: number;
  volLockUntil: number;
  brightLockUntil: number;
  peekUntil: number;
  toast: string | null;
  toastUntil: number;
  toastAction?: (() => void) | null;
  timer: TimerState;
  dl: { active: boolean; title: string; tab?: boolean };
  features: Partial<Features>;
  visible: boolean;
  reminderUntil: number;
  reminderSize: number[];
  sceneUntil: number;
}
