import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { OpenAlbumButton } from "@/components/album/OpenAlbumButton";
import { formatTime } from "@/utils/format";
import type { Track } from "@/types";
import { Library, Plus, Shuffle } from "lucide-react";
import { ThumbnailQuality } from "@/utils/thumbnail";

interface SearchResultItemProps {
  result: Track;
  onAdd: (track: Track) => void;
  onCreateMix: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  isAdding?: boolean;
  isCreatingMix?: boolean;
}

export const SearchResultItem = ({
  result,
  onAdd,
  onCreateMix,
  onAddToPlaylist,
  isAdding,
  isCreatingMix,
}: SearchResultItemProps) => {
  return (
    <Card className="rounded-[32px] p-5 lg:p-6">
      <div className="grid gap-5 xl:grid-cols-[120px_minmax(0,1fr)_260px] xl:items-center">
        <Avatar
          src={result.thumbnail}
          alt={result.title}
          size="lg"
          className="h-[112px] w-[112px] rounded-[26px] border border-[color:var(--surface-border)] xl:h-[120px] xl:w-[120px]"
          thumbnailQuality={ThumbnailQuality.HIGH}
        />
        <div className="min-w-0 space-y-2 xl:pr-4">
          <h3 className="line-clamp-2 text-2xl font-semibold leading-tight text-[var(--text-primary)] lg:text-[1.95rem]">
            {result.title}
          </h3>
          <p className="line-clamp-2 text-base text-[var(--text-secondary)] lg:text-lg">
            {result.artist}
          </p>
          <OpenAlbumButton
            album={result.album}
            trackTitle={result.title}
            className="text-sm"
          />
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-[var(--text-muted)]">
            <span className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1">
              {formatTime(result.duration)}
            </span>
            <span className="hidden text-[var(--text-muted)] xl:inline">
              可直接加入佇列、查看專輯、收藏到歌單或建立推薦流
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 xl:flex-col xl:items-stretch xl:justify-self-end">
          <Button
            onClick={() => onAddToPlaylist(result)}
            disabled={isAdding || isCreatingMix}
            variant="outline"
            title="加入自定歌單"
            className="h-12 rounded-[18px] px-4 xl:w-full xl:justify-start"
          >
            <Library className="h-4 w-4" />
            <span>加入歌單</span>
          </Button>
          <Button
            onClick={() => onAdd(result)}
            disabled={isAdding || isCreatingMix}
            className="h-12 min-w-[180px] rounded-[20px] px-6 text-base xl:w-full"
          >
            {isAdding ? (
              "加入中..."
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                加入佇列
              </>
            )}
          </Button>
          <Button
            onClick={() => onCreateMix(result)}
            disabled={isAdding || isCreatingMix}
            variant="outline"
            title="創建 Mix 混合播放清單"
            className="h-12 rounded-[18px] px-4 xl:w-full xl:justify-start"
          >
            {isCreatingMix ? (
              "建立中..."
            ) : (
              <>
                <Shuffle className="h-4 w-4" />
                <span>建立 Mix</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
