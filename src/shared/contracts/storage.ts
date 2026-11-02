/** Persistence port used by domain services; implementations may be disk or memory. */
export interface SettingsStore {
  load<T>(name: string, fallback: T): T;
  save(name: string, data: unknown): void;
}
