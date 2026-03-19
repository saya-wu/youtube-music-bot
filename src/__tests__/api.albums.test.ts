import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import type { AlbumDetails, QueueOrigin, Track } from "../types/index.ts";
import {
  __resetMusicServiceForTests,
  getMusicService,
} from "../services/music.service.ts";
import {
  __resetQueueServiceForTests,
  getQueueService,
} from "../services/queue.service.ts";

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

const albumDetails: AlbumDetails = {
  id: "album-123",
  title: "Album Title",
  artist: "Album Artist",
  subtitle: "Album • 2026",
  trackSummary: "10 首歌曲",
  thumbnail: "https://example.com/album.jpg",
  tracks: [
    {
      videoId: "track-1",
      title: "Track One",
      artist: "Album Artist",
      duration: 180,
      album: {
        id: "album-123",
        name: "Album Title",
      },
    },
  ],
};

describe("/api/albums/:albumId", () => {
  beforeEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetQueueServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetQueueServiceForTests();
  });

  test("should return normalized album details", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getAlbum",
      (async (albumId: string) => ({
        ...albumDetails,
        id: albumId,
      })) as typeof musicService.getAlbum,
    );

    const response = await api.request("/albums/album-123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: albumDetails,
    });
  });

  test("should return 404 when album is unavailable", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getAlbum",
      (async () => null) as typeof musicService.getAlbum,
    );

    const response = await api.request("/albums/missing-album");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Album not found",
    });
  });
});

describe("/api/albums/:albumId/queue", () => {
  beforeEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetQueueServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetQueueServiceForTests();
  });

  test("should reject album queue requests without tracks", async () => {
    const response = await api.request("/albums/album-123/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: [] }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "tracks is required",
    });
  });

  test("should append all album tracks to the queue", async () => {
    const queueService = getQueueService();
    const received: {
      tracks: Track[];
      origin?: QueueOrigin;
      requestedBy?: Track["requestedBy"];
    } = {
      tracks: [],
    };

    stubMethod(
      queueService,
      "appendTracksToQueue",
      (async (tracks: Track[], origin, options = {}) => {
        received.tracks = tracks;
        received.origin = origin;
        received.requestedBy = options.requestedBy;
      }) as typeof queueService.appendTracksToQueue,
    );

    const response = await api.request("/albums/album-123/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: albumDetails.tracks,
        requestedBy: {
          profileId: "profile-album",
          profileName: "Album Fan",
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(received.tracks).toEqual(albumDetails.tracks);
    expect(received.origin).toBe("manual");
    expect(received.requestedBy).toEqual({
      profileId: "profile-album",
      profileName: "Album Fan",
    });
  });

  test("should surface album queue failures as 500 responses", async () => {
    const queueService = getQueueService();

    stubMethod(queueService, "appendTracksToQueue", async () => {
      throw new Error("album queue failed");
    });

    const response = await api.request("/albums/album-123/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: albumDetails.tracks }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Failed to queue album",
    });
  });
});
