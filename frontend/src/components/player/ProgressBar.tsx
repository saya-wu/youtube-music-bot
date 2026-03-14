import { Slider } from "@/components/ui/slider";
import { TimeDisplay } from "./TimeDisplay";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { throttle } from "@/utils/format";
import { useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";

export const ProgressBar = () => {
  // 分別選擇以避免創建新對象
  const position = usePlayerStore((state) => state.playbackState.position);
  const duration = usePlayerStore((state) => state.playbackState.duration);
  const isLoadingTrack = usePlayerStore((state) => state.isLoadingTrack);
  const loadingMessage = usePlayerStore((state) => state.loadingMessage);

  // 節流 seek 請求，避免過於頻繁
  const handleSeek = useMemo(
    () =>
      throttle((value: number[]) => {
        const newPosition = value[0];
        api.seek(newPosition);
      }, 500),
    [],
  );

  // 載入中時顯示載入動畫
  if (isLoadingTrack) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 h-5">
          <Spinner size="sm" />
          <span className="text-sm text-muted-foreground">
            {loadingMessage || "正在載入..."}
          </span>
        </div>
        {/* 顯示載入進度條動畫 */}
        <div className="h-1 bg-muted rounded overflow-hidden">
          <div className="h-full bg-primary/50 animate-pulse w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Slider
        value={[position]}
        max={duration || 100}
        step={1}
        onValueChange={handleSeek}
        disabled={!duration}
      />
      <TimeDisplay current={position} total={duration} />
    </div>
  );
};
