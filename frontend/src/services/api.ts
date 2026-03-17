import type { ApiResponse, Track } from "@/types";
import type { SyncSessionResponse } from "@/types/library";

export interface SystemInfoResponse {
  appVersion: string;
  gitSha: string;
  buildVersion: string;
  environment: string;
}

const API_BASE = "/api";

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;

        try {
          const errorPayload = (await response.json()) as ApiResponse;
          if (errorPayload.error) {
            errorMessage = errorPayload.error;
          }
          errorCode = errorPayload.code;
        } catch {
          // 保持預設 HTTP 錯誤訊息
        }

        return {
          success: false,
          error: errorMessage,
          code: errorCode,
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知錯誤",
      };
    }
  }

  // 搜尋音樂
  async search(query: string): Promise<ApiResponse<Track[]>> {
    return this.request<Track[]>(`/search?q=${encodeURIComponent(query)}`);
  }

  // 加入到佇列
  async addToQueue(track: Track): Promise<ApiResponse<void>> {
    return this.request<void>("/queue", {
      method: "POST",
      body: JSON.stringify({ track }),
    });
  }

  // 創建 Mix 混合播放清單
  async createMix(
    track: Track,
  ): Promise<ApiResponse<{ count: number; tracks: Track[] }>> {
    return this.request<{ count: number; tracks: Track[] }>("/mix", {
      method: "POST",
      body: JSON.stringify({ track }),
    });
  }

  async enableRadio(): Promise<ApiResponse<void>> {
    return this.request<void>("/radio/enable", { method: "POST" });
  }

  async disableRadio(): Promise<ApiResponse<void>> {
    return this.request<void>("/radio/disable", { method: "POST" });
  }

  async toggleRadio(): Promise<ApiResponse<void>> {
    return this.request<void>("/radio/toggle", { method: "POST" });
  }

  // 播放
  async play(): Promise<ApiResponse<void>> {
    return this.request<void>("/play", { method: "POST" });
  }

  // 暫停
  async pause(): Promise<ApiResponse<void>> {
    return this.request<void>("/pause", { method: "POST" });
  }

  // 跳過
  async skip(): Promise<ApiResponse<void>> {
    return this.request<void>("/skip", { method: "POST" });
  }

  // 調整音量
  async setVolume(volume: number): Promise<ApiResponse<void>> {
    return this.request<void>("/volume", {
      method: "POST",
      body: JSON.stringify({ volume }),
    });
  }

  // 跳轉播放位置
  async seek(position: number): Promise<ApiResponse<void>> {
    return this.request<void>("/seek", {
      method: "POST",
      body: JSON.stringify({ position }),
    });
  }

  // 從佇列移除
  async removeFromQueue(index: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/queue/${index}`, { method: "DELETE" });
  }

  // 重新排序佇列
  async reorderQueue(
    fromIndex: number,
    toIndex: number,
  ): Promise<ApiResponse<void>> {
    return this.request<void>("/queue/reorder", {
      method: "POST",
      body: JSON.stringify({ fromIndex, toIndex }),
    });
  }

  async playPlaylist(
    playlistId: string,
    tracks: Track[],
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/library/playlists/${playlistId}/play`, {
      method: "POST",
      body: JSON.stringify({ tracks }),
    });
  }

  async queuePlaylist(
    playlistId: string,
    tracks: Track[],
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/library/playlists/${playlistId}/queue`, {
      method: "POST",
      body: JSON.stringify({ tracks }),
    });
  }

  async createSyncSession(payload: {
    sessionId?: string | null;
    deviceToken?: string | null;
    profileId: string;
    device: {
      id: string;
      name: string;
      kind: "desktop" | "mobile";
    };
  }): Promise<ApiResponse<SyncSessionResponse>> {
    return this.request<SyncSessionResponse>("/sync/session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async pairSyncSession(payload: {
    pairCode: string;
    profileId: string;
    device: {
      id: string;
      name: string;
      kind: "desktop" | "mobile";
    };
  }): Promise<ApiResponse<SyncSessionResponse>> {
    return this.request<SyncSessionResponse>("/sync/pair", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getSyncDevices(
    sessionId: string,
  ): Promise<ApiResponse<{ devices: SyncSessionResponse["devices"] }>> {
    return this.request<{ devices: SyncSessionResponse["devices"] }>(
      `/sync/devices?sessionId=${encodeURIComponent(sessionId)}`,
    );
  }

  async removeSyncDevice(
    sessionId: string,
    deviceId: string,
  ): Promise<ApiResponse<void>> {
    return this.request<void>(
      `/sync/devices/${encodeURIComponent(deviceId)}?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
      },
    );
  }

  // 取得當前狀態
  async getState(): Promise<ApiResponse<any>> {
    return this.request<any>("/state");
  }

  async getSystemInfo(): Promise<ApiResponse<SystemInfoResponse>> {
    return this.request<SystemInfoResponse>("/system/info");
  }
}

export const api = new ApiService();
