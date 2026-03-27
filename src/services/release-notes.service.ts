import {
  compareReleaseNoteVersionsDesc,
  getFallbackReleaseNotes,
  getFallbackReleaseNotesForVersion,
} from "../data/release-notes.ts";
import type {
  ReleaseNotesEntry,
  ReleaseNotesRepositoryInfo,
  ReleaseNotesResponse,
  ReleaseNotesSection,
  ReleaseNotesSectionCategory,
  ReleaseNotesSource,
} from "../types/index.ts";
import { log } from "../utils/logger.ts";

const GITHUB_API_BASE_URL =
  process.env.GITHUB_API_BASE_URL?.trim() || "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const DEFAULT_GITHUB_REPOSITORY = "bs10081/youtube-music-bot";
const RELEASE_NOTES_CACHE_TTL_MS = 15 * 60 * 1000;

type GitHubRelease = {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string | null;
};

type ParsedGitHubReleaseBody = {
  summary?: string;
  sections: ReleaseNotesSection[];
};

type MutableParsedSection = ReleaseNotesSection & {
  description?: string;
};

function normalizeRepositorySlug(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized || DEFAULT_GITHUB_REPOSITORY;
}

function getRepositoryInfo(): ReleaseNotesRepositoryInfo {
  const repositorySlug = normalizeRepositorySlug(
    process.env.RELEASE_NOTES_GITHUB_REPOSITORY ??
      process.env.GITHUB_REPOSITORY ??
      DEFAULT_GITHUB_REPOSITORY,
  );
  const [owner = "bs10081", name = "youtube-music-bot"] = repositorySlug.split("/");

  return {
    owner,
    name,
    url: `https://github.com/${owner}/${name}`,
  };
}

function normalizeVersion(value: string | null | undefined): string {
  const normalized = value?.trim() || "";
  return normalized.replace(/^refs\/tags\//, "").replace(/^v/i, "");
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1")
    .trim();
}

function getDefaultSectionTitle(category: ReleaseNotesSectionCategory): string {
  switch (category) {
    case "added":
      return "全新功能";
    case "fixed":
      return "問題修復";
    case "changed":
    default:
      return "功能增強";
  }
}

function detectReleaseNotesCategory(
  value: string,
): ReleaseNotesSectionCategory | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("contributor") ||
    normalized.includes("changelog") ||
    normalized.includes("thanks")
  ) {
    return null;
  }

  if (
    normalized.includes("修復") ||
    normalized.includes("修正") ||
    normalized.includes("bug") ||
    normalized.includes("fix")
  ) {
    return "fixed";
  }

  if (
    normalized.includes("新增") ||
    normalized.includes("全新") ||
    normalized.includes("added") ||
    normalized.includes("new") ||
    normalized.includes("feature")
  ) {
    return "added";
  }

  if (
    normalized.includes("增強") ||
    normalized.includes("改善") ||
    normalized.includes("優化") ||
    normalized.includes("改進") ||
    normalized.includes("changed") ||
    normalized.includes("improv") ||
    normalized.includes("enhanc") ||
    normalized.includes("update")
  ) {
    return "changed";
  }

  return "changed";
}

function ensureSection(
  sections: MutableParsedSection[],
  title: string,
  category: ReleaseNotesSectionCategory,
): MutableParsedSection {
  const section: MutableParsedSection = {
    category,
    title: stripMarkdownInline(title) || getDefaultSectionTitle(category),
    items: [],
  };
  sections.push(section);
  return section;
}

