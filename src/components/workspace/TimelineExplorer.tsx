import "@github/relative-time-element";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from "@tanstack/react-query";
import type { TimelineEvent } from "@/lib/workspace-timeline";

interface TimelinePage {
  events: TimelineEvent[];
  nextCursor: string | null;
  availableFolders: string[];
}

interface Props {
  initialEvents: TimelineEvent[];
  initialNextCursor: string | null;
  initialSelectedFolders: string[];
  availableFolders: string[];
  pageSize: number;
  showInternalFiles: boolean;
}

function formatTimeTitle(whenISO: string) {
  const date = new Date(whenISO);
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildFoldersParam(folders: string[]) {
  return [...folders].sort((a, b) => a.localeCompare(b)).join(",");
}

function PreviewText({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);

  if (!event.previewText) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">No text preview.</p>
    );
  }

  const canToggle = event.isPreviewTruncated;
  const content =
    expanded && event.previewFullText
      ? event.previewFullText
      : event.previewText;

  return (
    <div className="mt-2 text-sm text-foreground/90">
      <pre className="overflow-x-auto rounded bg-muted p-2 text-xs leading-relaxed">
        <code
          className={expanded ? "whitespace-pre-wrap" : "whitespace-pre-wrap"}
        >
          {content}
        </code>
      </pre>
      {canToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-red-600 hover:underline dark:text-red-400"
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}

function TimelineExplorerInner({
  initialEvents,
  initialNextCursor,
  initialSelectedFolders,
  availableFolders,
  pageSize,
  showInternalFiles,
}: Props) {
  const [selectedFolders, setSelectedFolders] = useState<string[]>(
    initialSelectedFolders
  );
  const [folderOptions, setFolderOptions] =
    useState<string[]>(availableFolders);

  const foldersParam = useMemo(
    () => buildFoldersParam(selectedFolders),
    [selectedFolders]
  );

  useEffect(() => {
    const url = new URL(window.location.href);

    if (selectedFolders.length === 0) {
      url.searchParams.delete("folders");
    } else {
      url.searchParams.set("folders", buildFoldersParam(selectedFolders));
    }

    window.history.replaceState({}, "", url);
  }, [selectedFolders]);

  const initialFoldersParam = useMemo(
    () => buildFoldersParam(initialSelectedFolders),
    [initialSelectedFolders]
  );

  const query = useInfiniteQuery<TimelinePage>({
    queryKey: ["timeline", foldersParam, pageSize, showInternalFiles],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        showInternal: String(showInternalFiles),
      });

      if (foldersParam.length > 0) {
        params.set("folders", foldersParam);
      }

      if (typeof pageParam === "string" && pageParam.length > 0) {
        params.set("cursor", pageParam);
      }

      const response = await fetch(`/api/timeline?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Timeline fetch failed: ${response.status}`);
      }
      return (await response.json()) as TimelinePage;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData:
      foldersParam === initialFoldersParam
        ? {
            pages: [
              {
                events: initialEvents,
                nextCursor: initialNextCursor,
                availableFolders,
              },
            ],
            pageParams: [null],
          }
        : undefined,
    staleTime: 20_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const fromQuery = query.data?.pages[0]?.availableFolders;
    if (fromQuery && fromQuery.length > 0) {
      setFolderOptions(fromQuery);
    }
  }, [query.data]);

  const events = query.data?.pages.flatMap((page) => page.events) ?? [];

  function toggleFolder(folder: string) {
    setSelectedFolders((current) =>
      current.includes(folder)
        ? current.filter((item) => item !== folder)
        : [...current, folder]
    );
  }

  return (
    <section className="space-y-6">
      <details
        className="rounded-lg border border-border bg-card p-4"
        open={false}
      >
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Filters
          <span className="ml-2 text-muted-foreground">
            (
            {selectedFolders.length === 0
              ? "all folders"
              : `${selectedFolders.length} selected`}
            )
          </span>
        </summary>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {selectedFolders.length === 0
              ? "Showing all folders"
              : `${selectedFolders.length} folder${selectedFolders.length === 1 ? "" : "s"} selected`}
          </p>
          <button
            type="button"
            onClick={() => setSelectedFolders([])}
            className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
            disabled={selectedFolders.length === 0}
          >
            Clear all filters
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {folderOptions.map((folder) => {
            const enabled = selectedFolders.includes(folder);
            return (
              <button
                key={folder}
                type="button"
                onClick={() => toggleFolder(folder)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  enabled
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
                aria-pressed={enabled}
              >
                {folder}
              </button>
            );
          })}
        </div>
      </details>

      <ol className="space-y-3">
        {events.map((event) => {
          return (
            <li
              key={event.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <a
                  href={event.folder === "(root)" ? "/" : `/${event.folder}`}
                  className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:underline"
                >
                  {event.folder}
                </a>
                {createElement("relative-time", {
                  className: "text-xs text-muted-foreground",
                  datetime: event.whenISO,
                  title: formatTimeTitle(event.whenISO),
                })}
                <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {event.changeType}
                </span>
              </div>

              <h3 className="text-lg font-semibold leading-tight">
                <a
                  href={`/${event.path}`}
                  data-astro-reload
                  className="text-red-600 hover:underline dark:text-red-400"
                >
                  {event.title}
                </a>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.reason}
              </p>

              <PreviewText event={event} />

              <div className="mt-3 space-y-1 text-sm text-foreground/90">
                <p className="text-red-600 dark:text-red-400">Path</p>
                <p>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {event.path}
                  </code>
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <a
                  href={`/${event.path}`}
                  data-astro-reload
                  className="text-red-600 hover:underline dark:text-red-400"
                >
                  Open file
                </a>
                {event.commitHash && event.path.startsWith("clawspace/") && (
                  <>
                    <a
                      href={`https://github.com/nickytonline/clawspace/commit/${event.commitHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      View commit
                    </a>
                    <a
                      href={`https://github.com/nickytonline/clawspace/commits/main/${event.path.replace(/^clawspace\//, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      View diff
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {events.length === 0 && (
        <p className="text-sm italic text-muted-foreground">
          No events match the selected folders.
        </p>
      )}

      <div className="pt-2 text-center">
        {query.hasNextPage ? (
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="inline-flex rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        ) : (
          events.length > 0 && (
            <p className="text-sm text-muted-foreground">
              You reached the start of the timeline.
            </p>
          )
        )}
      </div>

      {query.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load more timeline events.
        </p>
      )}
    </section>
  );
}

export default function TimelineExplorer(props: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TimelineExplorerInner {...props} />
    </QueryClientProvider>
  );
}
