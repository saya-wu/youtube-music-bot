import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { useLibraryStore, getCurrentDevice } from "@/stores/libraryStore";
import { toSyncedLibraryPayload } from "@/utils/librarySync";
import type { SyncSessionDevice, SyncedLibraryPayload } from "@/types/library";

const SNAPSHOT_SYNC_DEBOUNCE_MS = 400;

function getSyncWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";

  if (import.meta.env.DEV) {
    return "ws://localhost:3000/ws/sync";
  }

  return `${protocol}://${window.location.host}/ws/sync`;
}

export function useLibrarySync(): void {
  const [socketAttempt, setSocketAttempt] = useState(0);
  const snapshot = useLibraryStore((state) => state.snapshot);
  const ready = useLibraryStore((state) => state.ready);
  const syncStatus = useLibraryStore((state) => state.syncStatus);
  const setSyncStatus = useLibraryStore((state) => state.setSyncStatus);
  const applySyncSession = useLibraryStore((state) => state.applySyncSession);
  const updatePairedDevices = useLibraryStore((state) => state.updatePairedDevices);
  const mergeRemoteSnapshot = useLibraryStore((state) => state.mergeRemoteSnapshot);
  const removeSyncSession = useLibraryStore((state) => state.removeSyncSession);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastSentPayloadRef = useRef<string | null>(null);
  const lastRegisteredSessionRef = useRef<string | null>(null);
  const recoveryAttemptKeyRef = useRef<string | null>(null);

  const currentDevice = getCurrentDevice(snapshot);
  const currentDeviceId = currentDevice?.id ?? null;
  const currentDeviceName = currentDevice?.name ?? null;
  const currentDeviceKind = currentDevice?.kind ?? null;
  const snapshotProfileId = snapshot?.profileId ?? "";
  const snapshotSessionId = snapshot?.syncSessionId ?? null;
  const snapshotDeviceToken = snapshot?.syncDeviceToken ?? null;

  const sendSnapshot = (
    nextSnapshot = useLibraryStore.getState().snapshot,
    options: { force?: boolean } = {},
  ): void => {
    if (
      !nextSnapshot?.syncSessionId ||
      socketRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const payload = toSyncedLibraryPayload(nextSnapshot);
    const serializedPayload = JSON.stringify(payload);

    if (!options.force && serializedPayload === lastSentPayloadRef.current) {
      return;
    }

    lastSentPayloadRef.current = serializedPayload;
    socketRef.current.send(
      JSON.stringify({
        type: "sync_snapshot",
        sessionId: nextSnapshot.syncSessionId,
        sourceDeviceId: nextSnapshot.deviceId,
        payload,
      }),
    );
  };

  useEffect(() => {
    if (
      !ready ||
      !snapshot ||
      !currentDeviceId ||
      !currentDeviceName ||
      !currentDeviceKind
    ) {
      return;
    }

    const sessionId = snapshotSessionId;
    const deviceToken = snapshotDeviceToken;
    const profileId = snapshotProfileId;
    const deviceId = currentDeviceId;
    const deviceName = currentDeviceName;
    const deviceKind = currentDeviceKind;
    const recoveryKey = `${sessionId ?? "new"}:${deviceId}:${deviceToken ?? "none"}`;

    let cancelled = false;

    async function bootstrapSyncSession() {
      setSyncStatus("connecting", { error: null });

      const response = await api.createSyncSession({
        sessionId,
        deviceToken,
        profileId,
        device: {
          id: deviceId,
          name: deviceName,
          kind: deviceKind,
        },
      });

      if (cancelled) {
        return;
      }

      if (!response.success || !response.data) {
        if (
          sessionId &&
          (response.code === "SYNC_SESSION_NOT_FOUND" ||
            response.code === "SYNC_REPAIR_REQUIRED") &&
          recoveryAttemptKeyRef.current !== recoveryKey
        ) {
          recoveryAttemptKeyRef.current = recoveryKey;
          lastRegisteredSessionRef.current = null;
          await removeSyncSession();
          setSyncStatus("error", {
            error: "同步裝置需要重新配對，已建立新的本機 session",
          });
          return;
        }

        setSyncStatus("error", {
          error: response.error || "無法建立同步 session",
        });
        return;
      }

      recoveryAttemptKeyRef.current = null;
      await applySyncSession({
        ...response.data,
        pairCode: response.data.pairCode,
      });
    }

    void bootstrapSyncSession();

    return () => {
      cancelled = true;
    };
  }, [
    applySyncSession,
    currentDeviceId,
    currentDeviceKind,
    currentDeviceName,
    ready,
    removeSyncSession,
    setSyncStatus,
    snapshot?.profileId,
    snapshot?.syncDeviceToken,
    snapshot?.syncSessionId,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !snapshotSessionId ||
      !snapshotDeviceToken ||
      !currentDeviceId ||
      !currentDeviceName ||
      !currentDeviceKind
    ) {
      return;
    }

    const ws = new WebSocket(getSyncWebSocketUrl());
    let closedIntentionally = false;
    socketRef.current = ws;
    setSyncStatus("connecting", { error: null });

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      ws.send(
        JSON.stringify({
          type: "sync_register",
          sessionId: snapshotSessionId,
          deviceId: currentDeviceId,
          deviceName: currentDeviceName,
          deviceKind: currentDeviceKind,
          deviceToken: snapshotDeviceToken,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;

        switch (message.type) {
          case "sync_registered":
            lastRegisteredSessionRef.current = String(message.sessionId ?? "");
            void applySyncSession({
              sessionId: String(message.sessionId ?? ""),
              pairCode: String(message.pairCode ?? ""),
              profileId: String(message.profileId ?? snapshotProfileId ?? ""),
              deviceToken: String(
                message.deviceToken ?? snapshotDeviceToken ?? "",
              ),
              devices: Array.isArray(message.devices)
                ? (message.devices as SyncSessionDevice[])
                : [],
            });
            setSyncStatus("connected", {
              pairCode: String(message.pairCode ?? ""),
              error: null,
            });
            sendSnapshot(undefined, { force: true });
            break;

          case "sync_devices":
            if (Array.isArray(message.devices)) {
              void updatePairedDevices(message.devices as SyncSessionDevice[]);
            }
            break;

          case "sync_snapshot_request":
            sendSnapshot(undefined, { force: true });
            break;

          case "sync_snapshot":
            if (message.payload) {
              void mergeRemoteSnapshot(message.payload as SyncedLibraryPayload);
            }
            break;

          case "sync_revoked":
            lastRegisteredSessionRef.current = null;
            void removeSyncSession().then(() => {
              setSyncStatus("error", {
                error: "此裝置已被移出同步 session，請重新配對",
              });
            });
            break;

          case "sync_error":
            setSyncStatus("error", {
              error: String(message.error ?? "同步連線發生錯誤"),
            });
            break;

          default:
            break;
        }
      } catch {
        setSyncStatus("error", {
          error: "同步訊息解析失敗",
        });
      }
    };

    ws.onclose = () => {
      socketRef.current = null;

      if (closedIntentionally) {
        return;
      }

      if (lastRegisteredSessionRef.current !== snapshotSessionId) {
        return;
      }

      if (reconnectAttemptsRef.current >= 5) {
        setSyncStatus("error", { error: "同步連線中斷" });
        return;
      }

      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 8000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        setSyncStatus("connecting", { error: null });
        lastRegisteredSessionRef.current = null;
        setSocketAttempt((attempt) => attempt + 1);
      }, delay);
    };

    return () => {
      closedIntentionally = true;
      ws.close();
      socketRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (snapshotSyncTimeoutRef.current) {
        clearTimeout(snapshotSyncTimeoutRef.current);
        snapshotSyncTimeoutRef.current = null;
      }
    };
  }, [
    applySyncSession,
    currentDeviceId,
    currentDeviceKind,
    currentDeviceName,
    mergeRemoteSnapshot,
    ready,
    removeSyncSession,
    setSyncStatus,
    snapshotDeviceToken,
    snapshotProfileId,
    snapshotSessionId,
    socketAttempt,
    updatePairedDevices,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !snapshotSessionId ||
      !snapshot ||
      syncStatus !== "connected" ||
      socketRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (snapshotSyncTimeoutRef.current) {
      clearTimeout(snapshotSyncTimeoutRef.current);
    }

    snapshotSyncTimeoutRef.current = setTimeout(() => {
      sendSnapshot(snapshot);
      snapshotSyncTimeoutRef.current = null;
    }, SNAPSHOT_SYNC_DEBOUNCE_MS);

    return () => {
      if (snapshotSyncTimeoutRef.current) {
        clearTimeout(snapshotSyncTimeoutRef.current);
        snapshotSyncTimeoutRef.current = null;
      }
    };
  }, [ready, snapshot, snapshotSessionId, syncStatus]);
}
