import { Hono } from "hono";
import type { ApiResponse, Track } from "../types/index.ts";
import { getMusicService } from "../services/music.service.ts";
import { getQueueService } from "../services/queue.service.ts";

const api = new Hono();

/**
 * GET /api/search?q={query}
 * 搜尋歌曲
 */
api.get("/search", async (c) => {
  const query = c.req.query("q");

  if (!query) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: 'Query parameter "q" is required',
      },
      400,
    );
  }

  try {
    const musicService = getMusicService();
    const tracks = await musicService.search(query, 20);

    return c.json<ApiResponse>({
      success: true,
      data: tracks,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to search",
      },
      500,
    );
  }
});

/**
 * POST /api/queue
 * 點歌（加入播放清單）
 */
api.post("/queue", async (c) => {
  try {
    const body = await c.req.json<{ track: Track }>();

    if (!body.track || !body.track.videoId) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "track is required",
        },
        400,
      );
    }

    const queueService = getQueueService();
    await queueService.addToQueue(body.track);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Added to queue" },
    });
  } catch (error) {
    console.error("Failed to add to queue:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to add to queue",
      },
      500,
    );
  }
});

/**
 * POST /api/mix
 * 創建混合播放清單
 */
api.post("/mix", async (c) => {
  try {
    const body = await c.req.json<{ track: Track }>();

    if (!body.track || !body.track.videoId) {
      return c.json<ApiResponse>(
        { success: false, error: "track is required" },
        400,
      );
    }

    const queueService = getQueueService();
    const tracks = await queueService.createMixFromTrack(body.track);

    return c.json<ApiResponse>({
      success: true,
      data: {
        message: `Added ${tracks.length} tracks to queue`,
        count: tracks.length,
      },
    });
  } catch (error) {
    console.error("Failed to create mix:", error);
    return c.json<ApiResponse>(
      { success: false, error: "Failed to create mix" },
      500,
    );
  }
});

/**
 * GET /api/queue
 * 取得播放清單
 */
api.get("/queue", (c) => {
  const queueService = getQueueService();
  const queue = queueService.getQueue();

  return c.json<ApiResponse>({
    success: true,
    data: queue,
  });
});

/**
 * DELETE /api/queue/:index
 * 從播放清單移除歌曲
 */
api.delete("/queue/:index", (c) => {
  const index = parseInt(c.req.param("index"), 10);

  if (isNaN(index) || index < 0) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid index",
      },
      400,
    );
  }

  try {
    const queueService = getQueueService();
    queueService.removeFromQueue(index);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Removed from queue" },
    });
  } catch (error) {
    console.error("Failed to remove from queue:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to remove from queue",
      },
      500,
    );
  }
});

/**
 * GET /api/state
 * 取得目前播放狀態
 */
api.get("/state", (c) => {
  const queueService = getQueueService();
  const state = queueService.getState();

  return c.json<ApiResponse>({
    success: true,
    data: state,
  });
});

/**
 * GET /api/lyrics
 * 取得目前播放歌曲的歌詞
 */
api.get("/lyrics", async (c) => {
  try {
    const queueService = getQueueService();
    const lyrics = await queueService.getLyrics();

    return c.json<ApiResponse>({
      success: true,
      data: lyrics,
    });
  } catch (error) {
    console.error("Failed to get lyrics:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get lyrics",
      },
      500,
    );
  }
});

/**
 * POST /api/play
 * 繼續播放
 */
api.post("/play", (c) => {
  try {
    const queueService = getQueueService();
    queueService.togglePlayPause();

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Playing" },
    });
  } catch (error) {
    console.error("Failed to play:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to play",
      },
      500,
    );
  }
});

/**
 * POST /api/pause
 * 暫停播放
 */
api.post("/pause", (c) => {
  try {
    const queueService = getQueueService();
    queueService.togglePlayPause();

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Paused" },
    });
  } catch (error) {
    console.error("Failed to pause:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to pause",
      },
      500,
    );
  }
});

/**
 * POST /api/skip
 * 跳過當前歌曲
 */
api.post("/skip", (c) => {
  try {
    const queueService = getQueueService();
    queueService.skip();

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Skipped" },
    });
  } catch (error) {
    console.error("Failed to skip:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to skip",
      },
      500,
    );
  }
});

/**
 * POST /api/volume
 * 調整音量
 */
api.post("/volume", async (c) => {
  try {
    const body = await c.req.json<{ volume: number }>();

    if (
      typeof body.volume !== "number" ||
      body.volume < 0 ||
      body.volume > 100
    ) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Volume must be between 0 and 100",
        },
        400,
      );
    }

    const queueService = getQueueService();
    queueService.setVolume(body.volume);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Volume updated" },
    });
  } catch (error) {
    console.error("Failed to set volume:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to set volume",
      },
      500,
    );
  }
});

/**
 * POST /api/seek
 * 跳轉播放位置
 */
api.post("/seek", async (c) => {
  try {
    const body = await c.req.json<{ position: number }>();

    if (typeof body.position !== "number" || body.position < 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Position must be a non-negative number",
        },
        400,
      );
    }

    const queueService = getQueueService();
    queueService.seekTo(body.position);

    return c.json<ApiResponse>({
      success: true,
      data: { message: "Seeked" },
    });
  } catch (error) {
    console.error("Failed to seek:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to seek",
      },
      500,
    );
  }
});

export default api;
