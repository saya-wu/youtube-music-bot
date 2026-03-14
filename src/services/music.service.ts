import { Innertube, Log, UniversalCache } from "youtubei.js";
import type { Track, LyricLine, StreamUrlResult } from "../types/index.ts";
import { log } from "../utils/logger.ts";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// 確保緩存目錄存在
const cacheDir = join(process.cwd(), ".cache", "youtubei");
if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
}

// 初始化 YouTube 客戶端
let ytClient: Innertube | null = null;

async function getClient() {
  if (!ytClient) {
    Log.setLevel(Log.Level.ERROR);
    log.info("Initializing YouTube client");

    ytClient = await Innertube.create({
      retrieve_player: true,
      cache: new UniversalCache(true, cacheDir),
    });

    log.info("YouTube client initialized", {
      hasPlayer: !!ytClient.session?.player,
    });
  }
  return ytClient;
}

// 解析 LRC 格式歌詞
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const rawLine of lrc.split("\n")) {
    const match = lineRegex.exec(rawLine.trim());
    if (match) {
      const minutes = parseInt(match[1]!, 10);
      const seconds = parseInt(match[2]!, 10);
      const centiseconds = parseInt(match[3]!.padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + centiseconds / 1000;
      const text = match[4]!.trim();
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

class MusicService {
  private searchCache = new Map<string, Track[]>();
  private lyricsCache = new Map<string, LyricLine[]>();

  async search(query: string, limit: number = 20): Promise<Track[]> {
    const cacheKey = `${query}:${limit}`;

    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    try {
      const yt = await getClient();
      const musicSearch = await yt.music.search(query, { type: "song" });

      const tracks: Track[] = [];
      const contents = (musicSearch as any).songs?.contents || [];

      for (const item of contents) {
        const videoId = item.id?.trim();
        if (!videoId) continue;

        const artists = item.artists || [];
        const artistName =
          artists.length > 0
            ? artists.map((a: any) => a.name).join(", ")
            : "Unknown";

        let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        if (item.thumbnail) {
          if (typeof item.thumbnail === "string") {
            thumbnailUrl = item.thumbnail;
          } else if (
            item.thumbnail.contents &&
            item.thumbnail.contents.length > 0
          ) {
            thumbnailUrl = item.thumbnail.contents[0].url;
          }
        }

        tracks.push({
          videoId,
          title: item.title || "Unknown",
          artist: artistName,
          duration:
            typeof item.duration === "number"
              ? item.duration
              : item.duration?.seconds || 0,
          thumbnail: thumbnailUrl,
        });
      }

      // Fallback: 一般 YouTube 搜尋
      if (tracks.length === 0) {
        const search = await yt.search(query);
        const videos = (search as any).videos || [];

        for (const video of videos) {
          const videoId = video.id || video.video_id;
          if (!videoId) continue;

          tracks.push({
            videoId,
            title:
              typeof video.title === "string"
                ? video.title
                : video.title?.text || "Unknown",
            artist:
              typeof video.author === "string"
                ? video.author
                : video.author?.name || "Unknown",
            duration:
              typeof video.duration === "number"
                ? video.duration
                : video.duration?.seconds || 0,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          });
        }
      }

      const result = tracks.slice(0, limit);
      this.searchCache.set(cacheKey, result);
      log.info("Search completed", { query, resultCount: result.length });
      return result;
    } catch (error) {
      log.error("Search failed", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return [];
    }
  }

  async getLyrics(
    trackName: string,
    artistName: string,
    duration?: number,
  ): Promise<LyricLine[]> {
    const cacheKey = `${trackName}::${artistName}`;

    if (this.lyricsCache.has(cacheKey)) {
      return this.lyricsCache.get(cacheKey)!;
    }

    try {
      const params = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
        ...(duration ? { duration: String(Math.round(duration)) } : {}),
      });

      const response = await fetch(
        `https://lrclib.net/api/get?${params.toString()}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          log.debug("No lyrics found", { trackName, artistName });
          this.lyricsCache.set(cacheKey, []);
          return [];
        }
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        syncedLyrics?: string;
        plainLyrics?: string;
      };

      const lyrics = data.syncedLyrics ? parseLrc(data.syncedLyrics) : [];

      this.lyricsCache.set(cacheKey, lyrics);
      log.info("Lyrics loaded", { trackName, syncedLines: lyrics.length });
      return lyrics;
    } catch (error) {
      log.error("Failed to fetch lyrics", {
        error: error instanceof Error ? error.message : String(error),
        trackName,
      });
      this.lyricsCache.set(cacheKey, []);
      return [];
    }
  }

  /**
   * 獲取直接串流 URL
   *
   * 注意：由於 YouTube API 問題 (GitHub Issue #1123)，目前無法獲取直接 URL。
   * 此方法會嘗試提取，失敗後由 queue.service.ts 的 fallback 機制處理（使用 yt-dlp）。
   *
   * @see https://github.com/LuanRT/YouTube.js/issues/1123
   */
  async getStreamUrl(videoId: string): Promise<StreamUrlResult> {
    log.info("Attempting stream URL extraction", { videoId });

    try {
      const yt = await getClient();

      // 嘗試 getStreamingData（應該返回已解密的 URL）
      try {
        const format = await yt.getStreamingData(videoId, {
          type: "audio",
          quality: "best",
        });

        const formatAny = format as any;
        if (formatAny?.url && formatAny.url.length > 0) {
          log.info("Stream URL obtained", {
            bitrate: formatAny.bitrate,
            urlLength: formatAny.url.length,
          });
          return {
            url: formatAny.url,
            source: "youtube-ext",
            bitrate: formatAny.bitrate,
          };
        }
      } catch (e) {
        // getStreamingData 失敗，繼續嘗試其他方法
      }

      // Fallback: getInfo + chooseFormat
      const info = await yt.getInfo(videoId);
      const format = info.chooseFormat({ type: "audio", quality: "best" });

      if (format?.url) {
        const url = yt.session?.player?.decipher
          ? yt.session.player.decipher(format.url)
          : format.url;

        if (url && url.length > 0) {
          log.info("Stream URL obtained via chooseFormat", {
            bitrate: format.bitrate,
          });
          return {
            url,
            source: "youtube-ext",
            bitrate: format.bitrate,
          };
        }
      }

      throw new Error("No suitable audio stream found");
    } catch (error) {
      log.warn("Stream extraction failed, will use yt-dlp fallback", {
        error: error instanceof Error ? error.message : String(error),
        videoId,
      });
      throw error;
    }
  }

  /**
   * 獲取混合播放清單（類似 YouTube Music 的 Mix/電台功能）
   */
  async getMixTracks(videoId: string, limit: number = 15): Promise<Track[]> {
    log.info("Getting mix tracks", { videoId, limit });

    try {
      const yt = await getClient();
      const panel = await yt.music.getUpNext(videoId, true);

      const tracks: Track[] = [];
      const contents = panel.contents || [];

      for (const item of contents) {
        const video = item as any;
        const itemVideoId = video.video_id || video.id;

        if (!itemVideoId || itemVideoId === videoId) continue;

        const artists = video.artists || video.author || [];
        const artistName = Array.isArray(artists)
          ? artists.map((a: any) => a.name).join(", ")
          : typeof artists === "string"
            ? artists
            : "Unknown";

        tracks.push({
          videoId: itemVideoId,
          title:
            typeof video.title === "string"
              ? video.title
              : video.title?.text || "Unknown",
          artist: artistName,
          duration: video.duration?.seconds || 0,
          thumbnail: `https://img.youtube.com/vi/${itemVideoId}/mqdefault.jpg`,
        });

        if (tracks.length >= limit) break;
      }

      log.info("Mix tracks fetched", { count: tracks.length });
      return tracks;
    } catch (error) {
      log.error("Failed to get mix tracks", { error });
      return [];
    }
  }
}

// 單例模式
let musicServiceInstance: MusicService | null = null;

export function getMusicService(): MusicService {
  if (!musicServiceInstance) {
    musicServiceInstance = new MusicService();
  }
  return musicServiceInstance;
}
