import { ClipboardPlus } from "lucide-react";

/**
 * The one-line explanation a teacher sees above a library list: what the
 * tick boxes are for. Students never see it.
 */
export function PickHint({ noun }: { noun: string }) {
  return (
    <p className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      <ClipboardPlus className="size-4 shrink-0 text-primary" aria-hidden />
      Tick {noun} to add them to one of your batches. Your picks are kept while
      you move between library pages.
    </p>
  );
}
