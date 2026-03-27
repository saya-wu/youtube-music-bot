import { create } from "zustand";

type DesktopMode = "player" | "library" | "discover";
type MobileNowPlayingView = "player" | "lyrics" | "queue";

interface AppUiStore {
  desktopMode: DesktopMode;
  setDesktopMode: (mode: DesktopMode) => void;
  isMobileNowPlayingOpen: boolean;
  setMobileNowPlayingOpen: (open: boolean) => void;
  mobileNowPlayingView: MobileNowPlayingView;
  setMobileNowPlayingView: (view: MobileNowPlayingView) => void;
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  desktopMode: "player",
  setDesktopMode: (desktopMode) => set({ desktopMode }),
  isMobileNowPlayingOpen: false,
  setMobileNowPlayingOpen: (isMobileNowPlayingOpen) =>
    set({ isMobileNowPlayingOpen }),
  mobileNowPlayingView: "player",
  setMobileNowPlayingView: (mobileNowPlayingView) => set({ mobileNowPlayingView }),
}));
