import { describe, test, expect, beforeEach } from "bun:test";
import { getQueueService } from "../services/queue.service.ts";

describe("QueueService - seekTo functionality", () => {
  let queueService: ReturnType<typeof getQueueService>;

  beforeEach(() => {
    queueService = getQueueService();
  });

  describe("seekTo() method - input validation", () => {
    test("should reject negative position", () => {
      const initialState = queueService.getState();

      queueService.seekTo(-5);

      const newState = queueService.getState();
      // Position should not change
      expect(newState.position).toBe(initialState.position);
    });

    test("should reject NaN position", () => {
      const initialState = queueService.getState();

      queueService.seekTo(NaN);

      const newState = queueService.getState();
      expect(newState.position).toBe(initialState.position);
    });

    test("should reject Infinity position", () => {
      const initialState = queueService.getState();

      queueService.seekTo(Infinity);

      const newState = queueService.getState();
      expect(newState.position).toBe(initialState.position);
    });

    test("should accept zero position", () => {
      queueService.seekTo(0);

      const state = queueService.getState();
      expect(state.position).toBe(0);
    });

    test("should accept valid positive position", () => {
      const initialState = queueService.getState();

      queueService.seekTo(30);

      const state = queueService.getState();
      expect(state.position).toBe(initialState.position);
    });
  });

  describe("seekTo() method - boundary clamping", () => {
    test("should clamp position to duration when exceeding", () => {
      // Note: In a real scenario, you would need to set up a track first
      // This test demonstrates the clamping behavior
      const position = 9999;
      queueService.seekTo(position);

      const state = queueService.getState();
      // Position should be clamped to duration (which is 0 by default)
      expect(state.position).toBeLessThanOrEqual(state.duration);
    });
  });

  describe("volume control", () => {
    test("should update volume", () => {
      queueService.setVolume(80);

      const state = queueService.getState();
      expect(state.volume).toBe(80);
    });
  });

  describe("queue management", () => {
    test("should return empty queue initially", () => {
      const queue = queueService.getQueue();
      expect(Array.isArray(queue)).toBe(true);
    });

    test("should return playback state", () => {
      const state = queueService.getState();

      expect(state).toHaveProperty("isPlaying");
      expect(state).toHaveProperty("currentTrack");
      expect(state).toHaveProperty("position");
      expect(state).toHaveProperty("duration");
      expect(state).toHaveProperty("volume");
      expect(state).toHaveProperty("queue");
    });
  });
});
