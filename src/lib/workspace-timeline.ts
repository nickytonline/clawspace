import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getIgnoredPatterns, shouldIgnore } from "./ignore";

export interface TimelineEvent {
  id: string;
  title: string;
  whenISO: string;
  summary: string;
  path: string;
  folder: string;
  eventType: "file";
  changeType: "created" | "updated";
  reason: string;
  commitHash?: string;
  previewText?: string;
  previewFullText?: string;
  previewFormat?: "markdown" | "text";
  isPreviewTruncated?: boolean;
}

interface GetTimelinePageInput {
  workspaceRoot: string;
  folders: string[];
  cursor?: string;
  limit?: number;
  showInternalFiles?: boolean;
}

interface TimelineIndex {
  events: TimelineEvent[];
  availableFolders: string[];
}

interface TimelinePage {
  events: TimelineEvent[];
  nextCursor: string | null;
  availableFolders: string[];
}

type CacheEntry = {
  ts: number;
  index: TimelineIndex;
};

const indexCache = new Map<string, CacheEntry>();
const INDEX_TTL_MS = 30_000;
const MAX_FILES_SCANNED = 5000;
const PREVIEW_LIMIT = 200;
const PREVIEW_MAX_FULL = 5000;

const textExtensions = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".astro",
  ".sh",
  ".py",
  ".go",
  ".rs",
  ".java",
]);

function buildCacheKey(workspaceRoot: string, showInternalFiles: boolean) {
  return `${workspaceRoot}::internal=${showInternalFiles ? "1" : "0"}`;
}

type GitInfo = { hash: string; author: string; subject: string };
const gitInfoCache = new Map<string, { ts: number; info: GitInfo | null }>();
const GIT_INFO_TTL_MS = 60_000;

function safeGitLastCommitForPath(
  workspaceRoot: string,
  relativePath: string
): GitInfo | null {
  if (!relativePath.startsWith("clawspace/")) {
    return null;
  }

  const repoRoot = path.join(workspaceRoot, "clawspace");
  const repoRelativePath = relativePath.replace(/^clawspace\//, "");

  const cacheKey = `${repoRoot}:${repoRelativePath}`;
  const cached = gitInfoCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < GIT_INFO_TTL_MS) {
    return cached.info;
  }

  try {
    const raw = execSync(
      `git -C ${JSON.stringify(repoRoot)} log -n 1 --date=iso-strict --pretty=format:%H%x1f%an%x1f%s -- ${JSON.stringify(repoRelativePath)}`,
      { encoding: "utf8", timeout: 1500 }
    ).trim();

    if (!raw) {
      gitInfoCache.set(cacheKey, { ts: now, info: null });
      return null;
    }

    const [hash, author, subject] = raw.split("\u001f");
    if (!hash) {
      gitInfoCache.set(cacheKey, { ts: now, info: null });
      return null;
    }

    const info = {
      hash,
      author: author || "Unknown",
      subject: subject || "File updated",
    };
    gitInfoCache.set(cacheKey, { ts: now, info });
    return info;
  } catch {
    gitInfoCache.set(cacheKey, { ts: now, info: null });
    return null;
  }
}

function getPreviewText(absolutePath: string): {
  previewText: string;
  previewFullText: string;
  previewFormat: "markdown" | "text";
  truncated: boolean;
} | null {
  const ext = path.extname(absolutePath).toLowerCase();
  if (!textExtensions.has(ext)) return null;

  try {
    const buffer = fs.readFileSync(absolutePath);
    const rawText = buffer.toString("utf8").trim();
    if (!rawText) return null;

    const isMarkdown = ext === ".md" || ext === ".mdx";
    const normalized = isMarkdown
      ? rawText
      : rawText.replace(/\s+/g, " ").trim();
    const fullText = normalized.slice(0, PREVIEW_MAX_FULL);

    if (fullText.length <= PREVIEW_LIMIT) {
      return {
        previewText: fullText,
        previewFullText: fullText,
        previewFormat: isMarkdown ? "markdown" : "text",
        truncated: false,
      };
    }

    return {
      previewText: `${fullText.slice(0, PREVIEW_LIMIT).trimEnd()}…`,
      previewFullText: fullText,
      previewFormat: isMarkdown ? "markdown" : "text",
      truncated: true,
    };
  } catch {
    return null;
  }
}

