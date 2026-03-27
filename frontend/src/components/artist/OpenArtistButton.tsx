import { UserRound } from "lucide-react";
import { MarqueeText } from "@/components/player/MarqueeText";
import { cn } from "@/lib/utils";
import { useArtistDialogStore } from "@/stores/artistDialogStore";
import { deferDialogNavigation } from "@/utils/deferDialogNavigation";

interface OpenArtistButtonProps {
  artistId?: string | null;
  artistName?: string | null;
  className?: string;
  labelClassName?: string;
  useMarquee?: boolean;
  onNavigate?: () => void;
}

export const OpenArtistButton = ({
  artistId,
  artistName,
  className,
  labelClassName,
  useMarquee = false,
  onNavigate,
}: OpenArtistButtonProps) => {
  const openArtist = useArtistDialogStore((state) => state.openArtist);
  const normalizedArtistId = artistId?.trim();
  const normalizedArtistName = artistName?.trim();

  if (!normalizedArtistId || !normalizedArtistName) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (onNavigate) {
          onNavigate();
          deferDialogNavigation(() => {
            openArtist({
              id: normalizedArtistId,
              name: normalizedArtistName,
            });
          });
          return;
        }

        openArtist({
          id: normalizedArtistId,
          name: normalizedArtistName,
        });
      }}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-left text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80",
        className,
      )}
      aria-label={`開啟歌手：${normalizedArtistName}`}
      title={`開啟歌手：${normalizedArtistName}`}
    >
      <UserRound className="h-3.5 w-3.5 shrink-0" />
      {useMarquee ? (
        <MarqueeText
          text={normalizedArtistName}
          className={cn("min-w-0 flex-1", labelClassName)}
        />
      ) : (
        <span className={cn("truncate", labelClassName)}>
          {normalizedArtistName}
        </span>
      )}
    </button>
  );
};
