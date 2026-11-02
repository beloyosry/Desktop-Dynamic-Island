import type { Scene } from '../../modules/scenes/domain/types';
import type { ReminderCard } from '../../modules/reminders/domain/types';
import type { Meeting } from '../../modules/calendar/domain/types';
import type { NotificationInput } from '../../modules/notifications/domain/history';
/** Optional feature capabilities are registered during composition, never on window. */
export const presentation: {
  recordNotification?: (input: NotificationInput) => void;
  openNotifications?: () => void;
  playClickSound?: (frequency?: number, duration?: number, type?: OscillatorType) => void;
  toast?: (icon: string, message: string, duration?: number) => void;
  applyTheme?: (theme: string) => void;
  logWater?: () => void;
  playScene?: (scene: Scene) => boolean;
  sceneShowing?: () => boolean;
  endScene?: () => void;
  showCard?: (card: ReminderCard) => void;
  cardShowing?: () => boolean;
  nextPrayerText?: () => string;
  meetingsToday?: () => Meeting[];
} = {};
