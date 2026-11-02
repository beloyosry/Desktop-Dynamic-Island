export interface NetworkSnapshot {
  link: string;
  internet: boolean | null;
  since: number;
  prev?: NetworkSnapshot;
}
