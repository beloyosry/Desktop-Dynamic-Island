export interface ShelfEntry {
  path: string;
  until?: number;
}
export interface ShelfItem extends ShelfEntry {
  name: string;
  icon: string;
}
