import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { formatTime } from "@/utils/format";
import type { Track } from "@/types";
import { Plus, Shuffle } from "lucide-react";

interface SearchResultItemProps {
  result: Track;
  onAdd: (track: Track) => void;
  onCreateMix: (track: Track) => void;
  isAdding?: boolean;
  isCreatingMix?: boolean;
}

export const SearchResultItem = ({
  result,
  onAdd,
  onCreateMix,
  isAdding,
  isCreatingMix,
}: SearchResultItemProps) => {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Avatar src={result.thumbnail} alt={result.title} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-50 truncate">
            {result.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {result.artist}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {formatTime(result.duration)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onAdd(result)}
            disabled={isAdding || isCreatingMix}
            size="sm"
          >
            {isAdding ? (
              "加入中..."
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                加入佇列
              </>
            )}
          </Button>
          <Button
            onClick={() => onCreateMix(result)}
            disabled={isAdding || isCreatingMix}
            size="sm"
            variant="outline"
            title="創建 Mix 混合播放清單"
          >
            {isCreatingMix ? "建立中..." : <Shuffle className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
};
