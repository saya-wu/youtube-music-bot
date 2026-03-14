import { create } from "zustand";
import type {
  ConnectionStatus,
  PlaybackState,
  Track,
  LyricLine,
} from "@/types";

interface PlayerStore {
  // 連線狀態
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // 播放狀態
  playbackState: PlaybackState;
  setPlaybackState: (state: PlaybackState) => void;
  updatePlaybackState: (partial: Partial<PlaybackState>) => void;

  // 載入狀態
  isLoadingTrack: boolean;
  loadingMessage: string | null;
  setLoadingTrack: (loading: boolean, message?: string) => void;

  // 歌詞
  lyrics: LyricLine[];
  setLyrics: (lyrics: LyricLine[]) => void;

  // 搜尋結果
  searchResults: Track[];
  setSearchResults: (results: Track[]) => void;
  clearSearchResults: () => void;

  // 手機版搜尋狀態
  isMobileSearchOpen: boolean;
  setMobileSearchOpen: (open: boolean) => void;

  // 手機版 TabBar 狀態
  mobileActiveTab: "search" | "lyrics" | "queue" | "library";
  setMobileActiveTab: (tab: "search" | "lyrics" | "queue" | "library") => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  // 連線狀態
  connectionStatus: "disconnected",
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // 播放狀態
  playbackState: {
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    volume: 50,
    queue: [],
  },
  setPlaybackState: (state) => set({ playbackState: state }),
  updatePlaybackState: (partial) =>
    set((state) => ({
      playbackState: { ...state.playbackState, ...partial },
    })),

  // 載入狀態
  isLoadingTrack: false,
  loadingMessage: null,
  setLoadingTrack: (loading, message) => {
    set({ isLoadingTrack: loading, loadingMessage: message || null });

    // 如果開始載入，設定 10 秒超時自動清除
    if (loading) {
      setTimeout(() => {
        // 如果 10 秒後仍在載入，自動清除
        if (usePlayerStore.getState().isLoadingTrack) {
          set({ isLoadingTrack: false, loadingMessage: null });
        }
      }, 10000);
    }
  },

  // 歌詞
  lyrics: [],
  setLyrics: (lyrics) => set({ lyrics }),

  // 搜尋結果
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),
  clearSearchResults: () => set({ searchResults: [] }),

  // 手機版搜尋狀態
  isMobileSearchOpen: false,
  setMobileSearchOpen: (open) => set({ isMobileSearchOpen: open }),

  // 手機版 TabBar 狀態
  mobileActiveTab: "search",
  setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),
}));
