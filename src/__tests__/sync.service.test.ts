import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  __resetSyncServiceForTests,
  getSyncService,
  SyncServiceError,
} from "../services/sync.service.ts";

describe("SyncService", () => {
  let tempDir = "";

  beforeEach(() => {
    __resetSyncServiceForTests();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = mkdtempSync(join(tmpdir(), "youtube-music-bot-sync-"));
    process.env.SYNC_STATE_DB_PATH = join(tempDir, "sync-state.sqlite");
  });

  afterEach(() => {
    __resetSyncServiceForTests();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
    delete process.env.SYNC_STATE_DB_PATH;
  });

  test("should create a session and reuse it on resume after service restart", () => {
    const syncService = getSyncService();

    const firstSession = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    __resetSyncServiceForTests();

    const resumedService = getSyncService();
    const resumedSession = resumedService.createOrResumeSession({
      sessionId: firstSession.sessionId,
      deviceToken: firstSession.deviceToken,
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    expect(resumedSession.sessionId).toBe(firstSession.sessionId);
    expect(resumedSession.pairCode).toBe(firstSession.pairCode);
    expect(resumedSession.deviceToken).toBe(firstSession.deviceToken);
    expect(resumedSession.devices).toHaveLength(1);
  });

  test("should pair a second device via pair code", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    const pairedSession = syncService.pairToSession({
      pairCode: session.pairCode,
      profileId: "profile-b",
      device: {
        id: "device-b",
        name: "Phone B",
        kind: "mobile",
      },
    });

    expect(pairedSession.profileId).toBe("profile-a");
    expect(pairedSession.deviceToken).toBeTruthy();
    expect(pairedSession.devices.map((device) => device.id)).toEqual([
      "device-a",
      "device-b",
    ]);
  });

  test("should revoke removed devices so they cannot resume", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    const pairedSession = syncService.pairToSession({
      pairCode: session.pairCode,
      profileId: "profile-a",
      device: {
        id: "device-b",
        name: "Phone B",
        kind: "mobile",
      },
    });

    syncService.removeDevice(session.sessionId, "device-b");

    expect(syncService.getDevices(session.sessionId).map((device) => device.id)).toEqual([
      "device-a",
    ]);

    try {
      syncService.createOrResumeSession({
        sessionId: session.sessionId,
        deviceToken: pairedSession.deviceToken,
        profileId: "profile-a",
        device: {
          id: "device-b",
          name: "Phone B",
          kind: "mobile",
        },
      });
      throw new Error("Expected createOrResumeSession to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SyncServiceError);
      expect((error as SyncServiceError).code).toBe("SYNC_REPAIR_REQUIRED");
    }
  });

  test("should delete the session when the last device is revoked", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    syncService.removeDevice(session.sessionId, "device-a");

    try {
      syncService.getDevices(session.sessionId);
      throw new Error("Expected getDevices to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SyncServiceError);
      expect((error as SyncServiceError).code).toBe("SYNC_SESSION_NOT_FOUND");
    }
  });

  test("should report devices as disconnected after restart", () => {
    const syncService = getSyncService();
    const session = syncService.createOrResumeSession({
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    __resetSyncServiceForTests();

    const restartedService = getSyncService();
    const resumedSession = restartedService.createOrResumeSession({
      sessionId: session.sessionId,
      deviceToken: session.deviceToken,
      profileId: "profile-a",
      device: {
        id: "device-a",
        name: "Desktop A",
        kind: "desktop",
      },
    });

    expect(resumedSession.devices[0]?.connected).toBe(false);
  });
});
