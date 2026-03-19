import { create } from "zustand";
import type { TrackAlbum } from "@/types";

interface AlbumDialogStore {
  isOpen: boolean;
  selectedAlbum: TrackAlbum | null;
  openAlbum: (album: TrackAlbum | null | undefined) => void;
  closeAlbum: () => void;
}

export const useAlbumDialogStore = create<AlbumDialogStore>((set) => ({
  isOpen: false,
  selectedAlbum: null,
  openAlbum: (album) => {
    if (!album?.id?.trim() || !album.name?.trim()) {
      return;
    }

    set({
      isOpen: true,
      selectedAlbum: {
        id: album.id,
        name: album.name,
      },
    });
  },
  closeAlbum: () =>
    set((state) =>
      !state.isOpen && state.selectedAlbum === null
        ? state
        : {
            isOpen: false,
            selectedAlbum: null,
          },
    ),
}));
