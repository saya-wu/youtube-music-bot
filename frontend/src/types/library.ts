import type { Track } from "./index";

export interface FavoriteTrack {
  videoId: string;
  track: Track;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  track: Track;
  playedAt: string;
}

export interface SavedMix {
  id: string;
  seedTrack: Track;
  tracks: Track[];
  createdAt: string;
}

export interface PlaylistTrackEntry {
  id: string;
  track: Track;
  addedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: PlaylistTrackEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  kind: "desktop" | "mobile";
  pairedAt: string;
  isCurrentDevice: boolean;
  status: "available" | "coming_soon";
  connected?: boolean;
  lastSeenAt?: string;
}

export interface LibrarySnapshot {
  profileId: string;
  deviceId: string;
  updatedAt: string;
  syncSessionId: string | null;
  syncDeviceToken: string | null;
  favorites: FavoriteTrack[];
  history: HistoryEntry[];
  savedMixes: SavedMix[];
  playlists: Playlist[];
  pairedDevices: PairedDevice[];
}

export interface SyncedLibraryPayload {
  profileId: string;
  updatedAt: string;
  syncSessionId: string | null;
  favorites: FavoriteTrack[];
  history: HistoryEntry[];
  savedMixes: SavedMix[];
  playlists: Playlist[];
}

export interface SyncSessionDevice {
  id: string;
  name: string;
  kind: "desktop" | "mobile";
  connected: boolean;
  pairedAt: string;
  lastSeenAt: string;
}

export interface SyncSessionResponse {
  sessionId: string;
  pairCode: string;
  profileId: string;
  deviceToken: string;
  devices: SyncSessionDevice[];
}