function parseGitHubReleaseBody(
  body: string | null | undefined,
): ParsedGitHubReleaseBody {
  const lines = body?.split(/\r?\n/) ?? [];
  const sections: MutableParsedSection[] = [];
  const summaryLines: string[] = [];
  let currentSection: MutableParsedSection | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      const headingText = stripMarkdownInline(headingMatch[1] || "");
      const category = detectReleaseNotesCategory(headingText);

      currentSection = category
        ? ensureSection(sections, headingText, category)
        : null;
      continue;
    }

    const bulletMatch = trimmed.match(/^(?:[-*+]\s+|\d+\.\s+)(.+)$/);
    if (bulletMatch) {
      if (!currentSection) {
        currentSection = ensureSection(
          sections,
          getDefaultSectionTitle("changed"),
          "changed",
        );
      }

      const itemText = stripMarkdownInline(bulletMatch[1] || "");
      if (itemText) {
        currentSection.items.push(itemText);
      }
      continue;
    }

    const paragraph = stripMarkdownInline(trimmed);
    if (!paragraph) {
      continue;
    }

    if (currentSection) {
      if (currentSection.items.length === 0) {
        currentSection.description = currentSection.description
          ? `${currentSection.description} ${paragraph}`
          : paragraph;
      } else {
        const lastIndex = currentSection.items.length - 1;
        currentSection.items[lastIndex] =
          `${currentSection.items[lastIndex]} ${paragraph}`.trim();
      }
      continue;
    }

    summaryLines.push(paragraph);
  }

  return {
    summary: summaryLines.length > 0 ? summaryLines.join(" ") : undefined,
    sections: sections.filter((section) => section.items.length > 0),
  };
}

function mergeReleaseEntry(
  primary: ReleaseNotesEntry,
  fallback: ReleaseNotesEntry | null,
): { entry: ReleaseNotesEntry; usedFallback: boolean } {
  if (!fallback) {
    return {
      entry: primary,
      usedFallback: false,
    };
  }

  const usedFallback =
    primary.sections.length === 0 ||
    !primary.summary ||
    primary.title === primary.version ||
    primary.title === `版本 ${primary.version}`;

  return {
    usedFallback,
    entry: {
      version: primary.version,
      title:
        primary.title === primary.version || primary.title === `版本 ${primary.version}`
          ? fallback.title
          : primary.title,
      publishedAt: primary.publishedAt || fallback.publishedAt,
      status: primary.status,
      summary: primary.summary || fallback.summary,
      sections: primary.sections.length > 0 ? primary.sections : fallback.sections,
    },
  };
}

function formatGitHubReleaseAsEntry(release: GitHubRelease): ReleaseNotesEntry | null {
  const version = normalizeVersion(release.tag_name);

  if (!version) {
    return null;
  }

  const parsedBody = parseGitHubReleaseBody(release.body);
  const normalizedName = stripMarkdownInline(release.name || "");
  const title =
    normalizedName && normalizeVersion(normalizedName) !== version
      ? normalizedName
      : `版本 ${version}`;

  return {
    version,
    title,
    publishedAt:
      release.published_at?.trim().slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    status: release.prerelease ? "preview" : "released",
    summary: parsedBody.summary,
    sections: parsedBody.sections,
  };
}

export class ReleaseNotesService {
  private static instance: ReleaseNotesService | null = null;

  private cache: ReleaseNotesResponse | null = null;
  private cacheExpiresAt = 0;
  private inFlight: Promise<ReleaseNotesResponse> | null = null;

  static getInstance(): ReleaseNotesService {
    if (!ReleaseNotesService.instance) {
      ReleaseNotesService.instance = new ReleaseNotesService();
    }

    return ReleaseNotesService.instance;
  }

  static resetInstanceForTests(): void {
    ReleaseNotesService.instance = null;
  }

