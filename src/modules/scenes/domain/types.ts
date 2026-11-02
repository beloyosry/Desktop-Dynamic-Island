import type { NotificationInput } from '../../notifications/domain/history';
export interface Scene {
  notification?: NotificationInput;
  who: string;
  props?: string[];
  arms?: string;
  tone?: string;
  badge?: string;
  title?: string;
  quran?: boolean;
  sub?: string;
  button?: { label: string; onClick: () => void };
  ms?: number;
  lang?: string;
  onClose?: () => void;
}
