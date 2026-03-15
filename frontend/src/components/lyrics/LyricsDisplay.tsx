import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LyricsContent } from "./LyricsContent";
import { cn } from "@/lib/utils";

interface LyricsDisplayProps {
  isVisible?: boolean;
  mobile?: boolean;
  className?: string;
}

export const LyricsDisplay = ({
  isVisible = true,
  mobile = false,
  className,
}: LyricsDisplayProps) => {
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
          歌詞
        </CardTitle>
        <p className={cn("text-[var(--text-secondary)]", mobile ? "text-base leading-7" : "text-sm")}>
          聚焦正在播放的句子，讓閱讀和旋律一起推進。
        </p>
      </CardHeader>
      <CardContent className={cn("flex-1 overflow-hidden min-h-0", mobile && "px-3 pb-3 pt-0")}>
        <LyricsContent isVisible={isVisible} />
      </CardContent>
    </Card>
  );
};
