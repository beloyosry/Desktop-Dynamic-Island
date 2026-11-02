export interface Meeting {
  id: string;
  title: string;
  start: number;
  end: number;
  link: string;
}
export interface CalendarSnapshot {
  events: Meeting[];
  error: string;
  updated: number;
  hasUrl?: boolean;
}