  async getReleaseNotes(currentVersion: string): Promise<ReleaseNotesResponse> {
    if (this.cache && this.cacheExpiresAt > Date.now()) {
      return this.cache;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.loadReleaseNotes(currentVersion).finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async loadReleaseNotes(
    currentVersion: string,
  ): Promise<ReleaseNotesResponse> {
    const warnings: string[] = [];
    const fallbackEntries = getFallbackReleaseNotes();
    const fallbackByVersion = new Map(
      fallbackEntries.map((entry) => [entry.version, entry] as const),
    );
    const repository = getRepositoryInfo();
    let githubEntries: ReleaseNotesEntry[] = [];
    let source: ReleaseNotesSource = "fallback";

    try {
      githubEntries = await this.fetchGitHubReleases(repository);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown GitHub releases error";
      warnings.push(`GitHub 版本資料暫時無法讀取，已改用本機版本說明。(${message})`);
      log.warn("Failed to fetch GitHub release notes", {
        error: message,
        repository: repository.url,
      });
    }

    const releaseMap = new Map<string, ReleaseNotesEntry>();
    const fallbackUsage = new Set<string>();

    for (const githubEntry of githubEntries) {
      const merged = mergeReleaseEntry(
        githubEntry,
        fallbackByVersion.get(githubEntry.version) ?? null,
      );
      releaseMap.set(merged.entry.version, merged.entry);
      if (merged.usedFallback) {
        fallbackUsage.add(merged.entry.version);
      }
    }

    for (const fallbackEntry of fallbackEntries) {
      if (!releaseMap.has(fallbackEntry.version)) {
        releaseMap.set(fallbackEntry.version, fallbackEntry);
      }
    }

    const releases = [...releaseMap.values()].sort((left, right) => {
      const publishedDateComparison = right.publishedAt.localeCompare(left.publishedAt);

      if (publishedDateComparison !== 0) {
        return publishedDateComparison;
      }

      return compareReleaseNoteVersionsDesc(left.version, right.version);
    });

    if (githubEntries.length === 0) {
      source = "fallback";
    } else if (
      fallbackUsage.size > 0 ||
      releases.length > githubEntries.length ||
      !releaseMap.has(currentVersion)
    ) {
      source = "hybrid";
    } else {
      source = "github";
    }

    if (githubEntries.length > 0 && fallbackUsage.size > 0) {
      warnings.push(
        `以下版本缺少完整 GitHub release 內容，已補用本機資料：${[
          ...fallbackUsage,
        ]
          .sort(compareReleaseNoteVersionsDesc)
          .join(", ")}。`,
      );
    }

    if (githubEntries.length > 0 && !githubEntries.some((entry) => entry.version === currentVersion)) {
      warnings.push(
        `目前執行版本 v${currentVersion} 尚未在 GitHub Releases 發布，已補用本機版本說明。`,
      );
    }

    const response: ReleaseNotesResponse = {
      currentVersion,
      currentRelease: releaseMap.get(currentVersion) ?? null,
      releases,
      source,
      fetchedAt: new Date().toISOString(),
      warnings,
      repository,
    };

    this.cache = response;
    this.cacheExpiresAt = Date.now() + RELEASE_NOTES_CACHE_TTL_MS;
    return response;
  }

  private async fetchGitHubReleases(
    repository: ReleaseNotesRepositoryInfo,
  ): Promise<ReleaseNotesEntry[]> {
    const token = process.env.GITHUB_TOKEN?.trim();
    const url = new URL(
      `${GITHUB_API_BASE_URL}/repos/${repository.owner}/${repository.name}/releases`,
    );
    url.searchParams.set("per_page", "20");

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "youtube-music-bot-release-notes",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubRelease[];
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .filter((release) => !release.draft)
      .map(formatGitHubReleaseAsEntry)
      .filter((entry): entry is ReleaseNotesEntry => entry !== null)
      .sort((left, right) => {
        const publishedDateComparison = right.publishedAt.localeCompare(left.publishedAt);

        if (publishedDateComparison !== 0) {
          return publishedDateComparison;
        }

        return compareReleaseNoteVersionsDesc(left.version, right.version);
      });
  }
}

export function getReleaseNotesService(): ReleaseNotesService {
  return ReleaseNotesService.getInstance();
}

export function __resetReleaseNotesServiceForTests(): void {
  ReleaseNotesService.resetInstanceForTests();
}
