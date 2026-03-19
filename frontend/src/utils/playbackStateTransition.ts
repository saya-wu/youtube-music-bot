import type { PlaybackState, Track } from "../types";

function mergePreservedTrack(previousTrack: Track, queueHead: Track): Track {
  return {
    ...previousTrack,
    ...queueHead,
    // The newest queue/state metadata must win so radio tracks stay anonymous.
    requestedBy: queueHead.requestedBy,
    queueOrigin: queueHead.queueOrigin,
    radioGenerated: queueHead.radioGenerated,
  };
}

export function mergePlaybackStateDuringTrackTransition(
  incomingState: PlaybackState,
  previousState: PlaybackState,
): PlaybackState {
  const previousTrack = previousState.currentTrack;
  const queueHead = incomingState.queue[0] ?? null;
  const shouldPreserveCurrentTrack =
    incomingState.currentTrack === null &&
    incomingState.queue.length > 0 &&
    previousTrack !== null;

  if (!shouldPreserveCurrentTrack || !previousTrack) {
    return incomingState;
  }

  const canSafelyMergeCurrentTrack =
    queueHead !== null && queueHead.videoId === previousTrack.videoId;

  return {
    ...incomingState,
    currentTrack: canSafelyMergeCurrentTrack
      ? mergePreservedTrack(previousTrack, queueHead)
      : previousTrack,
    position:
      incomingState.position > 0 ? incomingState.position : previousState.position,
    duration:
      incomingState.duration > 0 ? incomingState.duration : previousState.duration,
  };
}
