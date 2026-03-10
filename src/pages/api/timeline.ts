import type { APIRoute } from "astro";
import { getTimelinePage } from "../../lib/workspace-timeline";
import path from "node:path";

const WORKSPACE_ROOT = path.resolve(
  process.env.CLAWSPACE_ROOT ?? path.resolve(process.cwd(), "..")
);

function parseFolders(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 30;
  const folders = parseFolders(url.searchParams.get("folders"));

  const showInternalFromCookie =
    cookies.get("clawspace_show_internal_files")?.value === "true";
  const showInternalOverride = url.searchParams.get("showInternal");
  const showInternalFiles =
    showInternalOverride === null
      ? showInternalFromCookie
      : showInternalOverride === "true";

  const page = getTimelinePage({
    workspaceRoot: WORKSPACE_ROOT,
    folders,
    cursor,
    limit,
    showInternalFiles,
  });

  return new Response(
    JSON.stringify({
      events: page.events,
      nextCursor: page.nextCursor,
      availableFolders: page.availableFolders,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, max-age=15, stale-while-revalidate=30",
      },
    }
  );
};
