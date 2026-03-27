import { create } from "zustand";

type SelectedPlaylist = {
  id: string;
  name: string;
};

interface PlaylistDialogStore {
  isOpen: boolean;
  selectedPlaylist: SelectedPlaylist | null;
  openPlaylist: (playlist: SelectedPlaylist | null | undefined) => void;
  closePlaylist: () => void;
}

export const usePlaylistDialogStore = create<PlaylistDialogStore>((set) => ({
  isOpen: false,
  selectedPlaylist: null,
  openPlaylist: (playlist) => {
    const playlistId = playlist?.id?.trim();
    const playlistName = playlist?.name?.trim();

    if (!playlistId || !playlistName) {
      return;
    }

    set({
      isOpen: true,
      selectedPlaylist: {
        id: playlistId,
        name: playlistName,
      },
    });
  },
  closePlaylist: () =>
    set((state) =>
      !state.isOpen && state.selectedPlaylist === null
        ? state
        : {
            isOpen: false,
            selectedPlaylist: null,
          },
    ),
}));
