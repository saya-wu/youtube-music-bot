const RELEASE_NOTES_SEEN_PREFIX = "youtube-music-bot:release-notes-seen:";

function getReleaseNotesSeenKey(version: string) {
  return `${RELEASE_NOTES_SEEN_PREFIX}${version}`;
}

export function hasSeenReleaseNotes(version: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(getReleaseNotesSeenKey(version)) === "1";
}

export function markReleaseNotesAsSeen(version: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getReleaseNotesSeenKey(version), "1");
}
