import { describe, expect, test } from "bun:test";
import {
  mergeLibraryPayload,
  mergePairedDevices,
  toSyncedLibraryPayload,
} from "../../frontend/src/utils/librarySync.ts";
import type { LibrarySnapshot } from "../../frontend/src/types/library.ts";

const baseSnapshot: LibrarySnapshot = {
  profileId: "profile-a",
  deviceId: "device-a",
  updatedAt: "2026-03-15T00:00:00.000Z",
  syncSessionId: "session-a",
  syncDeviceToken: "device-token-a",
  favorites: [],
  history: [],
  savedMixes: [],
  playlists: [],
  pairedDevices: [
    {
      id: "device-a",
      name: "Desktop A",
      kind: "desktop",
      pairedAt: "2026-03-15T00:00:00.000Z",
      isCurrentDevice: true,
      status: "available",
      connected: true,
      lastSeenAt: "2026-03-15T00:00:00.000Z",
    },
  ],
};

describe("library sync helpers", () => {
  test("should merge favorites and playlists from another device", () => {
    const merged = mergeLibraryPayload(baseSnapshot, {
      ...toSyncedLibraryPayload(baseSnapshot),
      favorites: [
        {
          videoId: "track-1",
          track: {
            videoId: "track-1",
            title: "Track 1",
            artist: "Artist 1",
            duration: 180,
          },
          createdAt: "2026-03-15T01:00:00.000Z",
          updatedAt: "2026-03-15T01:00:00.000Z",
        },
      ],
      playlists: [
        {
          id: "playlist-1",
          name: "Favorites",
          tracks: [],
          createdAt: "2026-03-15T01:00:00.000Z",
          updatedAt: "2026-03-15T01:00:00.000Z",
        },
      ],
      updatedAt: "2026-03-15T01:00:00.000Z",
    });

    expect(merged.favorites).toHaveLength(1);
    expect(merged.playlists).toHaveLength(1);
    expect(merged.updatedAt).toBe("2026-03-15T01:00:00.000Z");
  });

  test("should project server devices into paired devices with current marker", () => {
    const devices = mergePairedDevices(baseSnapshot.deviceId, [], [
      {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
        connected: true,
        pairedAt: "2026-03-15T00:00:00.000Z",
        lastSeenAt: "2026-03-15T00:00:00.000Z",
      },
      {
        id: "device-b",
        name: "Phone B",
        kind: "mobile",
        connected: false,
        pairedAt: "2026-03-15T00:10:00.000Z",
        lastSeenAt: "2026-03-15T00:20:00.000Z",
      },
    ]);

    expect(devices[0]?.isCurrentDevice).toBe(true);
    expect(devices[1]?.connected).toBe(false);
  });
});
