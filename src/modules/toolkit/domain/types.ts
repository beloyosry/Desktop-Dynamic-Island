export interface Bookmark {
  id: string;
  name: string;
  url: string;
}
export interface WorldClock {
  id: string;
  name: string;
  zone: string;
}
export interface ToolkitState {
  bookmarks: Bookmark[];
  clocks: WorldClock[];
}
