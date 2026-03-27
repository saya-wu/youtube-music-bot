import type { ReleaseNotesEntry } from "../types/index.ts";

const fallbackReleaseNotesByVersion: Record<string, ReleaseNotesEntry> = {
  "0.7.0": {
    version: "0.7.0",
    title: "Discover 多市場探索",
    publishedAt: "2026-03-28",
    status: "preview",
    summary: "把探索體驗從搜尋頁獨立出來，改成可切換 8 個市場的 Discover 首頁。",
    sections: [
      {
        category: "added",
        title: "全新功能",
        description: "加入新的探索入口與跨市場內容瀏覽能力。",
        items: [
          "新增 Discover 頁面，可直接切換台灣、美國、日本、韓國、英國、德國、巴西與墨西哥等 8 個市場。",
          "每個市場會動態載入 YouTube Music 的情境與類型分類，快速切換不同 mood 探索內容。",
          "Discover 頁面加入本站熱門點播區，能看到目前站內最常被主動點播的歌曲。",
        ],
      },
      {
        category: "changed",
        title: "探索流程增強",
        description: "把探索內容做成真正可操作的內容卡片，而不是只做瀏覽展示。",
        items: [
          "探索卡片支援單曲加入佇列、建立 Mix、收藏，以及整張專輯或整個播放清單直接排入佇列。",
          "桌面與手機版都能直接切換到 Discover，不再把探索內容混進搜尋頁。",
        ],
      },
    ],
  },
  "0.6.0": {
    version: "0.6.0",
    title: "性能提升與無縫播放",
    publishedAt: "2026-03-24",
    status: "released",
    summary: "聚焦在播放引擎與切歌體驗，讓等待更短、轉場更自然。",
    sections: [
      {
        category: "changed",
        title: "播放功能增強",
        description: "優先改善切歌、預載與轉場手感。",
        items: [
          "新增下一首預加載機制，降低切歌時等待串流解析的停頓感。",
          "播放器支援可調整秒數的 Crossfade，並優化淡入淡出曲線，讓歌曲之間的銜接更自然。",
          "播放器介面新增 Crossfade 開關與秒數控制，桌面與手機版都可即時同步。",
          "播放核心加入更積極的 stream URL 快取與重用，減少重複解析負擔。",
        ],
      },
      {
        category: "changed",
        title: "歌詞閱讀優化",
        description: "改善操作歌詞時的可讀性與定位效率。",
        items: [
          "手動捲動歌詞時會降低模糊並提升鄰近行可讀性，方便邊看邊找段落。",
        ],
      },
    ],
  },
  "0.5.0": {
    version: "0.5.0",
    title: "搜尋與播放切換修正",
    publishedAt: "2026-03-23",
    status: "released",
    summary: "同時補上搜尋加入播放鏈路、外部連結解析與多項播放穩定性修正。",
    sections: [
      {
        category: "added",
        title: "全新功能",
        description: "擴大可匯入來源，讓搜尋與連結都能直接接到播放流程。",
        items: [
          "支援從 YouTube / YouTube Music 連結解析單曲、歌單、專輯與 Mix 內容。",
          "Mix 列表中的單首歌曲或影片可各自加入播放佇列、歌單與收藏。",
        ],
      },
      {
        category: "changed",
        title: "播放與搜尋增強",
        description: "改善使用者把內容送進播放佇列時的連續性。",
        items: [
          "搜尋結果現在可正確加入播放佇列，並在空佇列時自動開始播放。",
        ],
      },
      {
        category: "fixed",
        title: "問題修復",
        description: "補強播放狀態、顯示與連線穩定性。",
        items: [
          "Mix 內容的作者名稱顯示已修正，不再誤顯示為 Unknown。",
          "WebSocket 連線穩定性已改善，降低前端重複掛載造成的斷線問題。",
          "播放器在手動跳歌與自動切歌時會顯示正確的載入狀態，且不再沿用上一首的進度條位置。",
        ],
      },
    ],
  },
  "0.4.0": {
    version: "0.4.0",
    title: "播放體驗更新",
    publishedAt: "2026-03-19",
    status: "released",
    summary: "建立更完整的播放器操作面，並補上搜尋捷徑與版本說明入口。",
    sections: [
      {
        category: "added",
        title: "全新功能",
        description: "加入更多直接操作播放內容的入口。",
        items: [
          "新增 Cmd/Ctrl + K 快捷鍵，可快速聚焦到搜尋功能。",
          "歌曲項目可開啟專輯檢視，快速瀏覽同專輯的其他曲目。",
          "新增可捲動的版本更新說明對話框，可查看此版本的重點變更與建置資訊。",
        ],
      },
      {
        category: "changed",
        title: "播放介面增強",
        description: "強化桌面播放器、專輯檢視與已儲存 Mix 的可操作性。",
        items: [
          "歌單列右側的加號按鈕現在會直接將歌曲加入播放佇列。",
          "桌面播放器中的長歌名、歌手名稱與專輯名稱會在需要時改為跑馬燈顯示，且只在實際捲動時套用邊緣虛化。",
          "專輯檢視中的歌曲現在可直接加入收藏、加入歌單，並可一次把整張專輯加入播放佇列。",
          "已儲存 Mix 區塊改為可完整展開並以內部捲動瀏覽，不再出現內容被截斷的情況。",
        ],
      },
    ],
  },
};

export function compareReleaseNoteVersionsDesc(
  left: string,
  right: string,
): number {
  const leftParts = left
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }

  return 0;
}

export function getFallbackReleaseNotesForVersion(
  version: string,
): ReleaseNotesEntry | null {
  return fallbackReleaseNotesByVersion[version] ?? null;
}

export function getFallbackReleaseNotes(): ReleaseNotesEntry[] {
  return Object.values(fallbackReleaseNotesByVersion).sort((left, right) => {
    const publishedDateComparison = right.publishedAt.localeCompare(left.publishedAt);

    if (publishedDateComparison !== 0) {
      return publishedDateComparison;
    }

    return compareReleaseNoteVersionsDesc(left.version, right.version);
  });
}
