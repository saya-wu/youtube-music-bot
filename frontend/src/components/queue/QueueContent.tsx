import { useState } from "react";
import { QueueList } from "./QueueList";
import { Empty } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";
import { usePlayerStore } from "@/stores/playerStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import { reorderItems } from "@/utils/reorder";

interface QueueContentProps {
  className?: string;
  mobile?: boolean;
}

type DropPosition = "before" | "after";

export const QueueContent = ({ className, mobile = false }: QueueContentProps) => {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: DropPosition;
  } | null>(null);
  const queue = usePlayerStore((state) => state.playbackState.queue);
  const updatePlaybackState = usePlayerStore(
    (state) => state.updatePlaybackState,
  );
  const openPlaylistPicker = useLibraryStore((state) => state.openPlaylistPicker);
  const { showToast } = useToast();

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    try {
      const response = await api.removeFromQueue(index);
      if (response.success) {
        showToast({ message: "已從佇列移除", type: "success" });
      } else {
        showToast({ message: response.error || "移除失敗", type: "error" });
      }
    } catch (error) {
      showToast({ message: "移除發生錯誤", type: "error" });
    } finally {
      setRemovingIndex(null);
    }
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      setDraggingIndex(null);
      setDropTarget(null);
      return;
    }

    const previousQueue = [...queue];
    const reorderedQueue = reorderItems(previousQueue, fromIndex, toIndex);

    updatePlaybackState({ queue: reorderedQueue });
    setDraggingIndex(null);
    setDropTarget(null);

    try {
      const response = await api.reorderQueue(fromIndex, toIndex);
      if (!response.success) {
        updatePlaybackState({ queue: previousQueue });
        showToast({ message: response.error || "重新排序失敗", type: "error" });
      }
    } catch (error) {
      updatePlaybackState({ queue: previousQueue });
      showToast({ message: "重新排序發生錯誤", type: "error" });
    }
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDropTarget(null);
  };

  if (queue.length === 0) {
    return <Empty title="播放佇列為空" description="搜尋並加入歌曲到佇列" />;
  }

  return (
    <ScrollArea
      className={cn(
        "h-full min-h-0 w-full",
        !mobile && "desktop-scrollbar",
        className,
      )}
      maxHeight="100%"
    >
      <QueueList
        queue={queue}
        mobile={mobile}
        onRemove={handleRemove}
        onReorder={handleReorder}
        removingIndex={removingIndex}
        onAddToPlaylist={openPlaylistPicker}
        draggingIndex={draggingIndex}
        dropTarget={dropTarget}
        onDragStart={setDraggingIndex}
        onDragOver={setDropTarget}
        onDragEnd={handleDragEnd}
      />
    </ScrollArea>
  );
};
