import type { Track, PlaybackState } from "../types/index.ts";
import { getPlayerService } from "./player.service.ts";
import { getMusicService } from "./music.service.ts";
import { log } from "../utils/logger.ts";

type QueueChangeCallback = (queue: Track[]) => void;
type PlaybackStateCallback = (state: PlaybackState) => void;
type LyricsChangeCallback = (lyrics: any[]) => void;

class QueueService {
  private static instance: QueueService | undefined;
  private mixRequestId = 0;
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

  static resetInstanceForTests(): void {
    if (QueueService.instance) {
      QueueService.instance.resetForTests();
    }
    QueueService.instance = undefined;
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
    const mixRequestId = ++this.mixRequestId;

    // 停止當前播放
    await getPlayerService().stop();

    // 清空佇列
    this.queue = [];
    this.currentTrack = null;
    this.currentPosition = 0;
    this.currentDuration = 0;
    this.isPaused = false;
    this.broadcastQueueChange();
    this.broadcastState();

    // 先加入基礎歌曲
    this.queue.push(baseTrack);

    log.info("Mix created, starting playback", {
      addedTracks: this.queue.length,
    });
    this.broadcastQueueChange();

    // 先開始播放 base song，不等待推薦歌曲回來。
    await this.playNext();

    // 再背景補上推薦歌曲。
    let mixTracks: Track[] = [];
    try {
      mixTracks = await getMusicService().getMixTracks(baseTrack.videoId, 10);

      // 如果期間又建立了新的 mix，就丟棄舊結果避免污染 queue。
      if (mixRequestId !== this.mixRequestId) {
        log.info("Discarding stale mix tracks", {
          baseTrack: baseTrack.title,
          mixRequestId,
          currentMixRequestId: this.mixRequestId,
        });
        return [baseTrack];
      }

      if (mixTracks.length > 0) {
        this.queue.push(...mixTracks);
        this.broadcastQueueChange();

        // 若 base song 已結束且播放器空閒，補上的 mix 要能自動接續播放。
        if (this.currentTrack === null && !getPlayerService().isCurrentlyPlaying()) {
          await this.playNext();
        }
      }
    } catch (error) {
      log.warn("Failed to get mix tracks, playing base track only", { error });
    }

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
      // 先交給 mpv + yt-dlp 處理 YouTube URL，與參考實作一致且更穩定。
      await getPlayerService().play(nextTrack.videoId);
      log.info("Playback started successfully via yt-dlp");
    } catch (playError) {
      // Fallback：若 yt-dlp 路徑失敗，再退回直接串流 URL。
      log.warn("Primary playback failed, falling back to direct stream URL", {
        error:
          playError instanceof Error ? playError.message : String(playError),
        stack: playError instanceof Error ? playError.stack : undefined,
        videoId: nextTrack.videoId,
      });

      try {
        log.info("Fetching stream URL for playback fallback", {
          videoId: nextTrack.videoId,
        });
        const streamResult = await getMusicService().getStreamUrl(
          nextTrack.videoId,
        );
        log.info("Stream URL obtained", {
          source: streamResult.source,
          urlLength: streamResult.url.length,
          urlPrefix: streamResult.url.substring(0, 50) + "...",
        });
        await getPlayerService().playUrl(streamResult.url);
        log.info("Fallback stream playback succeeded");
      } catch (fallbackError) {
        log.error("Both primary playback and stream fallback failed", {
          playError:
            playError instanceof Error ? playError.message : String(playError),
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

  resetForTests(): void {
    this.mixRequestId = 0;
    this.queue = [];
    this.currentTrack = null;
    this.currentPosition = 0;
    this.currentDuration = 0;
    this.isPaused = false;
    this.lastEofTimestamp = 0;
    this.queueChangeCallbacks = [];
    this.stateChangeCallbacks = [];
    this.lyricsChangeCallbacks = [];
  }
}

export function getQueueService(): QueueService {
  return QueueService.getInstance();
}

export function __resetQueueServiceForTests(): void {
  QueueService.resetInstanceForTests();
}
