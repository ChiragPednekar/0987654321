"use client";

import { Search } from "lucide-react";
import { OPEN_SEARCH_EVENT } from "@/components/command-palette";
import { useBrowserValue } from "@/hooks/use-browser-state";

const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Looks like a search field, opens the app's ⌘K palette — one search, not
 * two that drift apart. The palette searches cases, skill tracks and firms.
 */
export function GlobalSearch() {
  const apple = useBrowserValue(isApple, true);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-dx-border bg-dx-card px-3 text-left text-sm text-dx-muted shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-colors hover:border-blue-300 hover:text-dx-ink-2"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">Search cases, tracks, firms…</span>
      <kbd className="dash-mono shrink-0 rounded border border-dx-border bg-dx-subtle px-1.5 py-0.5 text-[10.5px] text-dx-muted">
        {apple ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