function scanWorkspace(
  workspaceRoot: string,
  showInternalFiles: boolean
): TimelineIndex {
  const ignoredPatterns = getIgnoredPatterns(workspaceRoot);
  const entries: TimelineEvent[] = [];
  const folders = new Set<string>();

  const queue: string[] = [""];

  while (queue.length > 0 && entries.length < MAX_FILES_SCANNED) {
    const relativeDir = queue.shift() ?? "";
    const absoluteDir = path.join(workspaceRoot, relativeDir);

    let dirEntries: fs.Dirent[] = [];
    try {
      dirEntries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of dirEntries) {
      const relativePath = path.posix
        .join(relativeDir.replace(/\\/g, "/"), entry.name)
        .replace(/^\/+/, "");

      if (
        shouldIgnore(relativePath, ignoredPatterns, {
          showInternalFiles,
        })
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        queue.push(relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const absolutePath = path.join(workspaceRoot, relativePath);
      let stat: fs.Stats;

      try {
        stat = fs.statSync(absolutePath);
      } catch {
        continue;
      }

      const folder = relativePath.includes("/")
        ? relativePath.split("/")[0]
        : "(root)";

      folders.add(folder);

      const preview = getPreviewText(absolutePath);

      const changeType =
        Math.abs(stat.mtimeMs - stat.birthtimeMs) <= 1000
          ? "created"
          : "updated";

      entries.push({
        id: `file:${relativePath}:${stat.mtimeMs}`,
        title: relativePath.split("/").at(-1) ?? relativePath,
        whenISO: stat.mtime.toISOString(),
        summary: `${folder} • ${changeType} ${stat.mtime.toLocaleString("en-CA")}`,
        path: relativePath,
        folder,
        eventType: "file",
        changeType,
        reason: "File updated",
        previewText: preview?.previewText,
        previewFullText: preview?.previewFullText,
        previewFormat: preview?.previewFormat,
        isPreviewTruncated: preview?.truncated ?? false,
      });

      if (entries.length >= MAX_FILES_SCANNED) {
        break;
      }
    }
  }

  entries.sort(
    (a, b) => new Date(b.whenISO).getTime() - new Date(a.whenISO).getTime()
  );

  return {
    events: entries,
    availableFolders: [...folders].sort((a, b) => a.localeCompare(b)),
  };
}

function getTimelineIndex(
  workspaceRoot: string,
  showInternalFiles: boolean
): TimelineIndex {
  const cacheKey = buildCacheKey(workspaceRoot, showInternalFiles);
  const cached = indexCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.ts < INDEX_TTL_MS) {
    return cached.index;
  }

  const index = scanWorkspace(workspaceRoot, showInternalFiles);
  indexCache.set(cacheKey, { ts: now, index });
  return index;
}

export function encodeCursor(event: TimelineEvent): string {
  return Buffer.from(
    JSON.stringify({ whenISO: event.whenISO, id: event.id })
  ).toString("base64url");
}

function decodeCursor(cursor: string): { whenISO: string; id: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    if (typeof parsed?.whenISO !== "string" || typeof parsed?.id !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function enrichPageEventsWithGit(
  workspaceRoot: string,
  events: TimelineEvent[]
) {
  return events.map((event) => {
    const commit = safeGitLastCommitForPath(workspaceRoot, event.path);
    if (!commit) return event;

    return {
      ...event,
      reason: commit.subject,
      commitHash: commit.hash,
    };
  });
}

export function getTimelinePage({
  workspaceRoot,
  folders,
  cursor,
  limit = 30,
  showInternalFiles = false,
}: GetTimelinePageInput): TimelinePage {
  const cappedLimit = Math.max(1, Math.min(limit, 100));
  const index = getTimelineIndex(workspaceRoot, showInternalFiles);

  const normalizedFolders = folders.filter((folder) =>
    index.availableFolders.includes(folder)
  );

  const filtered =
    normalizedFolders.length > 0
      ? index.events.filter((event) => normalizedFolders.includes(event.folder))
      : index.events;

  let startIndex = 0;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const foundIndex = filtered.findIndex(
        (event) => event.id === decoded.id && event.whenISO === decoded.whenISO
      );
      if (foundIndex >= 0) {
        startIndex = foundIndex + 1;
      }
    }
  }

  const pageEvents = filtered.slice(startIndex, startIndex + cappedLimit);
  const events = enrichPageEventsWithGit(workspaceRoot, pageEvents);
  const lastEvent = pageEvents.at(-1);
  const nextCursor =
    startIndex + cappedLimit < filtered.length && lastEvent
      ? encodeCursor(lastEvent)
      : null;

  return {
    events,
    nextCursor,
    availableFolders: index.availableFolders,
  };
}
