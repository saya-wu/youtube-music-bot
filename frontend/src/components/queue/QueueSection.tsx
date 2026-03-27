import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { QueueContent } from "./QueueContent";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface QueueSectionProps {
  mobile?: boolean;
  className?: string;
}

export const QueueSection = ({ mobile = false, className }: QueueSectionProps) => {
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const queueLength = usePlayerStore((state) => state.playbackState.queue.length);
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const { showToast } = useToast();

  const handleClearQueue = async () => {
    if (queueLength === 0 || isClearingQueue) {
      return;
    }

    const shouldClear = window.confirm(
      `確定要清空目前播放佇列嗎？\n這會移除接下來待播的 ${queueLength} 首歌曲，正在播放中的歌曲會保留。`,
    );

    if (!shouldClear) {
      return;
    }

    setIsClearingQueue(true);

    try {
      const response = await api.clearQueue();

      if (!response.success) {
        showToast({
          message: response.error || "清空佇列失敗",
          type: "error",
        });
        return;
      }

      updatePlaybackState({ queue: [] });
      showToast({
        message: `已清空 ${response.data?.count ?? queueLength} 首待播歌曲`,
        type: "success",
      });
    } catch {
      showToast({ message: "清空佇列失敗", type: "error" });
    } finally {
      setIsClearingQueue(false);
    }
  };

  return (
    <Card
      className={cn(
        "h-full min-h-0 flex flex-col overflow-hidden",
        mobile
          ? "rounded-[28px] border-0 bg-transparent shadow-none"
          : "desktop-side-panel",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "flex-shrink-0",
          mobile && "space-y-1 px-1 pb-3 pt-1",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className={cn(mobile ? "text-[1.55rem] leading-none" : "text-xl")}>
            播放佇列 ({queueLength})
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleClearQueue()}
            disabled={queueLength === 0 || isClearingQueue}
            className="rounded-full border-[#efb4b4] bg-[#fff5f5] px-3 text-[#b42318] hover:bg-[#ffe3e3] hover:text-[#912018] disabled:border-[color:var(--surface-border)] disabled:bg-[var(--surface-subtle)] disabled:text-[var(--text-muted)]"
          >
            {isClearingQueue ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isClearingQueue ? "清空中..." : "清空佇列"}
          </Button>
        </div>
        <p
          className={cn(
            "text-[var(--text-secondary)]",
            mobile ? "text-sm leading-6" : "text-sm",
          )}
        >
          接下來會播放的歌曲清單，第一首會是下一首登場。
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "flex-1 min-h-0 overflow-hidden",
          mobile && "px-0 pb-0 pt-0",
        )}
      >
        <QueueContent mobile={mobile} className="h-full" />
      </CardContent>
    </Card>
  );
};
