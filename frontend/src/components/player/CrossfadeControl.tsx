import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { debounce } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { PlaybackSettings } from "@/types";

interface CrossfadeControlProps {
  compact?: boolean;
  className?: string;
}

export const CrossfadeControl = ({
  compact = false,
  className,
}: CrossfadeControlProps) => {
  const playbackSettings = usePlayerStore(
    (state) => state.playbackState.playbackSettings,
  );
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const { showToast } = useToast();
  const [displayDuration, setDisplayDuration] = useState(
    playbackSettings.crossfadeDurationSeconds,
  );
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    if (!isAdjusting) {
      setDisplayDuration(playbackSettings.crossfadeDurationSeconds);
    }
  }, [isAdjusting, playbackSettings.crossfadeDurationSeconds]);

  const commitSettings = useMemo(
    () =>
      debounce(async (nextSettings: PlaybackSettings, requestVersion: number) => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        const response = await api.updatePlaybackSettings(nextSettings);
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setIsAdjusting(false);

        if (!response.success || !response.data) {
          const fallbackSettings =
            usePlayerStore.getState().playbackState.playbackSettings;
          setDisplayDuration(fallbackSettings.crossfadeDurationSeconds);
          showToast({
            message: response.error || "Crossfade 設定更新失敗",
            type: "error",
          });
          return;
        }

        updatePlaybackState({
          playbackSettings: response.data,
        });
        setDisplayDuration(response.data.crossfadeDurationSeconds);
      }, 180),
    [showToast, updatePlaybackState],
  );

  const handleToggle = async () => {
    if (isSubmittingToggle) {
      return;
    }

    setIsSubmittingToggle(true);
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    const nextSettings: PlaybackSettings = {
      crossfadeEnabled: !playbackSettings.crossfadeEnabled,
      crossfadeDurationSeconds: displayDuration,
      volumeNormalizationEnabled: playbackSettings.volumeNormalizationEnabled,
    };

    try {
      const response = await api.updatePlaybackSettings(nextSettings);
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (!response.success || !response.data) {
        showToast({
          message: response.error || "Crossfade 設定更新失敗",
          type: "error",
        });
        setDisplayDuration(playbackSettings.crossfadeDurationSeconds);
        return;
      }

      updatePlaybackState({
        playbackSettings: response.data,
      });
      setDisplayDuration(response.data.crossfadeDurationSeconds);
    } finally {
      setIsSubmittingToggle(false);
    }
  };

  const handleDurationChange = (value: number[]) => {
    const nextDuration = value[0] ?? playbackSettings.crossfadeDurationSeconds;
    const nextSettings: PlaybackSettings = {
      crossfadeEnabled: playbackSettings.crossfadeEnabled,
      crossfadeDurationSeconds: nextDuration,
      volumeNormalizationEnabled: playbackSettings.volumeNormalizationEnabled,
    };

    requestVersionRef.current += 1;
    setIsAdjusting(true);
    setDisplayDuration(nextDuration);
    commitSettings(nextSettings, requestVersionRef.current);
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
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Crossfade
          </p>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            下一首會先預加載，切換時會保留目前歌曲尾段，並和下一首平順淡入淡出。
          </p>
        </div>
        <Button
          type="button"
          variant={playbackSettings.crossfadeEnabled ? "default" : "outline"}
          size={compact ? "sm" : "md"}
          onClick={() => void handleToggle()}
          disabled={isSubmittingToggle}
          className={cn(
            "shrink-0 rounded-full px-4",
            compact ? "h-9 text-sm" : "h-10 text-sm",
          )}
        >
          {playbackSettings.crossfadeEnabled ? "已開啟" : "已關閉"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--text-secondary)]">
          <span>淡入淡出長度</span>
          <span className="tabular-nums text-[var(--text-primary)]">
            {displayDuration} 秒
          </span>
        </div>
        <Slider
          className={cn(
            "py-1",
            !playbackSettings.crossfadeEnabled && "opacity-60",
          )}
          value={[displayDuration]}
          max={8}
          step={1}
          disabled={!playbackSettings.crossfadeEnabled}
          onValueChange={handleDurationChange}
        />
      </div>
    </div>
  );
};
