import { useState } from "react";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface VolumeNormalizationControlProps {
  compact?: boolean;
  className?: string;
}

export const VolumeNormalizationControl = ({
  compact = false,
  className,
}: VolumeNormalizationControlProps) => {
  const playbackSettings = usePlayerStore(
    (state) => state.playbackState.playbackSettings,
  );
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.updatePlaybackSettings({
        ...playbackSettings,
        volumeNormalizationEnabled:
          !playbackSettings.volumeNormalizationEnabled,
      });

      if (!response.success || !response.data) {
        showToast({
          message: response.error || "音量平衡設定更新失敗",
          type: "error",
        });
        return;
      }

      updatePlaybackState({
        playbackSettings: response.data,
      });
      showToast({
        message: response.data.volumeNormalizationEnabled
          ? "音量平衡已開啟"
          : "音量平衡已關閉",
        type: "success",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-[24px] border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-4",
        compact && "rounded-[22px] px-4 py-3.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              音量平衡
            </p>
          </div>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            依照 YouTube 的 loudness dB metadata 做固定增減益，讓不同歌曲的實際聽感音量更一致。
          </p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            這不會改變你的主音量滑桿，只會幫每首歌補正大小聲差異。
          </p>
        </div>
        <Button
          type="button"
          variant={
            playbackSettings.volumeNormalizationEnabled ? "default" : "outline"
          }
          size={compact ? "sm" : "md"}
          onClick={() => void handleToggle()}
          disabled={isSubmitting}
          className={cn(
            "shrink-0 rounded-full px-4",
            compact ? "h-9 text-sm" : "h-10 text-sm",
          )}
        >
          {playbackSettings.volumeNormalizationEnabled ? "已開啟" : "已關閉"}
        </Button>
      </div>
    </div>
  );
};
