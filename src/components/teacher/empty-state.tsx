import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The empty state every teacher section falls back to.
 *
 * A blank table teaches nothing. Each of these says what the section is for and
 * offers the one action that fills it. Set left-aligned under an ink rule,
 * like the start of a fresh page — not a centred icon above a centred line,
 * which is every generated app's empty state. `icon` is still accepted so no
 * caller changes; it is no longer drawn.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="max-w-lg border-t border-border pt-5 pb-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? (
        <Button asChild className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
