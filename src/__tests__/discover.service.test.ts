import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_DISCOVER_MARKET,
  DISCOVER_MARKETS,
  DiscoverService,
} from "../services/discover.service.ts";
import type {
  DiscoverCollectionItem,
  DiscoverMarketCode,
  DiscoverSection,
  DiscoverTrackItem,
  Track,
} from "../types/index.ts";

function createTrack(videoId: string, title: string): Track {
  return {
    videoId,
    title,
    artist: "Test Artist",
    duration: 180,
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  };
}

function createTrackItem(videoId: string, title: string): DiscoverTrackItem {
  const track = createTrack(videoId, title);
  return {
    kind: "track",
    id: videoId,
    title,
    artist: track.artist,
    thumbnail: track.thumbnail,
    duration: track.duration,
    track,
  };
}

function createCollectionItem(
  id: string,
  title: string,
): DiscoverCollectionItem {
  return {
    kind: "playlist",
    id,
    title,
    artist: "Curator",
    thumbnail: "https://example.com/playlist.jpg",
    trackCount: 20,
    subtitle: "20 首歌曲",
  };
}

function createSection(
  id: string,
  title: string,
  item: DiscoverTrackItem | DiscoverCollectionItem,
): DiscoverSection {
  return {
    id,
    title,
    subtitle: "Section subtitle",
    items: [item],
  };
}

describe("DiscoverService", () => {
  let tempDir: string;
  let service: DiscoverService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "discover-service-"));
    service = new DiscoverService(join(tempDir, "discover.sqlite"));
  });

  afterEach(() => {
    service.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns configured markets and top requested tracks", () => {
    service.recordTrackRequests([
      createTrack("track-1", "Track One"),
      createTrack("track-2", "Track Two"),
      createTrack("track-1", "Track One"),
    ]);

    const response = service.getMarketsResponse();

    expect(response.defaultMarket).toBe(DEFAULT_DISCOVER_MARKET);
    expect(response.markets).toEqual(DISCOVER_MARKETS);
    expect(response.markets).toHaveLength(8);
    expect(response.topRequested).toHaveLength(2);
    expect(response.topRequested[0]).toMatchObject({
      rank: 1,
      requestCount: 2,
      track: {
        videoId: "track-1",
        title: "Track One",
      },
    });
  });

  test("normalizes invalid market input back to TW", async () => {
    let requestedMarket: DiscoverMarketCode | undefined;

    (service as unknown as { getBaseFeed: (market: DiscoverMarketCode) => Promise<unknown> })
      .getBaseFeed = async (market) => {
      requestedMarket = market;
      return {
        market,
        moods: [],
        sections: [createSection("section-1", "熱門內容", createTrackItem("track-1", "Track One"))],
        warnings: [],
        fetchedAt: "2026-03-27T00:00:00.000Z",
      };
    };

    const response = await service.getFeed("not-a-market");

    expect(requestedMarket).toBe(DEFAULT_DISCOVER_MARKET);
    expect(response.market).toBe(DEFAULT_DISCOVER_MARKET);
  });

  test("falls back to the base feed when the mood key is invalid", async () => {
    const baseSection = createSection(
      "base-section",
      "熱門內容",
      createTrackItem("track-1", "Track One"),
    );

    (service as unknown as { getBaseFeed: () => Promise<unknown> }).getBaseFeed =
      async () => ({
        market: "TW",
        moods: [
          {
            key: "mood-1",
            label: "放鬆",
            endpoint: {
              browseId: "FEmusic_mood_relax",
            },
          },
        ],
        sections: [baseSection],
        warnings: ["base warning"],
        fetchedAt: "2026-03-27T00:00:00.000Z",
      });

    const response = await service.getFeed("TW", "missing-mood");

    expect(response.selectedMood).toBeNull();
    expect(response.sections).toEqual([baseSection]);
    expect(response.warnings).toEqual([
      "base warning",
      "Selected mood is no longer available. Showing market feed instead.",
    ]);
  });

  test("returns mood-specific sections when the mood key is still valid", async () => {
    const baseSection = createSection(
      "base-section",
      "熱門內容",
      createTrackItem("track-1", "Track One"),
    );
    const moodSection = createSection(
      "mood-section",
      "今晚派對",
      createCollectionItem("VLparty", "Party Mix"),
    );
    let receivedMoodKey: string | undefined;

    (service as unknown as { getBaseFeed: () => Promise<unknown> }).getBaseFeed =
      async () => ({
        market: "TW",
        moods: [
          {
            key: "mood-1",
            label: "派對",
            endpoint: {
              browseId: "FEmusic_mood_party",
            },
          },
        ],
        sections: [baseSection],
        warnings: ["base warning"],
        fetchedAt: "2026-03-27T00:00:00.000Z",
      });

    (
      service as unknown as {
        getMoodFeed: (
          market: DiscoverMarketCode,
          mood: { key: string; label: string },
        ) => Promise<unknown>;
      }
    ).getMoodFeed = async (_market, mood) => {
      receivedMoodKey = mood.key;
      return {
        sections: [moodSection],
        warnings: ["mood warning"],
        fetchedAt: "2026-03-27T00:05:00.000Z",
      };
    };

    const response = await service.getFeed("TW", "mood-1");

    expect(receivedMoodKey).toBe("mood-1");
    expect(response.selectedMood).toEqual({
      key: "mood-1",
      label: "派對",
    });
    expect(response.sections).toEqual([moodSection]);
    expect(response.warnings).toEqual(["base warning", "mood warning"]);
    expect(response.fetchedAt).toBe("2026-03-27T00:05:00.000Z");
  });
});
