import { describe, expect, test } from "bun:test";
import { normalizeMixTracks } from "../services/music.service.ts";

describe("MusicService mix normalization", () => {
  test("should normalize valid mix items and apply field fallbacks", () => {
    const tracks = normalizeMixTracks(
      [
        {
          video_id: "seed-video",
          title: "Seed track",
          artists: [{ name: "Seed Artist" }],
          duration: { seconds: 180 },
        },
        {
          id: "track-1",
          title: { text: "Object title" },
          artists: [{ name: "Artist A" }, { name: "Artist B" }],
          duration: { seconds: 200 },
        },
        {
          video_id: "track-2",
          title: "Author fallback",
          author: "Solo Artist",
          duration: 210,
        },
        {
          video_id: "track-3",
          title: "Author object fallback",
          author: { name: "Object Artist" },
        },
      ],
      "seed-video",
      10,
    );

    expect(tracks).toEqual([
      {
        videoId: "track-1",
        title: "Object title",
        artist: "Artist A, Artist B",
        duration: 200,
        thumbnail: "https://img.youtube.com/vi/track-1/mqdefault.jpg",
      },
      {
        videoId: "track-2",
        title: "Author fallback",
        artist: "Solo Artist",
        duration: 210,
        thumbnail: "https://img.youtube.com/vi/track-2/mqdefault.jpg",
      },
      {
        videoId: "track-3",
        title: "Author object fallback",
        artist: "Object Artist",
        duration: 0,
        thumbnail: "https://img.youtube.com/vi/track-3/mqdefault.jpg",
      },
    ]);
  });

  test("should skip invalid items and respect the limit", () => {
    const tracks = normalizeMixTracks(
      [
        {
          video_id: "missing-title",
          artists: [{ name: "No Title" }],
        },
        {
          title: "missing-video-id",
          artists: [{ name: "No Video ID" }],
        },
        {
          video_id: "track-1",
          title: "First valid",
          artists: [],
        },
        {
          video_id: "track-2",
          title: { text: "Second valid" },
          author: { name: "Fallback Artist" },
        },
        {
          video_id: "track-3",
          title: "Third valid",
          author: "Ignored because of limit",
        },
      ],
      "seed-video",
      2,
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      videoId: "track-1",
      title: "First valid",
      artist: "Unknown",
    });
    expect(tracks[1]).toMatchObject({
      videoId: "track-2",
      title: "Second valid",
      artist: "Fallback Artist",
    });
  });
});
