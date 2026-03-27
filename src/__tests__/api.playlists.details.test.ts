import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import type { PlaylistDetails } from "../types/index.ts";
import {
  __resetMusicServiceForTests,
  getMusicService,
} from "../services/music.service.ts";

type RestorableMethod = {
  target: Record<string, unknown>;
  key: string;
  original: unknown;
};

const restores: RestorableMethod[] = [];

function stubMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
): void {
  restores.push({
    target: target as Record<string, unknown>,
    key: key as string,
    original: target[key],
  });
  target[key] = replacement;
}

function restoreMethods(): void {
  while (restores.length > 0) {
    const restore = restores.pop()!;
    restore.target[restore.key] = restore.original;
  }
}

const playlistDetails: PlaylistDetails = {
  id: "VLplaylist-123",
  title: "春天來了",
  artist: "YouTube Music",
  subtitle: "迎接溫暖！",
  trackSummary: "3 首歌曲",
  thumbnail: "https://example.com/playlist.jpg",
  tracks: [
    {
      videoId: "track-1",
      title: "Spring Song",
      artist: "Artist One",
      duration: 210,
      thumbnail: "https://example.com/track-1.jpg",
    },
  ],
  truncated: false,
};

describe("/api/playlists/:playlistId", () => {
  beforeEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
  });

  test("should return normalized playlist details", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getPlaylistDetails",
      (async (playlistId: string) => ({
        ...playlistDetails,
        id: playlistId,
      })) as typeof musicService.getPlaylistDetails,
    );

    const response = await api.request("/playlists/VLplaylist-123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: playlistDetails,
    });
  });

  test("should return 404 when playlist is unavailable", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getPlaylistDetails",
      (async () => null) as typeof musicService.getPlaylistDetails,
    );

    const response = await api.request("/playlists/missing-playlist");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Playlist not found",
    });
  });
});
