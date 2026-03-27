import { create } from "zustand";

type SelectedArtist = {
  id: string;
  name: string;
};

interface ArtistDialogStore {
  isOpen: boolean;
  selectedArtist: SelectedArtist | null;
  openArtist: (artist: SelectedArtist | null | undefined) => void;
  closeArtist: () => void;
}

export const useArtistDialogStore = create<ArtistDialogStore>((set) => ({
  isOpen: false,
  selectedArtist: null,
  openArtist: (artist) => {
    const artistId = artist?.id?.trim();
    const artistName = artist?.name?.trim();

    if (!artistId || !artistName) {
      return;
    }

    set({
      isOpen: true,
      selectedArtist: {
        id: artistId,
        name: artistName,
      },
    });
  },
  closeArtist: () =>
    set((state) =>
      !state.isOpen && state.selectedArtist === null
        ? state
        : {
            isOpen: false,
            selectedArtist: null,
          },
    ),
}));
