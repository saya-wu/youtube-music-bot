import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Compass,
  Globe2,
  Heart,
  Layers3,
  ListMusic,
  Loader2,
  Music2,
  PlayCircle,
  Radio,
  RefreshCw,
} from "lucide-react";
import { OpenAlbumButton } from "@/components/album/OpenAlbumButton";
import { OpenArtistButton } from "@/components/artist/OpenArtistButton";
import { OpenPlaylistButton } from "@/components/playlist/OpenPlaylistButton";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useDiscoverStore } from "@/stores/discoverStore";
import { formatTime } from "@/utils/format";
import type {
  DiscoverCollectionItem,
  DiscoverItem,
  DiscoverTrackItem,
  TopRequestedEntry,
  Track,
} from "@/types";

interface DiscoverViewProps {
  isMobile?: boolean;
}

function formatFetchedAt(value: string | null): string {
  if (!value) {
    return "尚未更新";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "尚未更新";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLastRequestedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "剛剛更新";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeCompareText(value: string): string {
  return value
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getCollectionSupportText(item: DiscoverCollectionItem): string {
  const subtitle = item.subtitle?.trim();
  const artist = item.artist?.trim();

  if (subtitle) {
    const normalizedSubtitle = normalizeCompareText(
      subtitle
        .replace(/^專輯\s*[•·]\s*/u, "")
        .replace(/^播放清單\s*[•·]\s*/u, ""),
    );
    const normalizedArtist = artist ? normalizeCompareText(artist) : "";

    if (normalizedSubtitle && normalizedSubtitle !== normalizedArtist) {
      return subtitle;
    }
  }

  return item.kind === "album"
    ? "打開專輯後可查看完整曲目與逐首操作。"
    : "打開播放清單後可單獨挑選歌曲加入佇列。";
}

function SectionHeading({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--accent)]">
            {icon}
          </span>
          <span>{title}</span>
        </div>
        {subtitle ? (
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function DiscoverCardDetailSlot({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-h-[6.25rem]", className)}>{children}</div>;
}

function MarketChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-transparent bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_16px_32px_-24px_var(--accent-glow)]"
          : "border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-3 rounded-[22px] border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}

function DiscoverSectionRail({
  section,
  onQueueTrack,
  onCreateMix,
  onToggleFavorite,
  onQueueCollection,
  pendingTrackId,
  creatingMixId,
  pendingCollectionId,
  favoriteTrackIds,
  libraryReady,
}: {
  section: {
    id: string;
    title: string;
    subtitle?: string;
    items: DiscoverItem[];
  };
  onQueueTrack: (track: Track) => Promise<void>;
  onCreateMix: (track: Track) => Promise<void>;
  onToggleFavorite: (track: Track) => Promise<void>;
  onQueueCollection: (item: DiscoverCollectionItem) => Promise<void>;
  pendingTrackId: string | null;
  creatingMixId: string | null;
  pendingCollectionId: string | null;
  favoriteTrackIds: ReadonlySet<string>;
  libraryReady: boolean;
}) {
  if (section.items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        icon={<Layers3 className="h-4 w-4" />}
        title={section.title}
        subtitle={section.subtitle}
      />
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-full items-stretch gap-4 px-1">
          {section.items.map((item) =>
            item.kind === "track" ? (
              <TrackDiscoverCard
                key={`${item.kind}:${item.id}`}
                item={item}
                onQueueTrack={onQueueTrack}
                onCreateMix={onCreateMix}
                onToggleFavorite={onToggleFavorite}
                isPending={pendingTrackId === item.track.videoId}
                isCreatingMix={creatingMixId === item.track.videoId}
                isFavorite={favoriteTrackIds.has(item.track.videoId)}
                favoriteDisabled={!libraryReady}
              />
            ) : (
              <CollectionDiscoverCard
                key={`${item.kind}:${item.id}`}
                item={item}
                onQueueCollection={onQueueCollection}
                isPending={pendingCollectionId === `${item.kind}:${item.id}`}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function TrackDiscoverCard({
  item,
  onQueueTrack,
  onCreateMix,
  onToggleFavorite,
  isPending,
  isCreatingMix,
  isFavorite,
  favoriteDisabled,
  meta,
}: {
  item: DiscoverTrackItem;
  onQueueTrack: (track: Track) => Promise<void>;
  onCreateMix: (track: Track) => Promise<void>;
  onToggleFavorite: (track: Track) => Promise<void>;
  isPending: boolean;
  isCreatingMix: boolean;
  isFavorite: boolean;
  favoriteDisabled: boolean;
  meta?: ReactNode;
}) {
  const openAlbum = useAlbumDialogStore((state) => state.openAlbum);
  const openArtist = useArtistDialogStore((state) => state.openArtist);
  const album = item.track.album;
  const artistId = item.artistId || item.track.artistId;
  const canOpenAlbum = Boolean(album?.id && album?.name);
  const canOpenArtist = Boolean(artistId?.trim() && item.artist.trim());
  const destinationLabel = canOpenAlbum
    ? "展開專輯"
    : canOpenArtist
      ? "探索歌手"
      : null;

  return (
    <Card className="flex min-h-[386px] w-[264px] shrink-0 flex-col rounded-[28px] p-4">
      <button
        type="button"
        onClick={() => {
          if (canOpenAlbum && album) {
            openAlbum(album);
            return;
          }

          if (canOpenArtist && artistId) {
            openArtist({
              id: artistId,
              name: item.artist,
            });
          }
        }}
        disabled={!destinationLabel}
        className={cn(
          "flex min-h-[104px] items-start gap-4 text-left",
          destinationLabel
            ? "group transition-transform hover:-translate-y-0.5"
            : "cursor-default",
        )}
      >
        <Avatar
          src={item.thumbnail || item.track.thumbnail}
          alt={item.title}
          size="lg"
          className={cn(
            "h-20 w-20 rounded-[22px] border border-[color:var(--surface-border)] transition-shadow",
            destinationLabel &&
              "group-hover:shadow-[0_20px_32px_-24px_var(--accent-glow)]",
          )}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <p
              className={cn(
                "min-h-[3rem] line-clamp-2 text-base font-semibold leading-6 text-[var(--text-primary)] transition-colors",
                destinationLabel && "group-hover:text-[var(--accent)]",
              )}
            >
              {item.title}
            </p>
            <p className="min-h-[2.5rem] line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]">
              {item.artist}
            </p>
          </div>
          <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-2.5 py-1">
              單曲
            </span>
            <span>{formatTime(item.duration || item.track.duration || 0)}</span>
            {destinationLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-2.5 py-1 font-medium text-[var(--accent)]">
                {destinationLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="min-h-[2rem]">
          {meta ? (
            <div className="space-y-1 text-xs text-[var(--text-muted)]">{meta}</div>
          ) : null}
        </div>

        <DiscoverCardDetailSlot className="mt-4 flex flex-col justify-end gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex min-h-[2.5rem] flex-wrap content-start gap-2">
            {item.track.album ? (
              <OpenAlbumButton
                album={item.track.album}
                trackTitle={item.track.title}
                className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                labelClassName="text-[11px]"
              />
            ) : null}
            <OpenArtistButton
              artistId={item.artistId || item.track.artistId}
              artistName={item.artist}
              className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              labelClassName="text-[11px]"
            />
          </div>
        </DiscoverCardDetailSlot>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => {
              void onQueueTrack(item.track);
            }}
            disabled={isPending || isCreatingMix}
            className="rounded-[16px]"
          >
            {isPending ? (
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
              void onCreateMix(item.track);
            }}
            disabled={isPending || isCreatingMix}
            className="rounded-[16px]"
          >
            {isCreatingMix ? (
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
            variant={isFavorite ? "default" : "ghost"}
            onClick={() => {
              void onToggleFavorite(item.track);
            }}
            disabled={favoriteDisabled}
            className="col-span-2 rounded-[16px]"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            {isFavorite ? "已收藏" : "加入收藏"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CollectionDiscoverCard({
  item,
  onQueueCollection,
  isPending,
}: {
  item: DiscoverCollectionItem;
  onQueueCollection: (item: DiscoverCollectionItem) => Promise<void>;
  isPending: boolean;
}) {
  const openAlbum = useAlbumDialogStore((state) => state.openAlbum);
  const openPlaylist = usePlaylistDialogStore((state) => state.openPlaylist);
  const destinationLabel =
    item.kind === "album" ? "展開專輯" : "展開播放清單";

  return (
    <Card className="flex min-h-[386px] w-[280px] shrink-0 flex-col rounded-[28px] p-4">
      <button
        type="button"
        onClick={() => {
          if (item.kind === "album") {
            openAlbum({
              id: item.id,
              name: item.title,
            });
            return;
          }

          openPlaylist({
            id: item.id,
            name: item.title,
          });
        }}
        className={cn(
          "group flex min-h-[104px] items-start gap-4 text-left transition-transform hover:-translate-y-0.5",
        )}
      >
        <Avatar
          src={item.thumbnail}
          alt={item.title}
          size="lg"
          className={cn(
            "h-20 w-20 rounded-[22px] border border-[color:var(--surface-border)] transition-shadow",
            destinationLabel &&
              "group-hover:shadow-[0_20px_32px_-24px_var(--accent-glow)]",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="space-y-1.5">
            <p
              className={cn(
                "min-h-[3rem] line-clamp-2 text-base font-semibold leading-6 text-[var(--text-primary)] transition-colors",
                destinationLabel && "group-hover:text-[var(--accent)]",
              )}
            >
              {item.title}
            </p>
            <p className="min-h-[2.5rem] line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]">
              {item.artist}
            </p>
          </div>
        </div>
      </button>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-[2rem] flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-2.5 py-1">
            {item.kind === "album" ? "專輯" : "播放清單"}
          </span>
          {item.trackCount ? <span>{item.trackCount} 首</span> : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-2.5 py-1 font-medium text-[var(--accent)]">
            {destinationLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <DiscoverCardDetailSlot className="mt-4 flex flex-col justify-between gap-3 text-xs leading-5 text-[var(--text-muted)]">
          <div className="min-h-[3rem]">
            <p className="line-clamp-3">{getCollectionSupportText(item)}</p>
          </div>
          <div className="flex min-h-[2.5rem] flex-wrap content-start gap-2">
            {item.kind === "album" ? (
              <OpenAlbumButton
                album={{
                  id: item.id,
                  name: item.title,
                }}
                className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                labelClassName="text-[11px]"
              />
            ) : (
              <OpenPlaylistButton
                playlistId={item.id}
                playlistName={item.title}
                className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                labelClassName="text-[11px]"
              />
            )}
            <OpenArtistButton
              artistId={item.artistId}
              artistName={item.artist}
              className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              labelClassName="text-[11px]"
            />
          </div>
        </DiscoverCardDetailSlot>

        <Button
          type="button"
          onClick={() => {
            void onQueueCollection(item);
          }}
          disabled={isPending}
          className="mt-auto rounded-[16px]"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              加入中
            </>
          ) : (
            <>
              <ListMusic className="h-4 w-4" />
              整組加入佇列
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function TopRequestedRail({
  entries,
  onQueueTrack,
  onCreateMix,
  onToggleFavorite,
  pendingTrackId,
  creatingMixId,
  favoriteTrackIds,
  libraryReady,
}: {
  entries: TopRequestedEntry[];
  onQueueTrack: (track: Track) => Promise<void>;
  onCreateMix: (track: Track) => Promise<void>;
  onToggleFavorite: (track: Track) => Promise<void>;
  pendingTrackId: string | null;
  creatingMixId: string | null;
  favoriteTrackIds: ReadonlySet<string>;
  libraryReady: boolean;
}) {
  if (entries.length === 0) {
    return (
      <Card className="rounded-[28px] p-6">
        <Empty
          title="本站熱門點播還在累積中"
          description="從 Discover、搜尋或 Mix 主動加入的歌曲，會逐步出現在這裡。"
        />
      </Card>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-full items-stretch gap-4 px-1">
        {entries.map((entry) => (
          <TrackDiscoverCard
            key={entry.track.videoId}
            item={{
              kind: "track",
              id: entry.track.videoId,
              title: entry.track.title,
              artist: entry.track.artist,
              thumbnail: entry.track.thumbnail,
              duration: entry.track.duration,
              track: entry.track,
            }}
            onQueueTrack={onQueueTrack}
            onCreateMix={onCreateMix}
            onToggleFavorite={onToggleFavorite}
            isPending={pendingTrackId === entry.track.videoId}
            isCreatingMix={creatingMixId === entry.track.videoId}
            isFavorite={favoriteTrackIds.has(entry.track.videoId)}
            favoriteDisabled={!libraryReady}
            meta={
              <div className="space-y-1 text-xs text-[var(--text-muted)]">
                <p>
                  #{entry.rank} · 已點播 {entry.requestCount} 次
                </p>
                <p>最後更新：{formatLastRequestedAt(entry.lastRequestedAt)}</p>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}

export const DiscoverView = ({ isMobile = false }: DiscoverViewProps) => {
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [creatingMixId, setCreatingMixId] = useState<string | null>(null);
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null,
  );
  const initialize = useDiscoverStore((state) => state.initialize);
  const refreshMarkets = useDiscoverStore((state) => state.refreshMarkets);
  const refreshFeed = useDiscoverStore((state) => state.refreshFeed);
  const selectMarket = useDiscoverStore((state) => state.selectMarket);
  const selectMood = useDiscoverStore((state) => state.selectMood);
  const markets = useDiscoverStore((state) => state.markets);
  const selectedMarket = useDiscoverStore((state) => state.selectedMarket);
  const selectedMoodKey = useDiscoverStore((state) => state.selectedMoodKey);
  const moods = useDiscoverStore((state) => state.moods);
  const sections = useDiscoverStore((state) => state.sections);
  const warnings = useDiscoverStore((state) => state.warnings);
  const topRequested = useDiscoverStore((state) => state.topRequested);
  const fetchedAt = useDiscoverStore((state) => state.fetchedAt);
  const isMarketsLoading = useDiscoverStore((state) => state.isMarketsLoading);
  const isFeedLoading = useDiscoverStore((state) => state.isFeedLoading);
  const marketsError = useDiscoverStore((state) => state.marketsError);
  const feedError = useDiscoverStore((state) => state.feedError);
  const libraryReady = useLibraryStore((state) => state.ready);
  const favorites = useLibraryStore(
    (state) => state.snapshot?.favorites ?? [],
  );
  const saveMix = useLibraryStore((state) => state.saveMix);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const currentRequester = useLibraryStore((state) =>
    getCurrentRequester(state.snapshot),
  );
  const { showToast } = useToast();
  const favoriteTrackIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.videoId)),
    [favorites],
  );
  const selectedMarketLabel =
    markets.find((market) => market.code === selectedMarket)?.label ?? "台灣";

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleQueueTrack = async (track: Track) => {
    setPendingTrackId(track.videoId);

    try {
      const response = await api.queueDiscoverTrack(track, currentRequester);

      if (!response.success) {
        showToast({ message: response.error || "加入佇列失敗", type: "error" });
        return;
      }

      showToast({ message: `已加入播放佇列：${track.title}`, type: "success" });
      void refreshMarkets();
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
      void refreshMarkets();
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
      void refreshMarkets();
    } finally {
      setPendingCollectionId(null);
    }
  };

  return (
    <Card
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-[32px] lg:border lg:bg-[var(--surface-elevated)] lg:p-0 lg:shadow-[var(--surface-shadow)] ${
        isMobile ? "border-0 bg-transparent shadow-none" : ""
      }`}
    >
      <ScrollArea
        className={`min-h-0 flex-1 ${
          isMobile ? "px-4 pb-[184px] pt-4" : "desktop-scrollbar p-5 xl:p-6"
        }`}
        maxHeight="none"
      >
        <div className="space-y-6">
          <Card className="surface-card-strong overflow-hidden rounded-[30px] border p-5 lg:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <Compass className="h-4 w-4 text-[var(--accent)]" />
                  Discover
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] lg:text-[2rem]">
                    看看 {selectedMarketLabel} 現在都在聽什麼
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] lg:text-base">
                    直接切換不同市場與情境，快速比較台灣、美國、日本、韓國等地區的 YouTube Music 探索內容。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                <div className="rounded-[18px] border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    更新時間
                  </p>
                  <p className="mt-1 font-medium text-[var(--text-primary)]">
                    {formatFetchedAt(fetchedAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void refreshFeed();
                  }}
                  disabled={isFeedLoading}
                  className="rounded-[18px]"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isFeedLoading ? "animate-spin" : ""}`}
                  />
                  重新整理
                </Button>
              </div>
            </div>
          </Card>

          <section className="space-y-4">
            <SectionHeading
              icon={<Music2 className="h-4 w-4" />}
              title="本站熱門點播"
              subtitle="只統計使用者主動加入的歌曲，方便快速看到目前站內最常被點播的內容。"
            />
            <TopRequestedRail
              entries={topRequested}
              onQueueTrack={handleQueueTrack}
              onCreateMix={handleCreateMix}
              onToggleFavorite={handleToggleFavorite}
              pendingTrackId={pendingTrackId}
              creatingMixId={creatingMixId}
              favoriteTrackIds={favoriteTrackIds}
              libraryReady={libraryReady}
            />
          </section>

          <section className="space-y-4">
            <SectionHeading
              icon={<Globe2 className="h-4 w-4" />}
              title="市場"
              subtitle="固定支援 8 個市場，讓你快速切換不同國家與地區的探索內容。"
            />
            {marketsError ? (
              <Card className="rounded-[24px] p-4 text-sm text-[#b42318]">
                {marketsError}
              </Card>
            ) : (
              <div className="flex flex-wrap gap-2">
                {markets.map((market) => (
                  <MarketChip
                    key={market.code}
                    label={market.label}
                    active={market.code === selectedMarket}
                    disabled={isMarketsLoading || isFeedLoading}
                    onClick={() => {
                      void selectMarket(market.code);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              icon={<Radio className="h-4 w-4" />}
              title="情境與類型"
              subtitle="分類會依目前市場動態變化；如果該分類失效，系統會自動回到該市場的基礎探索內容。"
            />
            {isFeedLoading && sections.length === 0 ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : moods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <MarketChip
                  label="全部"
                  active={selectedMoodKey == null}
                  disabled={isFeedLoading}
                  onClick={() => {
                    void selectMood(null);
                  }}
                />
                {moods.map((mood) => (
                  <MarketChip
                    key={mood.key}
                    label={mood.label}
                    active={mood.key === selectedMoodKey}
                    disabled={isFeedLoading}
                    onClick={() => {
                      void selectMood(mood.key);
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="rounded-[24px] p-4 text-sm text-[var(--text-secondary)]">
                這個市場目前沒有可用的情境與類型分類，會直接顯示市場探索內容。
              </Card>
            )}
          </section>

          {feedError ? (
            <Card className="rounded-[24px] p-4 text-sm text-[#b42318]">
              {feedError}
            </Card>
          ) : null}

          <WarningList warnings={warnings} />

          {sections.length === 0 && !isFeedLoading ? (
            <Card className="rounded-[28px] p-6">
              <Empty
                title="這個市場目前沒有可顯示的 Discover 區塊"
                description="你可以切換其他市場，或稍後重新整理看看。"
              />
            </Card>
          ) : (
            sections.map((section) => (
              <DiscoverSectionRail
                key={section.id}
                section={section}
                onQueueTrack={handleQueueTrack}
                onCreateMix={handleCreateMix}
                onToggleFavorite={handleToggleFavorite}
                onQueueCollection={handleQueueCollection}
                pendingTrackId={pendingTrackId}
                creatingMixId={creatingMixId}
                pendingCollectionId={pendingCollectionId}
                favoriteTrackIds={favoriteTrackIds}
                libraryReady={libraryReady}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
