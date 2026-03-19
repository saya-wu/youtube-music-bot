export interface ReleaseNotesEntry {
  version: string;
  title: string;
  highlights: string[];
}

const releaseNotesByVersion: Record<string, ReleaseNotesEntry> = {
  "0.4.0": {
    version: "0.4.0",
    title: "播放體驗更新",
    highlights: [
      "歌單列右側的加號按鈕現在會直接將歌曲加入播放佇列。",
      "新增 Cmd/Ctrl + K 快捷鍵，可快速聚焦到搜尋功能。",
      "桌面播放器中的長歌名、歌手名稱與專輯名稱會在需要時改為跑馬燈顯示，且只在實際捲動時套用邊緣虛化。",
      "歌曲項目可開啟專輯檢視，快速瀏覽同專輯的其他曲目。",
      "專輯檢視中的歌曲現在可直接加入收藏、加入歌單，並可一次把整張專輯加入播放佇列。",
      "已儲存 Mix 區塊改為可完整展開並以內部捲動瀏覽，不再出現內容被截斷的情況。",
      "新增可捲動的版本更新說明對話框，可查看此版本的重點變更與建置資訊。",
    ],
  },
};

export function getReleaseNotesForVersion(version: string): ReleaseNotesEntry | null {
  return releaseNotesByVersion[version] ?? null;
}
