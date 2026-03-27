import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import type { ArtistDetails } from "../types/index.ts";
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

const artistDetails: ArtistDetails = {
  id: "artist-123",
  name: "周杰倫",
  description: "Artist description",
  subscriberCount: "334萬",
  thumbnail: "https://example.com/artist-thumb.jpg",
  heroImage: "https://example.com/artist-hero.jpg",
  sections: [
    {
      id: "top-songs",
      title: "熱門歌曲",
      items: [
        {
          kind: "track",
          id: "track-1",
          title: "晴天",
          artist: "周杰倫",
          artistId: "artist-123",
          duration: 269,
          track: {
            videoId: "track-1",
            title: "晴天",
            artist: "周杰倫",
            artistId: "artist-123",
            duration: 269,
          },
        },
      ],
    },
  ],
};

describe("/api/artists/:artistId", () => {
  beforeEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
  });

  test("should return normalized artist details", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getArtistDetails",
      (async (artistId: string) => ({
        ...artistDetails,
        id: artistId,
      })) as typeof musicService.getArtistDetails,
    );

    const response = await api.request("/artists/artist-123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: artistDetails,
    });
  });

  test("should return 404 when artist is unavailable", async () => {
    const musicService = getMusicService();

    stubMethod(
      musicService,
      "getArtistDetails",
      (async () => null) as typeof musicService.getArtistDetails,
    );

    const response = await api.request("/artists/missing-artist");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Artist not found",
    });
  });
});
