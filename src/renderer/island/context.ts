import type { $, $$ } from '../../shared/renderer/dom';
import type { IslandBridge } from '../../shared/contracts/bridge';
import type { Anchor } from '../../shared/contracts/events';
import type { playTones } from '../../shared/renderer/audio';
import type { IslandState } from './state';

/** Feature views take a Pick of this interface, declaring only the capabilities they use. */
export interface IslandContext {
  $: typeof $;
  $$: typeof $$;
  bridge: IslandBridge;
  island: HTMLElement;
  ICON_X: string;
  state: IslandState;
  internalDrag: boolean;
  readonly anchor: Anchor;
  readonly lastMode: string;
  happenings: { at: number; icon: string; text: string }[];
  esc(value: unknown): string;
  feat(key: string | undefined): boolean;
  celebrate(colors?: string[]): void;
  render(): void;
  note(icon: string, text: string): void;
  showToast(kind: string, label: string, value: string, percentage: number, milliseconds?: number): void;
  playTones: typeof playTones;
  fmt(seconds: number): string;
  compactKind(): string;
  selectTab(tab: string): void;
  refreshTabs(): void;
  positionIsland(): void;
  focusing(): boolean;
}
