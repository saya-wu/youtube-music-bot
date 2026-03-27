import { ListMusic } from "lucide-react";
import { MarqueeText } from "@/components/player/MarqueeText";
import { cn } from "@/lib/utils";
import { usePlaylistDialogStore } from "@/stores/playlistDialogStore";
import { deferDialogNavigation } from "@/utils/deferDialogNavigation";

interface OpenPlaylistButtonProps {
  playlistId?: string | null;
  playlistName?: string | null;
  className?: string;
  labelClassName?: string;
  useMarquee?: boolean;
  onNavigate?: () => void;
}

export const OpenPlaylistButton = ({
  playlistId,
  playlistName,
  className,
  labelClassName,
  useMarquee = false,
  onNavigate,
}: OpenPlaylistButtonProps) => {
  const openPlaylist = usePlaylistDialogStore((state) => state.openPlaylist);
  const normalizedPlaylistId = playlistId?.trim();
  const normalizedPlaylistName = playlistName?.trim();

  if (!normalizedPlaylistId || !normalizedPlaylistName) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (onNavigate) {
          onNavigate();
          deferDialogNavigation(() => {
            openPlaylist({
              id: normalizedPlaylistId,
              name: normalizedPlaylistName,
            });
          });
          return;
        }

        openPlaylist({
          id: normalizedPlaylistId,
          name: normalizedPlaylistName,
        });
      }}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-left text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80",
        className,
      )}
      aria-label={`開啟播放清單：${normalizedPlaylistName}`}
      title={`開啟播放清單：${normalizedPlaylistName}`}
    >
      <ListMusic className="h-3.5 w-3.5 shrink-0" />
      {useMarquee ? (
        <MarqueeText
          text={normalizedPlaylistName}
          className={cn("min-w-0 flex-1", labelClassName)}
        />
      ) : (
        <span className={cn("truncate", labelClassName)}>
          {normalizedPlaylistName}
        </span>
      )}
    </button>
  );
};
