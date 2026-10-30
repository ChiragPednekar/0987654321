"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * A keycap. Muted, but at the muted text colour, never dimmer: a hint you
 * can't read isn't a hint.
 */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-secondary px-1.5 font-sans text-[11px] font-medium leading-none text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const isApple = () => /Mac|iPhone|iPad/i.test(navigator.userAgent);
const noop = () => () => {};

/**
 * A shortcut with the platform's modifier: ⌘K on a Mac, Ctrl K elsewhere.
 * The server can't know the platform, so it renders ⌘ and the browser
 * corrects it after hydration.
 */
export function ShortcutKbd({ keys, className }: { keys: string[]; className?: string }) {
  const apple = useSyncExternalStore(noop, isApple, () => true);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={[apple ? "Command" : "Control", ...keys].join(" ")}>
      <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}
