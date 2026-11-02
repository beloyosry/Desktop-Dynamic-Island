export interface Download {
  id: string;
  name: string;
  source?: string;
  status: string;
  createdAt: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number | null;
  thumbnail?: string;
  path?: string;
  error?: string;
  stage?: string;
}
export interface DownloadsSnapshot {
  online: boolean;
  outdated: boolean;
  canLaunch: boolean;
  items: Download[];
  thumbs?: Record<string, string>;
}
export interface DownloadFolder {
  path: string;
  fixed: boolean;
}
export interface TrackedDownload {
  id: string;
  name: string;
  source: string;
  createdAt: number;
  firstSeen: number;
  size: number;
  at: number;
  grewAt: number;
  speed: number;
}
