import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { Spinner } from "@/components/ui/spinner";

export const PlaybackControls = () => {
  // 分別選擇以避免創建新對象
  const isPlaying = usePlayerStore((state) => state.playbackState.isPlaying);
  const currentTrack = usePlayerStore(
    (state) => state.playbackState.currentTrack,
  );
  const isLoadingTrack = usePlayerStore((state) => state.isLoadingTrack);

  const handlePlayPause = async () => {
    // 載入中時不允許操作
    if (isLoadingTrack) return;

    if (isPlaying) {
      await api.pause();
    } else {
      await api.play();
    }
  };

  const handleSkip = async () => {
    await api.skip();
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="lg"
        onClick={handlePlayPause}
        disabled={!currentTrack || isLoadingTrack}
        title={isPlaying ? "暫停" : "播放"}
      >
        {isLoadingTrack ? (
          <Spinner size="sm" />
        ) : isPlaying ? (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </Button>

      <Button
        variant="ghost"
        size="lg"
        onClick={handleSkip}
        disabled={!currentTrack}
        title="跳過"
      >
        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4l10 8-10 8V4zm12 0v16h2V4h-2z" />
        </svg>
      </Button>
    </div>
  );
};
