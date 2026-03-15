import { QueueItem } from "./QueueItem";
import type { Track } from "@/types";
import type { DragEvent, TouchEvent } from "react";
import { cn } from "@/lib/utils";

type DropTarget = {
  index: number;
  position: "before" | "after";
} | null;

interface QueueListProps {
  queue: Track[];
  mobile?: boolean;
  onRemove: (index: number) => void;
  onAddToPlaylist: (track: Track) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  removingIndex: number | null;
  draggingIndex: number | null;
  dropTarget: DropTarget;
  onDragStart: (index: number) => void;
  onDragOver: (target: NonNullable<DropTarget>) => void;
  onDragEnd: () => void;
}

export const QueueList = ({
  queue,
  mobile = false,
  onRemove,
  onAddToPlaylist,
  onReorder,
  removingIndex,
  draggingIndex,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
}: QueueListProps) => {
  const handleDrop = (index: number, position: "before" | "after") => {
    if (draggingIndex === null) {
      return;
    }

    const insertionIndex = position === "after" ? index + 1 : index;
    const finalIndex =
      draggingIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

    onReorder(draggingIndex, finalIndex);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    onDragStart(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (draggingIndex === null || draggingIndex === index) {
      return;
    }

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const position =
      event.clientY - top > height / 2 ? "after" : "before";

    event.dataTransfer.dropEffect = "move";
    onDragOver({ index, position });
  };

  const resolveTouchDropTarget = (touch: { clientX: number; clientY: number }) => {
    const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemElement = touchedElement?.closest<HTMLElement>("[data-queue-item-index]");

    if (!itemElement) {
      return null;
    }

    const index = Number(itemElement.dataset.queueItemIndex);

    if (Number.isNaN(index)) {
      return null;
    }

    const { top, height } = itemElement.getBoundingClientRect();
    const position = touch.clientY - top > height / 2 ? "after" : "before";

    return { index, position } as const;
  };

  const handleTouchStart = (index: number) => {
    if (!mobile) {
      return;
    }

    onDragStart(index);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!mobile || draggingIndex === null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    event.preventDefault();

    const target = resolveTouchDropTarget(touch);

    if (!target || target.index === draggingIndex) {
      return;
    }

    onDragOver(target);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!mobile || draggingIndex === null) {
      return;
    }

    const touch = event.changedTouches[0];

    if (!touch) {
      onDragEnd();
      return;
    }

    const target = resolveTouchDropTarget(touch);

    if (!target || target.index === draggingIndex) {
      onDragEnd();
      return;
    }

    handleDrop(target.index, target.position);
  };

  return (
    <div className={cn(mobile ? "space-y-3 p-2" : "space-y-2 p-4 pr-3")}>
      {queue.map((track, index) => (
        <QueueItem
          key={`${track.videoId}-${index}`}
          track={track}
          index={index}
          mobile={mobile}
          onRemove={onRemove}
          onAddToPlaylist={onAddToPlaylist}
          isRemoving={removingIndex === index}
          isNext={index === 0}
          isDragging={draggingIndex === index}
          dropIndicator={
            dropTarget?.index === index && draggingIndex !== index
              ? dropTarget.position
              : null
          }
          onDragStart={(event) => handleDragStart(event, index)}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={(position) => handleDrop(index, position)}
          onDragEnd={onDragEnd}
          onTouchHandleStart={() => handleTouchStart(index)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={onDragEnd}
        />
      ))}
    </div>
  );
};
