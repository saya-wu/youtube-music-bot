import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { QueueContent } from "./QueueContent";
import { usePlayerStore } from "@/stores/playerStore";
import { cn } from "@/lib/utils";

interface QueueSectionProps {
  mobile?: boolean;
  className?: string;
}

export const QueueSection = ({ mobile = false, className }: QueueSectionProps) => {
  const queue = usePlayerStore((state) => state.playbackState.queue);

  return (
    <Card
      className={cn(
        "h-full min-h-0 flex flex-col overflow-hidden",
        mobile ? "rounded-[32px]" : "desktop-side-panel",
        className,
      )}
    >
      <CardHeader className={cn("flex-shrink-0", mobile && "space-y-2 px-5 pb-4 pt-5")}>
        <CardTitle className={cn(mobile ? "text-[2rem] leading-none" : "text-xl")}>
          播放佇列 ({queue.length})
        </CardTitle>
        <p className={cn("text-[var(--text-secondary)]", mobile ? "text-base leading-7" : "text-sm")}>
          接下來會播放的歌曲清單，第一首會是下一首登場。
        </p>
      </CardHeader>
      <CardContent className={cn("flex-1 min-h-0 overflow-hidden", mobile && "px-3 pb-3 pt-0")}>
        <QueueContent mobile={mobile} className="h-full" />
      </CardContent>
    </Card>
  );
};
