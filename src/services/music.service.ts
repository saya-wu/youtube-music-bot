import { Innertube, Log, UniversalCache } from "youtubei.js";
import { spawn } from "node:child_process";
import type {
  AlbumDetails,
  Track,
  TrackAlbum,
  LyricLine,
  StreamUrlResult,
} from "../types/index.ts";
import { log } from "../utils/logger.ts";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { getYtDlpCliArgs } from "../utils/ytdlp.ts";

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

type MixPanelItem = {
  video_id?: string;
  id?: string;
  title?: string | { text?: string };
  artists?: Array<{ name?: string }>;
  author?: string | { name?: string };
  duration?: number | { seconds?: number };
};

type MusicItemArtist = {
  name?: string;
};

type MusicItemAlbum = {
  id?: string;
  name?: string;
};

type MusicItemThumbnail =
  | string
  | {
      contents?: Array<{ url?: string | null }>;
    }
  | null;

type MusicSearchItem = {
  id?: string;
  title?: string;
  artists?: MusicItemArtist[];
  album?: MusicItemAlbum;
  duration?: number | { seconds?: number };
  thumbnail?: MusicItemThumbnail;
};

function getMixTrackArtistName(item: MixPanelItem): string {
  if (Array.isArray(item.artists)) {
    const names = item.artists
      .map((artist) => artist?.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return names.join(", ");
    }
  }

  if (typeof item.author === "string" && item.author.trim()) {
    return item.author;
  }

  if (
    typeof item.author === "object" &&
    typeof item.author?.name === "string" &&
    item.author.name.trim()
  ) {
    return item.author.name;
  }

  return "Unknown";
}

export function normalizeMixTracks(
  contents: unknown[],
  seedVideoId: string,
  limit: number,
): Track[] {
  const tracks: Track[] = [];

  for (const item of contents) {
    const video = item as MixPanelItem;
    const itemVideoId = video.video_id || video.id;

    if (!itemVideoId || itemVideoId === seedVideoId) {
      continue;
    }

    const title =
      typeof video.title === "string" ? video.title : video.title?.text;
    if (!title || !title.trim()) {
      continue;
    }

    const duration =
      typeof video.duration === "number"
        ? video.duration
        : video.duration?.seconds || 0;

    tracks.push({
      videoId: itemVideoId,
      title,
      artist: getMixTrackArtistName(video),
      duration,
      thumbnail: `https://img.youtube.com/vi/${itemVideoId}/mqdefault.jpg`,
    });

    if (tracks.length >= limit) {
      break;
    }
  }

  return tracks;
}

function getDurationSeconds(
  duration: number | { seconds?: number } | undefined,
): number {
  if (typeof duration === "number") {
    return duration;
  }

  return duration?.seconds || 0;
}

function getThumbnailUrl(
  thumbnail: MusicItemThumbnail | undefined,
  fallbackUrl?: string,
): string | undefined {
  if (typeof thumbnail === "string" && thumbnail.trim()) {
    return thumbnail;
  }

  if (!thumbnail || typeof thumbnail !== "object") {
    return fallbackUrl;
  }

  const url = thumbnail.contents
    ?.find((item: { url?: string | null }) => item?.url?.trim())
    ?.url?.trim();
  return url || fallbackUrl;
}

function getAlbumSummary(album: MusicItemAlbum | undefined): TrackAlbum | undefined {
  const albumId = album?.id?.trim();
  const albumName = album?.name?.trim();

  if (!albumId || !albumName) {
    return undefined;
  }

  return {
    id: albumId,
    name: albumName,
  };
}

export function normalizeMusicSearchItem(item: MusicSearchItem): Track | null {
  const videoId = item.id?.trim();

  if (!videoId) {
    return null;
  }

  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return {
    videoId,
    title: item.title || "Unknown",
    artist: getItemArtistName(item.artists),
    duration: getDurationSeconds(item.duration),
    thumbnail: getThumbnailUrl(item.thumbnail, fallbackThumbnail),
    album: getAlbumSummary(item.album),
  };
}

function getItemArtistName(
  artists: MusicItemArtist[] | undefined,
  fallback: string = "Unknown",
): string {
  const names = artists
    ?.map((artist) => artist?.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names && names.length > 0) {
    return names.join(", ");
  }

  return fallback;
}

