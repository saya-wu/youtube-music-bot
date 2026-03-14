import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import type { Track } from "../types/index.ts";
import {
  __resetMusicServiceForTests,
  getMusicService,
} from "../services/music.service.ts";
import {
  __resetPlayerServiceForTests,
  getPlayerService,
} from "../services/player.service.ts";
import {
  __resetQueueServiceForTests,
  getQueueService,
} from "../services/queue.service.ts";

const baseTrack: Track = {
  videoId: "base-track",
  title: "Base Song",
  artist: "Base Artist",
  duration: 180,
  thumbnail: "https://img.youtube.com/vi/base-track/mqdefault.jpg",
};

const mixTracks: Track[] = [
  {
    videoId: "mix-1",
    title: "Mix Song 1",
    artist: "Artist 1",
    duration: 200,
    thumbnail: "https://img.youtube.com/vi/mix-1/mqdefault.jpg",
  },
  {
    videoId: "mix-2",
    title: "Mix Song 2",
    artist: "Artist 2",
    duration: 220,
    thumbnail: "https://img.youtube.com/vi/mix-2/mqdefault.jpg",
  },
];

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

describe("QueueService mix creation", () => {
  beforeEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetPlayerServiceForTests();
    __resetQueueServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetMusicServiceForTests();
    __resetPlayerServiceForTests();
    __resetQueueServiceForTests();
  });

  test("should create a mix, clear previous queue, and start playback", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();
    let stopCalls = 0;
    let playCalls = 0;
    let getMixTracksCalls = 0;

    stubMethod(playerService, "stop", async () => {
      stopCalls++;
    });
    stubMethod(playerService, "isCurrentlyPlaying", () => true);
    stubMethod(playerService, "play", async (videoId: string) => {
      playCalls++;
      expect(videoId).toBe(baseTrack.videoId);
    });
    stubMethod(playerService, "playUrl", async () => {
      throw new Error("playUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getMixTracks", async (videoId: string) => {
      getMixTracksCalls++;
      expect(videoId).toBe(baseTrack.videoId);
      return mixTracks;
    });
    stubMethod(musicService, "getStreamUrl", async () => {
      throw new Error("getStreamUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getLyrics", async () => []);

    await queueService.addToQueue({
      videoId: "old-track",
      title: "Old Song",
      artist: "Old Artist",
      duration: 123,
    });

    const tracks = await queueService.createMixFromTrack(baseTrack);
    const state = queueService.getState();

    expect(stopCalls).toBeGreaterThanOrEqual(1);
    expect(playCalls).toBe(1);
    expect(getMixTracksCalls).toBe(1);
    expect(tracks).toEqual([baseTrack, ...mixTracks]);
    expect(state.currentTrack).toEqual(baseTrack);
    expect(state.duration).toBe(baseTrack.duration);
    expect(state.queue).toEqual(mixTracks);
    expect(queueService.getQueue()).toEqual(mixTracks);
  });

  test("should start playing the base track before mix suggestions finish loading", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();
    let resolveMixTracks: ((tracks: Track[]) => void) | null = null;
    let notifyMixFetchStarted: (() => void) | null = null;
    let playCalls = 0;
    const mixFetchStarted = new Promise<void>((resolve) => {
      notifyMixFetchStarted = resolve;
    });

    stubMethod(playerService, "stop", async () => {});
    stubMethod(playerService, "play", async (videoId: string) => {
      playCalls++;
      expect(videoId).toBe(baseTrack.videoId);
    });
    stubMethod(playerService, "playUrl", async () => {
      throw new Error("playUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getMixTracks", async () => {
      notifyMixFetchStarted?.();
      return await new Promise<Track[]>((resolve) => {
        resolveMixTracks = resolve;
      });
    });
    stubMethod(musicService, "getStreamUrl", async () => {
      throw new Error("getStreamUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getLyrics", async () => []);

    const pendingMix = queueService.createMixFromTrack(baseTrack);

    await mixFetchStarted;

    expect(playCalls).toBe(1);
    expect(queueService.getState().currentTrack).toEqual(baseTrack);
    expect(queueService.getQueue()).toEqual([]);

    if (!resolveMixTracks) {
      throw new Error("Expected mix resolver to be assigned");
    }
    const resolver = resolveMixTracks as (tracks: Track[]) => void;
    resolver(mixTracks);

    const tracks = await pendingMix;
    expect(tracks).toEqual([baseTrack, ...mixTracks]);
    expect(queueService.getQueue()).toEqual(mixTracks);
  });

  test("should fall back to the base track when fetching mix tracks fails", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();
    let playCalls = 0;

    stubMethod(playerService, "stop", async () => {});
    stubMethod(playerService, "play", async () => {
      playCalls++;
    });
    stubMethod(playerService, "playUrl", async () => {
      throw new Error("playUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getMixTracks", async () => {
      throw new Error("up next failed");
    });
    stubMethod(musicService, "getStreamUrl", async () => {
      throw new Error("getStreamUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getLyrics", async () => []);

    const tracks = await queueService.createMixFromTrack(baseTrack);
    const state = queueService.getState();

    expect(playCalls).toBe(1);
    expect(tracks).toEqual([baseTrack]);
    expect(state.currentTrack).toEqual(baseTrack);
    expect(state.queue).toEqual([]);
  });

  test("should ignore a delayed exit from the intentionally stopped previous player", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();
    const oldProcess = {
      kill: () => true,
    } as unknown as ChildProcess;
    const player = playerService as unknown as {
      mpvProcess: ChildProcess | null;
      isPlaying: boolean;
      eofHandled: boolean;
      handleSpawnedProcessExit: (
        process: ChildProcess,
        code: number | null,
        signal: NodeJS.Signals | null,
        handleSuccess: () => void,
        handleError: (error: Error) => void,
      ) => void;
    };
    let playCalls = 0;

    player.mpvProcess = oldProcess;
    player.isPlaying = true;
    player.eofHandled = false;

    stubMethod(playerService, "play", async (videoId: string) => {
      playCalls++;
      expect(videoId).toBe(playCalls === 1 ? baseTrack.videoId : mixTracks[0]!.videoId);
    });
    stubMethod(playerService, "playUrl", async () => {
      throw new Error("playUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getMixTracks", async () => mixTracks);
    stubMethod(musicService, "getStreamUrl", async () => {
      throw new Error("getStreamUrl() should not be used when play() succeeds");
    });
    stubMethod(musicService, "getLyrics", async () => []);

    const tracks = await queueService.createMixFromTrack(baseTrack);

    player.handleSpawnedProcessExit(oldProcess, 0, null, () => {}, () => {});
    await Promise.resolve();

    expect(playCalls).toBe(1);
    expect(tracks).toEqual([baseTrack, ...mixTracks]);
    expect(queueService.getState().currentTrack).toEqual(baseTrack);
    expect(queueService.getQueue()).toEqual(mixTracks);
  });

  test("should fall back to direct stream playback when player.play fails", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();
    let playUrlCalls = 0;

    stubMethod(playerService, "stop", async () => {});
    stubMethod(playerService, "play", async () => {
      throw new Error("yt-dlp playback failed");
    });
    stubMethod(playerService, "playUrl", async (url: string) => {
      playUrlCalls++;
      expect(url).toBe("https://stream/base-track");
    });
    stubMethod(musicService, "getMixTracks", async () => mixTracks);
    stubMethod(musicService, "getStreamUrl", async () => {
      return { url: "https://stream/base-track", source: "youtube-ext" as const };
    });
    stubMethod(musicService, "getLyrics", async () => []);

    const tracks = await queueService.createMixFromTrack(baseTrack);

    expect(playUrlCalls).toBe(1);
    expect(tracks).toEqual([baseTrack, ...mixTracks]);
    expect(queueService.getState().currentTrack).toEqual(baseTrack);
  });

  test("should reset current playback state when both playback strategies fail", async () => {
    const queueService = getQueueService();
    const playerService = getPlayerService();
    const musicService = getMusicService();

    stubMethod(playerService, "stop", async () => {});
    stubMethod(playerService, "play", async () => {
      throw new Error("yt-dlp fallback failed");
    });
    stubMethod(playerService, "playUrl", async () => {
      throw new Error("stream playback failed");
    });
    stubMethod(musicService, "getMixTracks", async () => mixTracks);
    stubMethod(musicService, "getStreamUrl", async () => {
      return { url: "https://stream/base-track", source: "youtube-ext" as const };
    });
    stubMethod(musicService, "getLyrics", async () => []);

    await expect(queueService.createMixFromTrack(baseTrack)).rejects.toThrow(
      "Failed to play track: Base Song. Error: stream playback failed",
    );

    const state = queueService.getState();
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
  });
});
