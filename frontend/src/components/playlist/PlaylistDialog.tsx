import { useEffect, useMemo, useState } from "react";
import { Heart, Library, ListMusic, Plus, X } from "lucide-react";
import { OpenAlbumButton } from "@/components/album/OpenAlbumButton";
import { OpenArtistButton } from "@/components/artist/OpenArtistButton";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { getCurrentRequester, useLibraryStore } from "@/stores/libraryStore";
import { usePlaylistDialogStore } from "@/stores/playlistDialogStore";
import type { PlaylistDetails, Track } from "@/types";
import { formatTime } from "@/utils/format";

const EMPTY_FAVORITES: Array<{ videoId: string }> = [];

export const PlaylistDialog = () => {
  const isOpen = usePlaylistDialogStore((state) => state.isOpen);
  const selectedPlaylist = usePlaylistDialogStore((state) => state.selectedPlaylist);
  const closePlaylist = usePlaylistDialogStore((state) => state.closePlaylist);
  const selectedPlaylistId = selectedPlaylist?.id ?? null;
  const libraryReady = useLibraryStore((state) => state.ready);
  const favorites = useLibraryStore(
    (state) => state.snapshot?.favorites ?? EMPTY_FAVORITES,
  );
  const currentRequester = useLibraryStore((state) =>
    getCurrentRequester(state.snapshot),
  );
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const openPlaylistPicker = useLibraryStore((state) => state.openPlaylistPicker);
  const { showToast } = useToast();
  const [playlistDetails, setPlaylistDetails] = useState<PlaylistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [isQueueingPlaylist, setIsQueueingPlaylist] = useState(false);
  const [togglingFavoriteTrackId, setTogglingFavoriteTrackId] = useState<string | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const favoriteTrackIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.videoId)),
    [favorites],
  );
  const displayTitle =
    selectedPlaylist?.name || playlistDetails?.title || "播放清單";
  const supportSubtitle =
    playlistDetails?.subtitle ||
    (playlistDetails?.title &&
    selectedPlaylist?.name &&
    playlistDetails.title !== selectedPlaylist.name
      ? playlistDetails.title
      : undefined);

  useEffect(() => {
    if (!isOpen || !selectedPlaylistId) {
      setPlaylistDetails(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadPlaylist(playlistId: string) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.getPlaylist(playlistId);

        if (cancelled) {
          return;
        }

        if (response.success && response.data) {
          setPlaylistDetails(response.data);
          return;
        }

        setPlaylistDetails(null);
        setError(response.error || "播放清單資訊載入失敗");
      } catch {
        if (!cancelled) {
          setPlaylistDetails(null);
          setError("播放清單資訊載入失敗");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPlaylist(selectedPlaylistId);

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadToken, selectedPlaylistId]);

  const handleAddToQueue = async (track: Track) => {
    setAddingTrackId(track.videoId);

    try {
      const response = await api.queueDiscoverTrack(track, currentRequester);
      if (response.success) {
        showToast({
          message: `已加入播放佇列：${track.title}`,
          type: "success",
        });
      } else {
        showToast({
          message: response.error || "加入播放佇列失敗",
          type: "error",
        });
      }
    } catch {
      showToast({ message: "加入播放佇列失敗", type: "error" });
    } finally {
      setAddingTrackId(null);
    }
  };

  const handleToggleFavorite = async (track: Track) => {
    if (!libraryReady) {
      showToast({ message: "媒體庫正在初始化", type: "info" });
      return;
    }

    const wasFavorite = favoriteTrackIds.has(track.videoId);
    setTogglingFavoriteTrackId(track.videoId);

    try {
      await toggleFavorite(track);
      showToast({
        message: wasFavorite ? "已移除收藏" : "已加入收藏",
        type: "success",
      });
    } catch {
      showToast({ message: "收藏更新失敗", type: "error" });
    } finally {
      setTogglingFavoriteTrackId((currentTrackId) =>
        currentTrackId === track.videoId ? null : currentTrackId,
      );
    }
  };

  const handleAddToPlaylist = (track: Track) => {
    if (!libraryReady) {
      showToast({ message: "媒體庫正在初始化", type: "info" });
      return;
    }

    openPlaylistPicker(track);
  };

  const handleQueuePlaylist = async () => {
    if (!playlistDetails || playlistDetails.tracks.length === 0) {
      return;
    }

    setIsQueueingPlaylist(true);

    try {
      const response = await api.queueDiscoverCollection(
        "playlist",
        playlistDetails.id,
        currentRequester,
      );

      if (response.success && response.data) {
        showToast({
          message: `已加入 ${response.data.count} 首歌曲`,
          type: "success",
        });
      } else {
        showToast({
          message: response.error || "加入播放清單失敗",
          type: "error",
        });
      }
    } catch {
      showToast({ message: "加入播放清單失敗", type: "error" });
    } finally {
      setIsQueueingPlaylist(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closePlaylist()}>
      <DialogContent className="flex h-[min(90vh,920px)] w-[min(96vw,980px)] max-w-[980px] flex-col p-0">
        <div className="border-b border-[color:var(--surface-border)] px-6 pb-5 pt-6 lg:px-8 lg:pb-6 lg:pt-7">
          <div className="mb-5 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <DialogTitle className="text-[2rem] font-semibold tracking-tight">
                {displayTitle}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
                {playlistDetails?.artistId ? (
                  <OpenArtistButton
                    artistId={playlistDetails.artistId}
                    artistName={playlistDetails.artist}
                    onNavigate={closePlaylist}
                    className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    labelClassName="text-sm"
                  />
                ) : (
                  <span>{playlistDetails?.artist || "正在載入播放清單資訊"}</span>
                )}
                {playlistDetails?.trackSummary ? (
                  <span>· {playlistDetails.trackSummary}</span>
                ) : null}
                {playlistDetails?.truncated ? (
                  <span>· 目前僅顯示前 200 首</span>
                ) : null}
              </div>
            </div>
            <DialogClose
              className="static shrink-0 rounded-full p-4"
              aria-label="關閉播放清單"
            >
              <X className="h-6 w-6" />
            </DialogClose>
          </div>

          <div className="flex flex-col gap-4 rounded-[28px] border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar
                src={playlistDetails?.thumbnail}
                alt={displayTitle}
                size="lg"
                className="h-24 w-24 rounded-[24px] border border-[color:var(--surface-border)]"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Playlist
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                  {displayTitle}
                </p>
                {supportSubtitle ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {supportSubtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              className="h-11 rounded-2xl px-4 sm:shrink-0"
              onClick={() => void handleQueuePlaylist()}
              disabled={
                !playlistDetails ||
                playlistDetails.tracks.length === 0 ||
                isQueueingPlaylist
              }
            >
              <ListMusic className="h-4 w-4" />
              {isQueueingPlaylist ? "加入中..." : "整張播放清單加入佇列"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 pt-4 lg:px-8 lg:pb-8">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <div className="surface-subtle rounded-[28px] border border-[color:var(--surface-border)] p-6 text-center">
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  播放清單目前無法載入
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {error}
                </p>
                <Button
                  className="mt-4 rounded-2xl"
                  onClick={() => setReloadToken((value) => value + 1)}
                >
                  重新載入
                </Button>
              </div>
            ) : playlistDetails && playlistDetails.tracks.length > 0 ? (
              <div className="space-y-3">
                {playlistDetails.tracks.map((track, index) => {
                  const isFavorite = favoriteTrackIds.has(track.videoId);
                  const isTogglingFavorite = togglingFavoriteTrackId === track.videoId;

                  return (
                    <div
                      key={`${track.videoId}-${index}`}
                      className="surface-card grid items-center gap-4 rounded-[24px] border px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-5 text-center text-sm font-semibold text-[var(--text-muted)]">
                          {index + 1}
                        </span>
                        <Avatar
                          src={track.thumbnail}
                          alt={track.title}
                          size="md"
                          className="rounded-2xl"
                        />
                      </div>

                      <div className="min-w-0">
                        <p
                          className="truncate text-base font-semibold text-[var(--text-primary)]"
                          title={track.title}
                        >
                          {track.title}
                        </p>
                        <p
                          className="mt-1 truncate text-sm text-[var(--text-secondary)]"
                          title={`${track.artist} · ${formatTime(track.duration)}`}
                        >
                          {track.artist} · {formatTime(track.duration)}
                        </p>
                        {track.album ? (
                          <OpenAlbumButton
                            album={track.album}
                            trackTitle={track.title}
                            className="mt-1"
                          />
                        ) : null}
                      </div>

                      <div className="flex justify-end">
                        <div className="grid w-max max-w-full justify-items-stretch gap-2">
                          <div className="grid grid-cols-[max-content_max-content] justify-end gap-2">
                            <Button
                              variant="outline"
                              className={cn(
                                "h-10 rounded-2xl px-3",
                                isFavorite &&
                                  "border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                              )}
                              onClick={() => void handleToggleFavorite(track)}
                              disabled={isTogglingFavorite}
                            >
                              <Heart
                                className="h-4 w-4"
                                fill={isFavorite ? "currentColor" : "none"}
                              />
                              {isTogglingFavorite
                                ? "處理中..."
                                : isFavorite
                                  ? "已收藏"
                                  : "收藏"}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-10 rounded-2xl px-3"
                              onClick={() => handleAddToPlaylist(track)}
                            >
                              <Library className="h-4 w-4" />
                              加入歌單
                            </Button>
                          </div>
                          <Button
                            className="h-10 w-full rounded-2xl px-4"
                            onClick={() => void handleAddToQueue(track)}
                            disabled={addingTrackId === track.videoId}
                          >
                            <Plus className="h-4 w-4" />
                            {addingTrackId === track.videoId ? "加入中..." : "加入佇列"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                title="這個播放清單暫時沒有可顯示的曲目"
                description="稍後再試一次，或換一個播放清單看看。"
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
