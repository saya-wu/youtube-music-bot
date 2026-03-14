import type { Track, PlaybackState } from "../types/index.ts";
import { getPlayerService } from "./player.service.ts";
import { getMusicService } from "./music.service.ts";
import { log } from "../utils/logger.ts";

type QueueChangeCallback = (queue: Track[]) => void;
type PlaybackStateCallback = (state: PlaybackState) => void;
type LyricsChangeCallback = (lyrics: any[]) => void;

class QueueService {
  private static instance: QueueService;
  private queue: Track[] = [];
  private currentTrack: Track | null = null;
  private currentPosition = 0;
  private currentDuration = 0;
  private isPaused = false;
  private lastEofTimestamp = 0; // 記錄 EOF 時間，用於抑制假 pause 事件
  private queueChangeCallbacks: QueueChangeCallback[] = [];
  private stateChangeCallbacks: PlaybackStateCallback[] = [];
  private lyricsChangeCallbacks: LyricsChangeCallback[] = [];

  private constructor() {
    // 監聽播放器事件
    const player = getPlayerService();
    player.onEvent((event) => {
      if (event.timePos !== undefined) {
        this.currentPosition = event.timePos;
      }
      if (event.duration !== undefined) {
        this.currentDuration = event.duration;
      }

      // EOF 處理
      if (event.eof === true) {
        this.lastEofTimestamp = Date.now(); // 記錄 EOF 時間
        log.info("Track ended, playing next...");
        this.playNext();
      }

      // Pause 處理 - 抑制 EOF 後 2 秒內的假暫停
      if (event.paused !== undefined) {
        // mpv 進入 idle 模式時會發送 pause: true
        // 抑制 EOF 後 2 秒內的 pause 事件，防止覆蓋 isPlaying 狀態
        const timeSinceEof = Date.now() - this.lastEofTimestamp;
        if (event.paused && timeSinceEof < 2000) {
          log.debug("Ignoring pause event after EOF", {
            timeSinceEof,
            threshold: 2000,
          });
          return; // 直接返回，不處理也不廣播
        }
        this.isPaused = event.paused;
      }

      // 廣播狀態變更
      this.broadcastState();
    });
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * 註冊佇列變更回調
   */
  onQueueChange(callback: QueueChangeCallback): void {
    this.queueChangeCallbacks.push(callback);
  }

  /**
   * 註冊播放狀態變更回調
   */
  onStateChange(callback: PlaybackStateCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * 註冊歌詞變更回調
   */
  onLyricsChange(callback: LyricsChangeCallback): void {
    this.lyricsChangeCallbacks.push(callback);
  }

  /**
   * 廣播佇列變更
   */
  private broadcastQueueChange(): void {
    for (const callback of this.queueChangeCallbacks) {
      callback([...this.queue]);
    }
  }

  /**
   * 廣播狀態變更
   */
  private broadcastState(): void {
    const state: PlaybackState = {
      isPlaying: !this.isPaused && this.currentTrack !== null,
      currentTrack: this.currentTrack,
      position: this.currentPosition,
      duration: this.currentDuration,
      volume: getPlayerService().getVolume(),
      queue: [...this.queue],
    };

    for (const callback of this.stateChangeCallbacks) {
      callback(state);
    }
  }

  /**
   * 加入歌曲到播放清單
   */
  async addToQueue(track: Track): Promise<void> {
    // 直接使用前端傳來的 Track，不再重新搜尋
    this.queue.push(track);

    log.info("Added to queue", {
      videoId: track.videoId,
      title: track.title,
      artist: track.artist,
    });
    this.broadcastQueueChange();

    // 如果目前沒有播放，自動開始播放
    // 使用雙重檢查：currentTrack 為 null 且播放器未在播放
    const playerIsPlaying = getPlayerService().isCurrentlyPlaying();
    const shouldAutoPlay = this.currentTrack === null && !playerIsPlaying;

    log.info("Auto-play check", {
      currentTrack: this.currentTrack?.title ?? "null",
      playerIsPlaying,
      shouldAutoPlay,
      queueLength: this.queue.length,
    });

    if (shouldAutoPlay) {
      log.info("Auto-starting playback for newly added track");
      this.playNext();
    }
  }

  /**
   * 創建混合播放清單
   * 清空佇列，立即開始播放 Mix
   */
  async createMixFromTrack(baseTrack: Track): Promise<Track[]> {
    log.info("Creating mix", { baseTrack: baseTrack.title });

    // 停止當前播放
    await getPlayerService().stop();

    // 清空佇列
    this.queue = [];
    this.currentTrack = null;

    // 先加入基礎歌曲
    this.queue.push(baseTrack);

    // 嘗試獲取推薦歌曲
    let mixTracks: Track[] = [];
    try {
      mixTracks = await getMusicService().getMixTracks(baseTrack.videoId, 10);
      if (mixTracks.length > 0) {
        this.queue.push(...mixTracks);
      }
    } catch (error) {
      log.warn("Failed to get mix tracks, playing base track only", { error });
    }

    log.info("Mix created, starting playback", {
      addedTracks: this.queue.length,
    });
    this.broadcastQueueChange();

    // 無論是否有推薦歌曲，都開始播放
    await this.playNext();

    return [baseTrack, ...mixTracks];
  }

  /**
   * 從播放清單移除歌曲
   */
  removeFromQueue(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      const removed = this.queue.splice(index, 1);
      log.info("Removed from queue", { videoId: removed[0]?.videoId });
      this.broadcastQueueChange();
    }
  }

  /**
   * 播放下一首
   */
  async playNext(): Promise<void> {
    log.info("playNext called", {
      queueLength: this.queue.length,
      currentTrack: this.currentTrack?.title ?? "null",
      isPaused: this.isPaused,
    });

    if (this.queue.length === 0) {
      log.info("Queue is empty, stopping playback");
      this.currentTrack = null;
      this.currentPosition = 0;
      this.currentDuration = 0;
      this.isPaused = false;
      getPlayerService().stop();
      this.broadcastState();
      return;
    }

    // 從佇列取出下一首
    const nextTrack = this.queue.shift()!;
    this.currentTrack = nextTrack;
    this.currentPosition = 0;
    this.currentDuration = nextTrack.duration;
    this.isPaused = false;

    log.info("Playing next track", { title: nextTrack.title });

    // 廣播變更
    this.broadcastQueueChange();
    this.broadcastState();

    // 獲取並廣播歌詞
    this.fetchAndBroadcastLyrics();

    try {
      // 先嘗試獲取串流 URL（優化延遲）
      log.info("Fetching stream URL", { videoId: nextTrack.videoId });
      const streamResult = await getMusicService().getStreamUrl(
        nextTrack.videoId,
      );
      log.info("Stream URL obtained", {
        source: streamResult.source,
        urlLength: streamResult.url.length,
        urlPrefix: streamResult.url.substring(0, 50) + "...",
      });
      await getPlayerService().playUrl(streamResult.url);
      log.info("Playback started successfully via stream URL");
    } catch (streamError) {
      // Fallback：使用原始 play() 讓 mpv 透過 yt-dlp 解析
      log.warn("Stream URL extraction failed, falling back to yt-dlp", {
        error:
          streamError instanceof Error
            ? streamError.message
            : String(streamError),
        stack: streamError instanceof Error ? streamError.stack : undefined,
        videoId: nextTrack.videoId,
      });

      try {
        log.info("Attempting fallback play via yt-dlp", {
          videoId: nextTrack.videoId,
        });
        await getPlayerService().play(nextTrack.videoId);
        log.info("Fallback play succeeded");
      } catch (fallbackError) {
        log.error("Both stream URL and fallback play failed", {
          streamError:
            streamError instanceof Error
              ? streamError.message
              : String(streamError),
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
          videoId: nextTrack.videoId,
          trackTitle: nextTrack.title,
        });

        // 重置狀態，通知前端
        this.currentTrack = null;
        this.isPaused = false;
        this.broadcastState();

        // 拋出錯誤，讓調用者知道播放失敗
        throw new Error(
          `Failed to play track: ${nextTrack.title}. Error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        );
      }
    }
  }

  /**
   * 暫停/繼續播放
   */
  togglePlayPause(): void {
    if (this.isPaused) {
      getPlayerService().resume();
    } else {
      getPlayerService().pause();
    }
  }

  /**
   * 跳過當前歌曲
   */
  skip(): void {
    log.info("Skipping current track");
    this.playNext();
  }

  /**
   * 設定音量
   */
  setVolume(volume: number): void {
    getPlayerService().setVolume(volume);
    this.broadcastState();
  }

  /**
   * 跳轉到指定位置
   */
  seekTo(position: number): void {
    // 驗證輸入和邊界
    if (!Number.isFinite(position) || position < 0) {
      log.warn("Invalid seek position", { position });
      return;
    }

    // 限制在當前歌曲的 duration 範圍內
    const clampedPosition = Math.min(position, this.currentDuration);

    log.debug("Seeking to position", { position: clampedPosition });
    this.currentPosition = clampedPosition;
    getPlayerService().seek(clampedPosition);
    this.broadcastState();
  }

  /**
   * 取得播放清單
   */
  getQueue(): Track[] {
    return [...this.queue];
  }

  /**
   * 取得目前播放狀態
   */
  getState(): PlaybackState {
    return {
      isPlaying: !this.isPaused && this.currentTrack !== null,
      currentTrack: this.currentTrack,
      position: this.currentPosition,
      duration: this.currentDuration,
      volume: getPlayerService().getVolume(),
      queue: [...this.queue],
    };
  }

  /**
   * 取得歌詞
   */
  async getLyrics() {
    if (!this.currentTrack) {
      return [];
    }

    const musicService = getMusicService();
    return await musicService.getLyrics(
      this.currentTrack.title,
      this.currentTrack.artist,
      this.currentTrack.duration,
    );
  }

  /**
   * 獲取並廣播歌詞（異步）
   */
  private fetchAndBroadcastLyrics(): void {
    // 使用異步方式獲取歌詞，避免阻塞播放
    this.getLyrics()
      .then((lyrics) => {
        // 透過回調通知歌詞變更
        for (const callback of this.lyricsChangeCallbacks) {
          callback(lyrics);
        }
        log.debug("Lyrics broadcasted", { lyricsCount: lyrics.length });
      })
      .catch((error) => {
        log.error("Failed to fetch lyrics", { error });
      });
  }
}

export function getQueueService(): QueueService {
  return QueueService.getInstance();
}