function getHeaderText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (value && typeof value === "object") {
    const maybeText = value as {
      text?: unknown;
      toString?: () => string;
    };

    if (typeof maybeText.text === "string") {
      const normalized = maybeText.text.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof maybeText.toString === "function") {
      const normalized = maybeText.toString().trim();
      if (normalized.length > 0 && normalized !== "[object Object]") {
        return normalized;
      }
    }
  }

  return undefined;
}

function getHeaderAuthorName(header: unknown): string | undefined {
  if (!header || typeof header !== "object") {
    return undefined;
  }

  const authorName = (header as { author?: { name?: string } }).author?.name;
  if (typeof authorName !== "string") {
    return undefined;
  }

  const normalized = authorName.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getHeaderThumbnailUrl(header: unknown): string | undefined {
  if (!header || typeof header !== "object") {
    return undefined;
  }

  const withThumbnail = header as {
    thumbnail?: { contents?: Array<{ url?: string }> } | null;
    thumbnails?: Array<{ url?: string }>;
  };

  const responsiveThumbnail = withThumbnail.thumbnail?.contents
    ?.find((item) => item?.url?.trim())
    ?.url?.trim();
  if (responsiveThumbnail) {
    return responsiveThumbnail;
  }

  const detailThumbnail = withThumbnail.thumbnails
    ?.find((item) => item?.url?.trim())
    ?.url?.trim();
  return detailThumbnail || undefined;
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
        const normalizedTrack = normalizeMusicSearchItem(item as MusicSearchItem);
        if (!normalizedTrack) continue;

        tracks.push(normalizedTrack);
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

  async getAlbum(albumId: string): Promise<AlbumDetails | null> {
    try {
      const yt = await getClient();
      const album = await yt.music.getAlbum(albumId);
      const title = getHeaderText(album.header?.title) || "Unknown Album";
      const tracks: Track[] = [];

      for (const item of album.contents as MusicSearchItem[]) {
        const videoId = item.id?.trim();

        if (!videoId) {
          continue;
        }

        const normalizedTrack: Track = {
          videoId,
          title: item.title || "Unknown",
          artist: getItemArtistName(item.artists),
          duration: getDurationSeconds(item.duration),
          thumbnail:
            getThumbnailUrl(item.thumbnail) ||
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          album: getAlbumSummary(item.album) ?? {
            id: albumId,
            name: title,
          },
        };

        tracks.push(normalizedTrack);
      }

      return {
        id: albumId,
        title,
        artist:
          getHeaderAuthorName(album.header) ||
          tracks[0]?.artist ||
          "Unknown",
        subtitle: getHeaderText(album.header?.subtitle),
        trackSummary: getHeaderText(album.header?.second_subtitle),
        thumbnail: getHeaderThumbnailUrl(album.header) || tracks[0]?.thumbnail,
        tracks,
      };
    } catch (error) {
      log.error("Failed to get album", {
        error: error instanceof Error ? error.message : String(error),
        albumId,
      });
      return null;
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

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

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
          ? await yt.session.player.decipher(format.url)
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
      log.warn("Primary stream extraction failed, trying yt-dlp CLI fallback", {
        error: error instanceof Error ? error.message : String(error),
        videoId,
      });

      const fallbackUrl = await this.getStreamUrlViaYtDlp(youtubeUrl);
      return {
        url: fallbackUrl,
        source: "yt-dlp",
      };
    }
  }

  private async getStreamUrlViaYtDlp(url: string): Promise<string> {
    const args = getYtDlpCliArgs(url);

    return new Promise<string>((resolve, reject) => {
      const child = spawn("yt-dlp", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("exit", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              stderr.trim() || `yt-dlp exited with code ${code ?? "unknown"}`,
            ),
          );
          return;
        }

        const urls = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const streamUrl = urls[urls.length - 1];

        if (!streamUrl) {
          reject(new Error("yt-dlp did not return a playable URL"));
          return;
        }

        log.info("Stream URL obtained via yt-dlp CLI", {
          urlLength: streamUrl.length,
          lineCount: urls.length,
        });
        resolve(streamUrl);
      });
    });
  }

  /**
   * 獲取混合播放清單（類似 YouTube Music 的 Mix/電台功能）
   */
  async getMixTracks(videoId: string, limit: number = 15): Promise<Track[]> {
    log.info("Getting mix tracks", { videoId, limit });

    try {
      const yt = await getClient();
      const panel = await yt.music.getUpNext(videoId, true);
      const tracks = normalizeMixTracks(panel.contents || [], videoId, limit);

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

export function __resetMusicServiceForTests(): void {
  musicServiceInstance = null;
  ytClient = null;
}
