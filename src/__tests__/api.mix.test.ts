import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import api from "../routes/api.ts";
import type { Track } from "../types/index.ts";
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

const baseTrack: Track = {
  videoId: "base-track",
  title: "Base Song",
  artist: "Base Artist",
  duration: 180,
  thumbnail: "https://img.youtube.com/vi/base-track/mqdefault.jpg",
};

describe("/api/mix", () => {
  beforeEach(() => {
    restoreMethods();
    __resetQueueServiceForTests();
  });

  afterEach(() => {
    restoreMethods();
    __resetQueueServiceForTests();
  });

  test("should reject requests without a track", async () => {
    const response = await api.request("/mix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "track is required",
    });
  });

  test("should return the created mix count", async () => {
    const queueService = getQueueService();

    stubMethod(queueService, "createMixFromTrack", async () => [
      baseTrack,
      {
        videoId: "mix-1",
        title: "Mix Song 1",
        artist: "Artist 1",
        duration: 200,
      },
    ]);

    const response = await api.request("/mix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: baseTrack }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        message: "Added 2 tracks to queue",
        count: 2,
      },
    });
  });

  test("should surface service failures as 500 responses", async () => {
    const queueService = getQueueService();

    stubMethod(queueService, "createMixFromTrack", async () => {
      throw new Error("mix failed");
    });

    const response = await api.request("/mix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: baseTrack }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Failed to create mix",
    });
  });
});
