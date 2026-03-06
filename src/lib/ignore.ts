import fs from "fs";
import path from "path";

export const INTERNAL_FILES = [
  "SOUL.md",
  "AGENTS.md",
  "IDENTITY.md",
  "USER.md",
  "MEMORY.md",
  "HEARTBEAT.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
  ".env",
];

const DEFAULT_PATTERNS = [
  ".git",
  "workspace-astro",
  ".pi",
  "node_modules",
  ".pnpm",
  ".cache",
  ".DS_Store",
  ".astro",
];

function parseIgnoreFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((pattern) => pattern.replace(/\/$/, ""));
}

export function getIgnoredPatterns(workspaceRoot: string): string[] {
  const patterns = [...DEFAULT_PATTERNS];

  // .gitignore at workspace root
  patterns.push(...parseIgnoreFile(path.join(workspaceRoot, ".gitignore")));

  // .clawspace-ignore at workspace root
  patterns.push(
    ...parseIgnoreFile(path.join(workspaceRoot, ".clawspace-ignore"))
  );

  // CLAWSPACE_IGNORE env var (comma-separated)
  const envIgnore = process.env.CLAWSPACE_IGNORE;
  if (envIgnore) {
    patterns.push(
      ...envIgnore
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    );
  }

  return patterns;
}

export function shouldIgnore(
  relativePath: string,
  ignoredPatterns: string[]
): boolean {
  const normalizedPath = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  // Block internal files at root level
  if (
    !normalizedPath.includes("/") &&
    INTERNAL_FILES.includes(normalizedPath)
  ) {
    return true;
  }

  // Check .gitignore-like patterns (segment/prefix matching, not substring)
  for (const rawPattern of ignoredPatterns) {
    const pattern = rawPattern
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .trim();

    if (!pattern) continue;

    if (pattern.includes("/")) {
      // Treat slash patterns as path prefixes from workspace root
      if (
        normalizedPath === pattern ||
        normalizedPath.startsWith(`${pattern}/`)
      ) {
        return true;
      }
      continue;
    }

    // Treat plain names as path segments (e.g., "node_modules", "dist")
    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.includes(pattern)) {
      return true;
    }
  }
  return false;
}
