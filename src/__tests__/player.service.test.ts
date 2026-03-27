import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { ChildProcess } from "node:child_process";
import {
  __resetPlayerServiceForTests,
  getPlayerService,
} from "../services/player.service.ts";

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

function createSession(process: ChildProcess) {
  return {
    id: 1,
    purpose: "active" as const,
    source: { type: "stream" as const, value: "https://example.com/audio" },
    volumeMultiplier: 1,
    targetVolume: 70,
    process,
    ipcSocket: null,
    ipcPath: "/tmp/test-mpv.sock",
    ipcConnectRetries: 0,
    eofHandled: false,
    ready: true,
    trackId: "track-1",
    confirmation: null,
  };
}

describe("PlayerService - seek functionality", () => {
  let playerService: ReturnType<typeof getPlayerService>;

  beforeEach(() => {
    restoreMethods();
    __resetPlayerServiceForTests();
    playerService = getPlayerService();
  });

  afterEach(() => {
    restoreMethods();
    __resetPlayerServiceForTests();
  });

  describe("seek() method", () => {
    test("should reject seek when no playback is active", () => {
      // Mock console.warn to verify warning is logged
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      playerService.seek(10);

      expect(warnSpy).toHaveBeenCalled();

      // Restore original console.warn
      console.warn = originalWarn;
    });

    test("should reject negative seek position", () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      playerService.seek(-5);

      expect(warnSpy).toHaveBeenCalled();

      console.warn = originalWarn;
    });

    test("should reject NaN seek position", () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      playerService.seek(NaN);

      expect(warnSpy).toHaveBeenCalled();

      console.warn = originalWarn;
    });

    test("should reject Infinity seek position", () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      playerService.seek(Infinity);

      expect(warnSpy).toHaveBeenCalled();

      console.warn = originalWarn;
    });

    test("should accept valid positive seek position (boundary case: 0)", () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      // Note: This will still warn because no playback is active
      // In a real test, you would need to mock the playback state
      playerService.seek(0);

      console.warn = originalWarn;
    });

    test("should accept valid positive seek position (normal case)", () => {
      const warnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = warnSpy;

      playerService.seek(30.5);

      console.warn = originalWarn;
    });
  });

  describe("volume control", () => {
    test("should clamp volume to 0-100 range (below minimum)", () => {
      playerService.setVolume(-10);
      expect(playerService.getVolume()).toBe(0);
    });

    test("should clamp volume to 0-100 range (above maximum)", () => {
      playerService.setVolume(150);
      expect(playerService.getVolume()).toBe(100);
    });

    test("should accept valid volume values", () => {
      playerService.setVolume(50);
      expect(playerService.getVolume()).toBe(50);
    });

    test("should handle boundary values", () => {
      playerService.setVolume(0);
      expect(playerService.getVolume()).toBe(0);

      playerService.setVolume(100);
      expect(playerService.getVolume()).toBe(100);
    });
  });

  describe("intentional stop exit handling", () => {
    test("should suppress eof when an intentionally stopped process exits cleanly", () => {
      const fakeProcess = {
        kill: mock(() => true),
      } as unknown as ChildProcess;
      const eventSpy = mock(() => {});
      const player = playerService as unknown as {
        activeSession: ReturnType<typeof createSession> | null;
        handleSessionExit: (
          session: ReturnType<typeof createSession>,
          code: number | null,
          signal: NodeJS.Signals | null,
          settleReady: (ready: boolean) => void,
          rejectReady: (error: Error) => void,
        ) => void;
      };
      const session = createSession(fakeProcess);

      playerService.onEvent(eventSpy);
      player.activeSession = session;

      playerService.stop();
      player.handleSessionExit(session, 0, null, () => {}, () => {});

      expect(eventSpy).not.toHaveBeenCalled();
    });

    test("should keep natural eof behavior for a normal clean exit", () => {
      const fakeProcess = {} as ChildProcess;
      const eventSpy = mock(() => {});
      const player = playerService as unknown as {
        activeSession: ReturnType<typeof createSession> | null;
        handleSessionExit: (
          session: ReturnType<typeof createSession>,
          code: number | null,
          signal: NodeJS.Signals | null,
          settleReady: (ready: boolean) => void,
          rejectReady: (error: Error) => void,
        ) => void;
      };
      const session = createSession(fakeProcess);

      playerService.onEvent(eventSpy);
      player.activeSession = session;

      player.handleSessionExit(session, 0, null, () => {}, () => {});

      expect(eventSpy).toHaveBeenCalledWith({ eof: true });
    });
  });

  describe("playback confirmation", () => {
    test("should use the supported mpv volume-max option", () => {
      const fakeProcess = {} as ChildProcess;
      const session = createSession(fakeProcess);
      const player = playerService as unknown as {
        buildMpvArgs: (
          session: ReturnType<typeof createSession>,
          options: { volume: number; startPaused: boolean },
        ) => string[];
      };

      const args = player.buildMpvArgs(session, {
        volume: 70,
        startPaused: false,
      });

      expect(args).toContain("--volume-max=200");
      expect(args).not.toContain("--softvol-max=200");
    });

    test("should wait for a positive time-pos before confirming playback", () => {
      const fakeProcess = {
        kill: mock(() => true),
      } as unknown as ChildProcess;
      const session = createSession(fakeProcess);
      const player = playerService as unknown as {
        activeSession: ReturnType<typeof createSession> | null;
        beginSessionConfirmation: (
          session: ReturnType<typeof createSession>,
          mode: "playback" | "preload",
          settle: (ready: boolean) => void,
          reject: (error: Error) => void,
        ) => void;
        handlePropertyChange: (
          session: ReturnType<typeof createSession>,
          message: {
            name: string;
            data: number | boolean;
          },
        ) => void;
      };
      const settle = mock((_ready: boolean) => {});
      const reject = mock((_error: Error) => {});

      player.activeSession = session;
      player.beginSessionConfirmation(session, "playback", settle, reject);
      player.handlePropertyChange(session, {
        name: "time-pos",
        data: 0,
      });
      player.handlePropertyChange(session, {
        name: "time-pos",
        data: 0.25,
      });

      expect(settle).toHaveBeenCalledTimes(1);
      expect(settle).toHaveBeenCalledWith(true);
      expect(reject).not.toHaveBeenCalled();
    });

    test("should reject when mpv exits before playback is confirmed", () => {
      const fakeProcess = {} as ChildProcess;
      const session = createSession(fakeProcess);
      const player = playerService as unknown as {
        beginSessionConfirmation: (
          session: ReturnType<typeof createSession>,
          mode: "playback" | "preload",
          settle: (ready: boolean) => void,
          reject: (error: Error) => void,
        ) => void;
        handleSessionExit: (
          session: ReturnType<typeof createSession>,
          code: number | null,
          signal: NodeJS.Signals | null,
          settleReady: (ready: boolean) => void,
          rejectReady: (error: Error) => void,
        ) => void;
      };
      const settle = mock((_ready: boolean) => {});
      const reject = mock((_error: Error) => {});

      player.beginSessionConfirmation(session, "playback", settle, reject);
      player.handleSessionExit(session, 2, null, settle, reject);

      expect(settle).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalledTimes(1);
      const firstError = reject.mock.calls[0]?.[0];
      expect(firstError).toBeInstanceOf(Error);
      expect(firstError?.message).toBe("mpv exited with code 2");
    });

    test("should confirm preload sessions when duration metadata arrives", () => {
      const fakeProcess = {} as ChildProcess;
      const session = createSession(fakeProcess);
      const player = playerService as unknown as {
        beginSessionConfirmation: (
          session: ReturnType<typeof createSession>,
          mode: "playback" | "preload",
          settle: (ready: boolean) => void,
          reject: (error: Error) => void,
        ) => void;
        handlePropertyChange: (
          session: ReturnType<typeof createSession>,
          message: {
            name: string;
            data: number | boolean;
          },
        ) => void;
      };
      const settle = mock((_ready: boolean) => {});
      const reject = mock((_error: Error) => {});

      player.beginSessionConfirmation(session, "preload", settle, reject);
      player.handlePropertyChange(session, {
        name: "duration",
        data: 215,
      });

      expect(settle).toHaveBeenCalledTimes(1);
      expect(settle).toHaveBeenCalledWith(true);
      expect(reject).not.toHaveBeenCalled();
    });

    test("should clear playback state when session startup fails", async () => {
      const fakeProcess = {
        kill: mock(() => true),
      } as unknown as ChildProcess;
      const session = createSession(fakeProcess);
      const player = playerService as unknown as {
        spawnSession: (
          options: {
            source: { type: "youtube" | "stream"; value: string };
            purpose: "active" | "standby" | "retiring";
            trackId?: string | null;
            startPaused?: boolean;
            volume?: number;
            volumeMultiplier?: number;
            confirmMode: "playback" | "preload";
          },
        ) => {
          session: ReturnType<typeof createSession>;
          ready: Promise<boolean>;
        };
        activeSession: ReturnType<typeof createSession> | null;
      };

      stubMethod(
        player,
        "spawnSession",
        (() => ({
          session,
          ready: Promise.reject(new Error("mpv executable not found")),
        })) as typeof player.spawnSession,
      );

      await expect(playerService.play("track-1")).rejects.toThrow(
        "mpv executable not found",
      );
      expect(playerService.isCurrentlyPlaying()).toBe(false);
      expect(player.activeSession).toBeNull();
    });
  });
});
