import type { APIRoute } from "astro";
import fs from "fs";
import path from "path";
import {
  getIgnoredPatterns,
  isInternalProtectedPath,
  shouldIgnore,
} from "../../../lib/ignore";

const WORKSPACE_ROOT = path.resolve(
  process.env.CLAWSPACE_ROOT ?? path.resolve(process.cwd(), "..")
);
const WORKSPACE_ROOT_REAL = fs.realpathSync(WORKSPACE_ROOT);
const AUDIT_LOG_PATH = path.join(
  WORKSPACE_ROOT,
  "logs",
  "clawspace-edit-audit.log"
);
const ALLOWED_ORIGIN_HOSTS = new Set(
  (process.env.CLAWSPACE_ALLOWED_ORIGIN_HOSTS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getExpectedHosts(request: Request): Set<string> {
  const expected = new Set<string>();
  const targetUrl = new URL(request.url);
  expected.add(targetUrl.host);

  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim() || "";

  if (forwardedHost) expected.add(forwardedHost);
  if (hostHeader) expected.add(hostHeader);

  return expected;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expectedHosts = getExpectedHosts(request);

  if (origin) {
    try {
      const parsed = new URL(origin);
      return (
        expectedHosts.has(parsed.host) ||
        (ALLOWED_ORIGIN_HOSTS.size > 0 && ALLOWED_ORIGIN_HOSTS.has(parsed.host))
      );
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const parsed = new URL(referer);
      return (
        expectedHosts.has(parsed.host) ||
        (ALLOWED_ORIGIN_HOSTS.size > 0 && ALLOWED_ORIGIN_HOSTS.has(parsed.host))
      );
    } catch {
      return false;
    }
  }

  return false;
}

function writeAudit(params: {
  action: "delete" | "delete-blocked";
  relativePath: string;
  entryType?: "file" | "directory";
  request: Request;
  reason?: string;
}) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action: params.action,
      path: params.relativePath,
      entryType: params.entryType || null,
      reason: params.reason || null,
      ip:
        params.request.headers.get("x-forwarded-for") ||
        params.request.headers.get("cf-connecting-ip") ||
        null,
      ua: params.request.headers.get("user-agent") || null,
    });
    fs.appendFileSync(AUDIT_LOG_PATH, `${line}\n`, "utf8");
  } catch {
    // Best effort only.
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) {
      return json(403, { error: "Cross-origin delete blocked" });
    }

    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json")
    ) {
      return json(415, { error: "Content-Type must be application/json" });
    }

    const body = await request.json();
    const relativePath = String(body?.path || "")
      .replace(/^\//, "")
      .trim();

    if (!relativePath) {
      return json(400, { error: "Missing path" });
    }

    if (isInternalProtectedPath(relativePath)) {
      writeAudit({
        action: "delete-blocked",
        relativePath,
        request,
        reason: "internal-protected",
      });
      return json(403, { error: "Internal files/folders cannot be deleted" });
    }

    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
      return json(400, { error: "Invalid path" });
    }

    const ignoredPatterns = getIgnoredPatterns(WORKSPACE_ROOT);
    if (shouldIgnore(relativePath, ignoredPatterns)) {
      return json(403, { error: "Forbidden" });
    }

    if (!fs.existsSync(absolutePath)) {
      return json(404, { error: "Path not found" });
    }

    const realPath = fs.realpathSync(absolutePath);
    if (
      realPath !== WORKSPACE_ROOT_REAL &&
      !realPath.startsWith(`${WORKSPACE_ROOT_REAL}${path.sep}`)
    ) {
      return json(403, { error: "Path escapes workspace root" });
    }

    const stats = fs.statSync(realPath);
    const entryType = stats.isDirectory() ? "directory" : "file";

    if (stats.isDirectory()) {
      fs.rmSync(realPath, { recursive: true, force: false });
    } else {
      fs.unlinkSync(realPath);
    }

    writeAudit({ action: "delete", relativePath, request, entryType });

    return json(200, { ok: true, deleted: relativePath, type: entryType });
  } catch (error) {
    return json(500, { error: String(error) });
  }
};
