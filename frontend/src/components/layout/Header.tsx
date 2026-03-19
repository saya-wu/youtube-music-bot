import { useEffect, useState } from "react";
import { ConnectionStatus } from "./ConnectionStatus";
import { Github, Music2, Search } from "lucide-react";
import { useAppUiStore } from "@/stores/appUiStore";
import { api, type SystemInfoResponse } from "@/services/api";
import { frontendAppMetadata } from "@/lib/app-metadata";
import {
  hasSeenReleaseNotes,
  markReleaseNotesAsSeen,
} from "@/lib/release-notes-storage";
import { getReleaseNotesForVersion } from "@/data/release-notes";
import { getVersionBadgeVariant } from "@/utils/version";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HeaderProps {
  onSearchClick?: () => void;
}

export const Header = ({ onSearchClick }: HeaderProps) => {
  const desktopMode = useAppUiStore((state) => state.desktopMode);
  const setDesktopMode = useAppUiStore((state) => state.setDesktopMode);
  const [backendInfo, setBackendInfo] = useState<SystemInfoResponse | null>(null);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const currentReleaseNotes = getReleaseNotesForVersion(frontendAppMetadata.appVersion);

  useEffect(() => {
    let cancelled = false;

    async function loadSystemInfo() {
      const response = await api.getSystemInfo();
      if (!cancelled && response.success && response.data) {
        setBackendInfo(response.data);
      }
    }

    void loadSystemInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentReleaseNotes) {
      return;
    }

    if (hasSeenReleaseNotes(currentReleaseNotes.version)) {
      return;
    }

    markReleaseNotesAsSeen(currentReleaseNotes.version);
    const openTimer = window.setTimeout(() => {
      setIsVersionDialogOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(openTimer);
    };
  }, [currentReleaseNotes]);

  const versionBadgeVariant = getVersionBadgeVariant(
    frontendAppMetadata.buildVersion,
    backendInfo?.buildVersion,
  );
  const versionTooltip = [
    `Frontend ${frontendAppMetadata.buildVersion}`,
    `Backend ${backendInfo?.buildVersion ?? "loading..."}`,
  ].join(" | ");

  const renderVersionBadgeButton = (className?: string) => (
    <button
      type="button"
      onClick={() => setIsVersionDialogOpen(true)}
      className={className}
      title={versionTooltip}
      aria-label="查看版本資訊"
    >
      <Badge variant={versionBadgeVariant}>v{frontendAppMetadata.appVersion}</Badge>
    </button>
  );

  return (
    <>
      <header className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)]/90 px-4 py-3 backdrop-blur-xl lg:px-6 lg:py-4">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          {/* Logo - 手機版縮小 */}
          <div className="flex items-center gap-3">
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm lg:flex">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] lg:text-[1.9rem]">
                  <span className="lg:hidden">🎵</span>{" "}
                  <span className="hidden sm:inline">YouTube Music Bot</span>
                </h1>
                {renderVersionBadgeButton("hidden sm:inline-flex")}
              </div>
              <p className="hidden text-sm text-[var(--text-secondary)] lg:block">
                Desktop jukebox with synced lyrics and live queue
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center rounded-[24px] border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] p-1">
            <button
              type="button"
              onClick={() => setDesktopMode("player")}
              className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                desktopMode === "player"
                  ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_12px_24px_-20px_var(--accent-glow)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              播放中
            </button>
            <button
              type="button"
              onClick={() => setDesktopMode("library")}
              className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                desktopMode === "library"
                  ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_12px_24px_-20px_var(--accent-glow)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              媒體庫
            </button>
          </div>

          <div className="flex items-center gap-2 lg:flex-1 lg:justify-end lg:gap-4">
            {/* 搜尋按鈕 - 手機版隱藏 */}
            <button
              type="button"
              onClick={onSearchClick}
              className="desktop-command-button hidden min-w-[260px] items-center justify-between rounded-2xl border px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 lg:flex"
            >
              <span className="flex items-center gap-3 text-[var(--text-primary)]">
                <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="font-medium">搜尋音樂</span>
              </span>
              <kbd className="inline-flex h-7 select-none items-center gap-1 rounded-xl border border-[color:var(--surface-border)] bg-[var(--surface-muted)] px-2.5 font-mono text-xs text-[var(--text-secondary)]">
                <span className="text-[0.65rem]">⌘</span>K
              </kbd>
            </button>

            {/* GitHub 連結 */}
            <a
              href="https://github.com/bs10081/youtube-music-bot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              aria-label="前往 GitHub 專案"
            >
              <Github className="h-5 w-5" />
            </a>

            {/* 連線狀態 */}
            <ConnectionStatus />

            {renderVersionBadgeButton("sm:hidden")}
          </div>
        </div>
      </header>

      <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
        <DialogContent className="flex max-h-[min(85vh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col p-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--surface-border)] p-6 pb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <DialogTitle className="leading-snug">
                  版本更新與建置資訊
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  可從標頭版本號隨時重新開啟，查看目前版本重點與部署追蹤資訊。
                </DialogDescription>
              </div>
              <DialogClose className="static right-auto top-auto shrink-0 self-start" />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 px-6 pb-6 pt-4">
                {currentReleaseNotes ? (
                  <div className="space-y-3">
                    <div className="surface-subtle rounded-2xl border border-[color:var(--surface-border)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Release Notes
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                        v{currentReleaseNotes.version} · {currentReleaseNotes.title}
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                        {currentReleaseNotes.highlights.map((highlight) => (
                          <li key={highlight} className="leading-relaxed">
                            • {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="surface-subtle rounded-2xl border border-[color:var(--surface-border)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Frontend
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                      {frontendAppMetadata.buildVersion}
                    </p>
                  </div>

                  <div className="surface-subtle rounded-2xl border border-[color:var(--surface-border)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Backend
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                      {backendInfo?.buildVersion ?? "loading..."}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
