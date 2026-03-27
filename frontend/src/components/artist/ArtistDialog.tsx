import { useEffect, useMemo, useState } from "react";
import {
  Disc3,
  Heart,
  ListMusic,
  Loader2,
  PlayCircle,
  Radio,
  UserRound,
  X,
} from "lucide-react";
import { OpenAlbumButton } from "@/components/album/OpenAlbumButton";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAlbumDialogStore } from "@/stores/albumDialogStore";
import { useArtistDialogStore } from "@/stores/artistDialogStore";
import { getCurrentRequester, useLibraryStore } from "@/stores/libraryStore";
import { usePlaylistDialogStore } from "@/stores/playlistDialogStore";
import type {
  ArtistDetails,
  ArtistSection,
  DiscoverCollectionItem,
  DiscoverTrackItem,
  Track,
} from "@/types";
import { deferDialogNavigation } from "@/utils/deferDialogNavigation";
import { formatTime } from "@/utils/format";

const EMPTY_FAVORITES: Array<{ videoId: string }> = [];

function ArtistSectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      {subtitle ? (
        <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ArtistTrackSection({
  section,
  onQueueTrack,
  onCreateMix,
  onToggleFavorite,
  favoriteTrackIds,
  favoriteDisabled,
  pendingTrackId,
  creatingMixId,
  onBeforeOpenAlbum,
}: {
  section: ArtistSection;
  onQueueTrack: (track: Track) => Promise<void>;
  onCreateMix: (track: Track) => Promise<void>;
  onToggleFavorite: (track: Track) => Promise<void>;
  favoriteTrackIds: ReadonlySet<string>;
  favoriteDisabled: boolean;
  pendingTrackId: string | null;
  creatingMixId: string | null;
  onBeforeOpenAlbum: () => void;
}) {
  return (
    <section className="space-y-4">
      <ArtistSectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="space-y-3">
        {section.items.map((item, index) => {
          if (item.kind !== "track") {
            return null;
          }

          const trackItem = item as DiscoverTrackItem;
          const isFavorite = favoriteTrackIds.has(trackItem.track.videoId);

          return (
            <Card
              key={`${trackItem.kind}:${trackItem.id}`}
              className="rounded-[28px] border p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <Avatar
                    src={trackItem.thumbnail || trackItem.track.thumbnail}
                    alt={trackItem.title}
                    size="lg"
                    className="h-16 w-16 rounded-[20px] border border-[color:var(--surface-border)]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                      {trackItem.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {trackItem.artist} · {formatTime(trackItem.duration || trackItem.track.duration || 0)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trackItem.track.album ? (
                        <OpenAlbumButton
                          album={trackItem.track.album}
                          trackTitle={trackItem.track.title}
                          onNavigate={onBeforeOpenAlbum}
                          className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                          labelClassName="text-[11px]"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
                  <Button
                    type="button"
                    onClick={() => {
                      void onQueueTrack(trackItem.track);
                    }}
                    disabled={
                      pendingTrackId === trackItem.track.videoId ||
                      creatingMixId === trackItem.track.videoId
                    }
                    className="rounded-[16px]"
                  >
                    {pendingTrackId === trackItem.track.videoId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        加入中
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        加入佇列
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void onCreateMix(trackItem.track);
                    }}
                    disabled={
                      pendingTrackId === trackItem.track.videoId ||
                      creatingMixId === trackItem.track.videoId
                    }
                    className="rounded-[16px]"
                  >
                    {creatingMixId === trackItem.track.videoId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        建立中
                      </>
                    ) : (
                      <>
                        <Radio className="h-4 w-4" />
                        建立 Mix
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant={isFavorite ? "default" : "outline"}
                    onClick={() => {
                      void onToggleFavorite(trackItem.track);
                    }}
                    disabled={favoriteDisabled}
                    className={cn(
                      "rounded-[16px]",
                      isFavorite &&
                        "border-[color:var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                    )}
                  >
                    <Heart
                      className={cn("h-4 w-4", isFavorite ? "fill-current" : "")}
                    />
                    {isFavorite ? "已收藏" : "收藏"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ArtistCollectionSection({
  section,
  onQueueCollection,
  pendingCollectionId,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  section: ArtistSection;
  onQueueCollection: (item: DiscoverCollectionItem) => Promise<void>;
  pendingCollectionId: string | null;
  onOpenAlbum: (album: { id: string; name: string }) => void;
  onOpenPlaylist: (playlist: { id: string; name: string }) => void;
}) {
  return (
    <section className="space-y-4">
      <ArtistSectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-full items-stretch gap-4 px-1">
          {section.items.map((item) => {
            if (item.kind === "track") {
              return null;
            }

            const collectionItem = item as DiscoverCollectionItem;
            const pendingId = `${collectionItem.kind}:${collectionItem.id}`;
            const isAlbum = collectionItem.kind === "album";
            const isPlaylist = collectionItem.kind === "playlist";

            return (
              <Card
                key={`${collectionItem.kind}:${collectionItem.id}`}
                className="flex w-[248px] shrink-0 flex-col rounded-[28px] p-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isAlbum) {
                      onOpenAlbum({
                        id: collectionItem.id,
                        name: collectionItem.title,
                      });
                      return;
                    }

                    if (isPlaylist) {
                      onOpenPlaylist({
                        id: collectionItem.id,
                        name: collectionItem.title,
                      });
                    }
                  }}
                  className="group text-left"
                >
                  <Avatar
                    src={collectionItem.thumbnail}
                    alt={collectionItem.title}
                    size="lg"
                    className="h-28 w-28 rounded-[26px] border border-[color:var(--surface-border)]"
                  />
                  <div className="mt-4 space-y-2">
                    <p className="line-clamp-2 text-lg font-semibold leading-7 text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                      {collectionItem.title}
                    </p>
                    <p className="line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {collectionItem.artist}
                    </p>
                  </div>
                </button>

                <div className="mt-4 min-h-[3.5rem] text-sm text-[var(--text-muted)]">
                  <p className="line-clamp-2">
                    {collectionItem.subtitle ||
                      (collectionItem.trackCount
                        ? `${collectionItem.trackCount} 首內容`
                        : isAlbum
                          ? "查看完整專輯"
                          : "查看完整播放清單")}
                  </p>
                </div>

                <div className="mt-auto grid gap-2">
                  {isAlbum ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        onOpenAlbum({
                          id: collectionItem.id,
                          name: collectionItem.title,
                        })
                      }
                      className="rounded-[16px]"
                    >
                      <Disc3 className="h-4 w-4" />
                      查看專輯
                    </Button>
                  ) : isPlaylist ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        onOpenPlaylist({
                          id: collectionItem.id,
                          name: collectionItem.title,
                        })
                      }
                      className="rounded-[16px]"
                    >
                      <ListMusic className="h-4 w-4" />
                      查看播放清單
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => {
                      void onQueueCollection(collectionItem);
                    }}
                    disabled={pendingCollectionId === pendingId}
                    className="rounded-[16px]"
                  >
                    {pendingCollectionId === pendingId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        加入中
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        整組加入佇列
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const ArtistDialog = () => {
  const isOpen = useArtistDialogStore((state) => state.isOpen);
  const selectedArtist = useArtistDialogStore((state) => state.selectedArtist);
  const closeArtist = useArtistDialogStore((state) => state.closeArtist);
  const openAlbum = useAlbumDialogStore((state) => state.openAlbum);
  const openPlaylist = usePlaylistDialogStore((state) => state.openPlaylist);
  const libraryReady = useLibraryStore((state) => state.ready);
  const favorites = useLibraryStore(
    (state) => state.snapshot?.favorites ?? EMPTY_FAVORITES,
  );
  const currentRequester = useLibraryStore((state) =>
    getCurrentRequester(state.snapshot),
  );
  const saveMix = useLibraryStore((state) => state.saveMix);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const { showToast } = useToast();
  const [artistDetails, setArtistDetails] = useState<ArtistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [creatingMixId, setCreatingMixId] = useState<string | null>(null);
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const favoriteTrackIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.videoId)),
    [favorites],
  );

  useEffect(() => {
    if (!isOpen || !selectedArtist?.id) {
      setArtistDetails(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadArtist(artistId: string) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.getArtist(artistId);

        if (cancelled) {
          return;
        }

        if (response.success && response.data) {
          setArtistDetails(response.data);
          return;
        }

        setArtistDetails(null);
        setError(response.error || "歌手頁載入失敗");
      } catch {
        if (!cancelled) {
          setArtistDetails(null);
          setError("歌手頁載入失敗");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadArtist(selectedArtist.id);

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadToken, selectedArtist?.id]);

  const handleQueueTrack = async (track: Track) => {
    setPendingTrackId(track.videoId);

    try {
      const response = await api.queueDiscoverTrack(track, currentRequester);

      if (!response.success) {
        showToast({ message: response.error || "加入佇列失敗", type: "error" });
        return;
      }

      showToast({ message: `已加入播放佇列：${track.title}`, type: "success" });
    } finally {
      setPendingTrackId(null);
    }
  };

  const handleCreateMix = async (track: Track) => {
    setCreatingMixId(track.videoId);

    try {
      const response = await api.createMix(track, currentRequester);

      if (!response.success || !response.data) {
        showToast({ message: response.error || "建立 Mix 失敗", type: "error" });
        return;
      }

      void saveMix(track, response.data.tracks);
      showToast({
        message: `已建立 Mix，加入 ${response.data.count} 首歌曲`,
        type: "success",
      });
    } finally {
      setCreatingMixId(null);
    }
  };

  const handleToggleFavorite = async (track: Track) => {
    if (!libraryReady) {
      showToast({ message: "媒體庫正在初始化", type: "info" });
      return;
    }

    const wasFavorite = favoriteTrackIds.has(track.videoId);

    try {
      await toggleFavorite(track);
      showToast({
        message: wasFavorite ? "已移除收藏" : "已加入收藏",
        type: "success",
      });
    } catch {
      showToast({ message: "收藏更新失敗", type: "error" });
    }
  };

  const handleQueueCollection = async (item: DiscoverCollectionItem) => {
    const pendingId = `${item.kind}:${item.id}`;
    setPendingCollectionId(pendingId);

    try {
      const response = await api.queueDiscoverCollection(
        item.kind,
        item.id,
        currentRequester,
      );

      if (!response.success || !response.data) {
        showToast({
          message: response.error || "加入整組內容失敗",
          type: "error",
        });
        return;
      }

      showToast({
        message: `已加入 ${response.data.count} 首歌曲`,
        type: "success",
      });
    } finally {
      setPendingCollectionId(null);
    }
  };

  const handleOpenAlbum = (album: { id: string; name: string } | Track["album"]) => {
    if (!album?.id || !album?.name) {
      return;
    }

    closeArtist();
    deferDialogNavigation(() => {
      openAlbum({
        id: album.id,
        name: album.name,
      });
    });
  };

  const handleOpenPlaylist = (playlist: { id: string; name: string }) => {
    if (!playlist.id || !playlist.name) {
      return;
    }

    closeArtist();
    deferDialogNavigation(() => {
      openPlaylist({
        id: playlist.id,
        name: playlist.name,
      });
    });
  };

  const hasOnlyTrackItems = (section: ArtistSection) =>
    section.items.every((item) => item.kind === "track");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeArtist()}>
      <DialogContent className="flex h-[min(92vh,980px)] w-[min(96vw,1040px)] max-w-[1040px] flex-col overflow-hidden p-0">
        <div className="relative min-h-[260px] overflow-hidden border-b border-[color:var(--surface-border)]">
          {artistDetails?.heroImage ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${artistDetails.heroImage})` }}
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.92),_rgba(15,23,42,0.66)_42%,_rgba(161,98,7,0.54)_100%)]" />
          <div className="relative flex h-full flex-col px-6 pb-6 pt-6 lg:px-8 lg:pb-7 lg:pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                <UserRound className="h-4 w-4" />
                Artist Profile
              </div>
              <DialogClose
                className="static rounded-full border border-white/15 bg-white/10 p-3 text-white backdrop-blur-sm"
                aria-label="關閉歌手頁"
              >
                <X className="h-5 w-5" />
              </DialogClose>
            </div>

            <div className="mt-auto flex flex-col gap-5 lg:flex-row lg:items-end">
              <Avatar
                src={artistDetails?.thumbnail}
                alt={artistDetails?.name || selectedArtist?.name || "歌手"}
                size="lg"
                className="h-28 w-28 rounded-[28px] border border-white/20 shadow-2xl"
              />
              <div className="min-w-0">
                <DialogTitle className="text-3xl font-semibold tracking-tight text-white lg:text-[2.75rem]">
                  {artistDetails?.name || selectedArtist?.name || "歌手"}
                </DialogTitle>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-sm">
                    歌手
                  </span>
                  {artistDetails?.subscriberCount ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-sm">
                      {artistDetails.subscriberCount}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-sm">
                    {artistDetails?.sections.length || 0} 個作品區塊
                  </span>
                </div>
                {artistDetails?.description ? (
                  <p className="mt-4 max-w-3xl line-clamp-4 text-sm leading-6 text-white/80 lg:text-base">
                    {artistDetails.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0" maxHeight="none">
          <div className="space-y-6 p-6 lg:px-8 lg:pb-8">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <div className="surface-subtle rounded-[28px] border border-[color:var(--surface-border)] p-6 text-center">
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  歌手頁目前無法載入
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
            ) : artistDetails && artistDetails.sections.length > 0 ? (
              artistDetails.sections.map((section) =>
                hasOnlyTrackItems(section) ? (
                  <ArtistTrackSection
                    key={section.id}
                    section={section}
                    onQueueTrack={handleQueueTrack}
                    onCreateMix={handleCreateMix}
                    onToggleFavorite={handleToggleFavorite}
                    favoriteTrackIds={favoriteTrackIds}
                    favoriteDisabled={!libraryReady}
                    pendingTrackId={pendingTrackId}
                    creatingMixId={creatingMixId}
                    onBeforeOpenAlbum={closeArtist}
                  />
                ) : (
                  <ArtistCollectionSection
                    key={section.id}
                    section={section}
                    onQueueCollection={handleQueueCollection}
                    pendingCollectionId={pendingCollectionId}
                    onOpenAlbum={handleOpenAlbum}
                    onOpenPlaylist={handleOpenPlaylist}
                  />
                ),
              )
            ) : (
              <Empty
                title="這位歌手目前沒有可顯示的作品區塊"
                description="你可以稍後再試一次，或改從 Discover 其他內容繼續探索。"
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
