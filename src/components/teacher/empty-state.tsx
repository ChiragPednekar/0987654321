import Link from "next/link";
import { GraduationCap, type LucideIcon } from "lucide-react";
import { EmptyState as SharedEmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/**
 * The empty state every teacher section falls back to: the shared
 * `EmptyState`, so a teacher's empty page looks like a student's, with the
 * one action that fills the section.
 */
export function EmptyState({
  icon = GraduationCap,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <SharedEmptyState
      className={className}
      icon={icon}
      title={title}
      description={body}
      action={
        action ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
