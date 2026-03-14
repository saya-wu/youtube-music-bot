import type { ApiResponse, Track } from "@/types";

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
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
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
  async createMix(track: Track): Promise<ApiResponse<{ count: number }>> {
    return this.request<{ count: number }>("/mix", {
      method: "POST",
      body: JSON.stringify({ track }),
    });
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

  // 取得當前狀態
  async getState(): Promise<ApiResponse<any>> {
    return this.request<any>("/state");
  }
}

export const api = new ApiService();
