import type { ServerWebSocket } from "bun";
import {
  getSyncService,
  SyncServiceError,
} from "../services/sync.service.ts";

export function handleSyncWebSocketOpen(_ws: ServerWebSocket<any>): void {
  // 等待客戶端送出 register 訊息
}

export function handleSyncWebSocketMessage(
  ws: ServerWebSocket<any>,
  message: string,
): void {
  try {
    const data = JSON.parse(message) as Record<string, unknown>;
    const syncService = getSyncService();

    switch (data.type) {
      case "sync_register":
        syncService.registerConnection(ws, {
          sessionId: String(data.sessionId ?? ""),
          device: {
            id: String(data.deviceId ?? ""),
            name: String(data.deviceName ?? ""),
            kind:
              data.deviceKind === "mobile" ? "mobile" : "desktop",
          },
          deviceToken: String(data.deviceToken ?? ""),
        });
        break;

      case "sync_snapshot":
        syncService.relaySnapshot(
          String(data.sessionId ?? ""),
          String(data.sourceDeviceId ?? ""),
          data.payload,
        );
        break;

      default:
        break;
    }
  } catch (error) {
    if (error instanceof SyncServiceError) {
      ws.send(
        JSON.stringify({
          type: "sync_revoked",
          code: error.code,
          error: error.message,
        }),
      );
      ws.close();
      return;
    }

    ws.send(
      JSON.stringify({
        type: "sync_error",
        error: "Invalid sync message",
      }),
    );
  }
}

export function handleSyncWebSocketClose(ws: ServerWebSocket<any>): void {
  getSyncService().disconnectConnection(ws);
}
