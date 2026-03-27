import type { Track } from "@/types";
import { useAlbumDialogStore } from "@/stores/albumDialogStore";
import { cn } from "@/lib/utils";
import { Disc3 } from "lucide-react";
import { MarqueeText } from "@/components/player/MarqueeText";
import { deferDialogNavigation } from "@/utils/deferDialogNavigation";

interface OpenAlbumButtonProps {
  album: Track["album"];
  trackTitle?: string;
  className?: string;
  useMarquee?: boolean;
  labelClassName?: string;
  onNavigate?: () => void;
}

export const OpenAlbumButton = ({
  album,
  trackTitle,
  className,
  useMarquee = false,
  labelClassName,
  onNavigate,
}: OpenAlbumButtonProps) => {
  const openAlbum = useAlbumDialogStore((state) => state.openAlbum);

  if (!album) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (onNavigate) {
          onNavigate();
          deferDialogNavigation(() => {
            openAlbum(album);
          });
          return;
        }

        openAlbum(album);
      }}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-left text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80",
        className,
      )}
      aria-label={
        trackTitle
          ? `開啟專輯：${album.name}（歌曲：${trackTitle}）`
          : `開啟專輯：${album.name}`
      }
      title={`開啟專輯：${album.name}`}
    >
      <Disc3 className="h-3.5 w-3.5 shrink-0" />
      {useMarquee ? (
        <MarqueeText
          text={album.name}
          className={cn("min-w-0 flex-1", labelClassName)}
        />
      ) : (
        <span className={cn("truncate", labelClassName)}>{album.name}</span>
      )}
    </button>
  );
};
