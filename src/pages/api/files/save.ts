import type { APIRoute } from "astro";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getIgnoredPatterns, shouldIgnore } from "../../../lib/ignore";

const WORKSPACE_ROOT = path.resolve(
  process.env.CLAWSPACE_ROOT ?? path.resolve(process.cwd(), "..")
);
const WORKSPACE_ROOT_REAL = fs.realpathSync(WORKSPACE_ROOT);
const MAX_CONTENT_BYTES = 1_000_000; // 1 MB per save
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

  // Non-browser clients may not send either header; deny by default for CSRF safety.
  return false;
}

function writeAudit(params: {
  relativePath: string;
  bytes: number;
  request: Request;
  beforeHash: string;
  afterHash: string;
}) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action: "save",
      path: params.relativePath,
      bytes: params.bytes,
      beforeHash: params.beforeHash,
      afterHash: params.afterHash,
      ip:
        params.request.headers.get("x-forwarded-for") ||
        params.request.headers.get("cf-connecting-ip") ||
        null,
      ua: params.request.headers.get("user-agent") || null,
    });
    fs.appendFileSync(AUDIT_LOG_PATH, `${line}\n`, "utf8");
  } catch {
    // Best effort; do not fail save on audit write failure.
  }
}

function writeOriginBlock(request: Request) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action: "save-blocked",
      origin: request.headers.get("origin") || null,
      referer: request.headers.get("referer") || null,
      host: request.headers.get("host") || null,
      forwardedHost: request.headers.get("x-forwarded-host") || null,
      forwardedProto: request.headers.get("x-forwarded-proto") || null,
      forwardedFor: request.headers.get("x-forwarded-for") || null,
      ua: request.headers.get("user-agent") || null,
    });
    fs.appendFileSync(AUDIT_LOG_PATH, `${line}\n`, "utf8");
  } catch {
    // Best effort.
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSameOrigin(request)) {
      writeOriginBlock(request);
      return json(403, { error: "Cross-origin save blocked" });
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
    const content = String(body?.content ?? "");

    if (!relativePath) {
      return json(400, { error: "Missing path" });
    }

    if (content.includes("\u0000")) {
      return json(400, { error: "Binary content is not allowed" });
    }

    const contentBytes = Buffer.byteLength(content, "utf8");
    if (contentBytes > MAX_CONTENT_BYTES) {
      return json(413, {
        error: `Content too large (max ${MAX_CONTENT_BYTES} bytes)`,
      });
    }

    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
      return json(400, { error: "Invalid path" });
    }

    const ignoredPatterns = getIgnoredPatterns(WORKSPACE_ROOT);
    if (shouldIgnore(relativePath, ignoredPatterns)) {
      return json(403, { error: "Forbidden" });
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return json(404, { error: "File not found" });
    }

    const realPath = fs.realpathSync(absolutePath);
    if (
      realPath !== WORKSPACE_ROOT_REAL &&
      !realPath.startsWith(`${WORKSPACE_ROOT_REAL}${path.sep}`)
    ) {
      return json(403, { error: "Path escapes workspace root" });
    }

    const before = fs.readFileSync(realPath, "utf8");
    const beforeHash = crypto.createHash("sha256").update(before).digest("hex");
    const afterHash = crypto.createHash("sha256").update(content).digest("hex");

    const tempPath = `${realPath}.clawspace-tmp-${Date.now()}-${process.pid}`;
    fs.writeFileSync(tempPath, content, { encoding: "utf8", mode: 0o644 });
    fs.renameSync(tempPath, realPath);

    writeAudit({
      relativePath,
      bytes: contentBytes,
      request,
      beforeHash,
      afterHash,
    });

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: String(error) });
  }
};
