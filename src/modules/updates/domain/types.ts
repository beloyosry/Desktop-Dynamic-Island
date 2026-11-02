export type UpdatePhase =
  'idle' | 'checking' | 'current' | 'downloading' | 'ready' | 'installing' | 'error' | 'unavailable';
export type Distribution = 'installed' | 'portable' | 'development';
export interface UpdateState {
  phase: UpdatePhase;
  distribution: Distribution;
  currentVersion: string;
  availableVersion: string | null;
  automatic: boolean;
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  lastChecked: number | null;
  message: string;
}
export type UpdateSignal =
  | { type: 'available'; version: string }
  | { type: 'current' }
  | { type: 'progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { type: 'ready'; version: string }
  | { type: 'error'; error: unknown };
export interface UpdateTransport {
  check(): Promise<void>;
  install(): void;
  configure(automatic: boolean): void;
}
