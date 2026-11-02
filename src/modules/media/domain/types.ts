export interface AddressBar {
  x: number;
  y: number;
  w: number;
  h: number;
  focus: boolean;
}
export interface MediaSnapshot {
  has: boolean;
  fgProc?: string;
  fgTitle?: string;
  kl?: number;
  thumb?: string;
  playing?: boolean;
  title?: string;
  artist?: string;
  album?: string;
  app?: string;
  art?: string;
  pos?: number;
  dur?: number;
  vol?: number;
  muted?: boolean;
  bright?: number;
  battery?: number;
  charging?: boolean;
  idle?: number;
  fs?: boolean;
  front?: string;
  frontTitle?: string;
  clip?: number;
  clipPriv?: boolean;
  omni?: AddressBar | null;
  kbd?: string;
  caps?: boolean;
  error?: string;
}
export interface MiniRequest {
  app?: string;
  pos?: number;
  playing?: boolean;
  title?: string;
}
export interface MiniResult {
  ok: boolean;
  error?: string;
}
