import { Skeleton } from "@/components/ui/skeleton";

/**
 * The reason clicking anything felt frozen.
 *
 * Every page in this group is server-rendered on demand and most of them open
 * with several database reads. Without a loading boundary, App Router
 * navigation does not commit until the whole page — layout, queries and all —
 * has finished on the server. The browser therefore sits on the PREVIOUS page
 * showing no response whatsoever, which reads as a broken click rather than a
 * slow one. There were no loading.tsx files and no Suspense boundaries
 * anywhere across 84 pages.
 *
 * With this file the navigation commits immediately: the shell stays, this
 * skeleton paints at once, and the real page streams in behind it. It makes
 * nothing faster — the server work is identical — but the interface stops
 * lying about whether it heard the click, which is most of what "laggy" means.
 *
 * Deliberately generic. It sits at the group root so every page inherits it,
 * and it mimics the shape almost all of them share (a title, a line of
 * supporting text, then a grid of cards) rather than any one page exactly. A
 * route whose shape is genuinely different can drop its own loading.tsx beside
 * its page.tsx and that will win.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  );
}
